import type { docs_v1 } from "googleapis";
import { NamedStyleType, Node, Section, Schema } from "./types";
import { ParagraphCursor } from "./cursor";
import { hasNamedStyle, parseStructuredText } from "./utils";

const CONTENT_KEY = "content";

/**
 * Recursively collects all `NamedStyleType`s defined within a nested `Node` schema.
 *
 * This is used to build a set of allowed heading styles for the parser to recognize
 * valid tree nodes and detect boundaries.
 *
 * @param node - The current node schema to traverse.
 * @param set - The Set to populate with collected style types.
 */
export function collectNodeStylesRecursive(
  node: Node,
  set: Set<NamedStyleType>
): void {
  if (node.title.namedStyleType) set.add(node.title.namedStyleType);
  if (node.content && node.content.kind === "tree") {
    collectNodeStylesRecursive(node.content.node, set);
  }
}

/**
 * Creates a normalized node object from a raw title string based on the provided schema.
 *
 * - If the schema defines parsing rules (delimiters/keys), the title is parsed into
 * structured data (Array or Object).
 * - If no parsing rules exist, the title is treated as a simple string.
 *
 * @param text - The raw text of the title/heading.
 * @param titleSchema - The schema defining how to parse the title.
 * @returns An object containing the parsed `title` and an empty `content` array.
 */
export function createNodeFromTitle(
  text: string,
  titleSchema: Schema
): Record<"title" | "content", unknown> {
  const hasDelimiterSchema =
    !!titleSchema.keyDelimiter ||
    (!!titleSchema.keys && titleSchema.keys.length > 0) ||
    !!titleSchema.delimiter;

  if (hasDelimiterSchema) {
    const structuredText = parseStructuredText(text, titleSchema);
    if (Array.isArray(structuredText)) {
      return { title: structuredText, content: [] };
    } else if (typeof structuredText === "object" && structuredText !== null) {
      return { title: structuredText, content: [] };
    } else {
      return { title: text, content: [] };
    }
  } else {
    return { title: text, content: [] };
  }
}

/**
 * Represents the decision made by the parser for the current paragraph.
 */
export type TreeParsingAction =
  | { kind: "exitSection" }
  | { kind: "createNode" }
  | { kind: "startChildNode" }
  | { kind: "finishCurrentNode" }
  | { kind: "appendDetail" };

/**
 * Determines the next action to take based on the current paragraph's style
 * and its relationship to the current node hierarchy.
 *
 * Decision Logic Priorities:
 * 1. New Section -> Exit.
 * 2. Matches Current Node Title -> Create Sibling Node.
 * 3. Matches Child Node Title -> Start Child Node (Recursion).
 * 4. Matches Ancestor/Same Level Heading -> Finish Current Node (Pop Stack).
 * 5. Heading outside this tree -> Exit.
 * 6. Otherwise -> Append as detail content.
 *
 * @param paragraph - The current paragraph being inspected.
 * @param cursor - The paragraph cursor.
 * @param nodeSchema - The schema for the current node level.
 * @param ancestorNodeList - The stack of ancestor nodes for context.
 * @returns The determining parsing action.
 */
export function determineTreeParsingAction(
  paragraph: docs_v1.Schema$Paragraph,
  cursor: ParagraphCursor,
  nodeSchema: Node,
  ancestorNodeList: Node[]
): TreeParsingAction {
  const nodeTitleStyle = nodeSchema.title.namedStyleType;
  const childNode =
    nodeSchema.content?.kind === "tree" ? nodeSchema.content.node : undefined;

  const isCurrentNodeTitle = hasNamedStyle(paragraph, nodeTitleStyle);
  const isChildNodeTitle =
    !!childNode && hasNamedStyle(paragraph, childNode.title.namedStyleType);
  const isAncestorNodeTitle = ancestorNodeList.some((a) =>
    hasNamedStyle(paragraph, a.title.namedStyleType)
  );

  const isInThisTree =
    isCurrentNodeTitle || isChildNodeTitle || isAncestorNodeTitle;

  const isHeading = cursor.isAtParagraphHeading();
  const isAtNewSection = cursor.isAtNewSection();
  const isHeadingOutsideThisTree = isHeading && !isInThisTree;
  const isHigherLevelHeading = isHeading && isAncestorNodeTitle;
  const isSameLevelHeading = isHeading && isCurrentNodeTitle;

  if (isAtNewSection) return { kind: "exitSection" };
  if (isCurrentNodeTitle) return { kind: "createNode" };
  if (isChildNodeTitle) return { kind: "startChildNode" };
  if (isHigherLevelHeading || isSameLevelHeading)
    return { kind: "finishCurrentNode" };
  if (isHeadingOutsideThisTree) return { kind: "exitSection" };
  return { kind: "appendDetail" };
}

/**
 * The entry point for parsing a document section defined as a `Tree`.
 *
 * It searches for the first occurrence of the root node style to begin parsing.
 * Text preceding the first valid root node is ignored (orphan text).
 *
 * @param cursor - The cursor traversing the document paragraphs.
 * @param section - The section definition containing the tree schema.
 * @param allNodeTitleStyles - A set of all valid styles in this tree (for boundary detection).
 * @returns An array of parsed tree nodes.
 */
export function parseTreeSection(
  cursor: ParagraphCursor,
  section: Section,
  allNodeTitleStyles: Set<NamedStyleType>
): unknown[] {
  const treeContent = section.content;
  const nodeSchema =
    treeContent?.kind === "tree" ? treeContent.node : undefined;
  if (!treeContent || !nodeSchema) return [];

  while (!cursor.isEndOfDocument()) {
    const info = cursor.getCurrentParagraph();
    if (!info) {
      cursor.getNextParagraph();
      continue;
    }

    const { paragraph, style } = info;

    if (cursor.isAtNewSection()) break;
    if (cursor.isAtParagraphHeading() && style && !allNodeTitleStyles.has(style)) break;

    if (hasNamedStyle(paragraph, nodeSchema.title.namedStyleType)) {
      return parseTreeNode(cursor, nodeSchema, [], allNodeTitleStyles);
    }

    cursor.getNextParagraph();
  }
  return [];
}

/**
 * Recursively parses a specific level of the tree structure.
 *
 * Handles creation of current nodes, delegating to child parsers for nested content,
 * and accumulating list details.
 *
 * @param cursor - The cursor traversing the document paragraphs.
 * @param nodeSchema - The schema for the current node level.
 * @param ancestorNodeList - Stack of ancestors to detect hierarchy boundaries.
 * @param allNodeTitleStyles - Set of all valid styles for boundary checks.
 * @returns An array of parsed nodes for this level.
 */
export function parseTreeNode(
  cursor: ParagraphCursor,
  nodeSchema: Node,
  ancestorNodeList: Node[],
  allNodeTitleStyles: Set<NamedStyleType>
): unknown[] {
  const result: unknown[] = [];
  let currentNode: Record<string, unknown> | null = null;

  const childNodeSchema =
    nodeSchema.content?.kind === "tree" ? nodeSchema.content.node : undefined;

  while (!cursor.isEndOfDocument()) {
    const info = cursor.getCurrentParagraph();
    if (!info) {
      cursor.getNextParagraph();
      continue;
    }

    const { text, paragraph, style } = info;

    if (cursor.isAtNewSection()) {
      return result;
    }

    if (cursor.isAtParagraphHeading() && style && !allNodeTitleStyles.has(style)) {
      return result;
    }

    const decision = determineTreeParsingAction(
      paragraph,
      cursor,
      nodeSchema,
      ancestorNodeList
    );

    switch (decision.kind) {
      case "exitSection": {
        return result;
      }

      case "createNode": {
        currentNode = createNodeFromTitle(text, nodeSchema.title);
        result.push(currentNode);
        cursor.getNextParagraph();
        break;
      }

      case "startChildNode": {
        if (
          !currentNode ||
          !Array.isArray(currentNode[CONTENT_KEY]) ||
          !childNodeSchema
        ) {
          cursor.getNextParagraph();
          break;
        }
        const children = parseTreeNode(
          cursor,
          childNodeSchema,
          [nodeSchema, ...ancestorNodeList],
          allNodeTitleStyles
        );
        (currentNode[CONTENT_KEY] as unknown[]).push(...children);
        break;
      }

      case "finishCurrentNode": {
        if (currentNode) return result;
        cursor.getNextParagraph();
        break;
      }

      case "appendDetail": {
        if (nodeSchema.content?.kind === "tree") {
          cursor.getNextParagraph();
          break;
        }
        if (currentNode && Array.isArray(currentNode[CONTENT_KEY])) {
          (currentNode[CONTENT_KEY] as unknown[]).push(text.trim());
        }
        cursor.getNextParagraph();
        break;
      }
    }
  }

  return result;
}
