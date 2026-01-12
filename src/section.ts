import { docs_v1 } from "googleapis";
import { ParseSchema, Section, NamedStyleType } from "./types";
import { hasNamedStyle } from "./utils";
import { ParagraphCursor } from "./cursor";
import { parseTreeSection, collectNodeStylesRecursive } from "./tree";
import { parseListSection } from "./list";
import { parseTextBlockSection } from "./textBlock";

/**
 * Identifies if a paragraph corresponds to a section title defined in the schema.
 *
 * Matching Logic:
 * 1. Matches the paragraph's named style (e.g., HEADING_2) with the section's style.
 * 2. Matches the text content (case-insensitive, trimmed).
 *
 * @param paragraph - The current paragraph being inspected.
 * @param text - The extracted text content of the paragraph.
 * @param parseSchema - The global parsing schema containing section definitions.
 * @returns The canonical name of the section if found, otherwise `null`.
 */
export function getSectionTitle(
  paragraph: docs_v1.Schema$Paragraph,
  text: string,
  parseSchema: ParseSchema
): string | null {
  const normalized = text.trim().toLowerCase();
  const sectionList = parseSchema.sections ?? [];

  for (const section of sectionList) {
    const { name, namedStyleType } = section.title;
    if (name && namedStyleType) {
      const styleMatches = hasNamedStyle(paragraph, namedStyleType);
      const textMatches = normalized === name.trim().toLowerCase();
      if (styleMatches && textMatches) {
        return name;
      }
    }
  }
  return null;
}

/**
 * Dispatches the parsing logic to the appropriate handler based on the section's content type.
 *
 * - **Tree:** Delegates to `parseTreeSection` for hierarchical data.
 * - **List:** Delegates to `parseListSection` for flat lists.
 * - **TextBlock (Default):** Delegates to `parseTextBlockSection` if no content structure is defined.
 *
 * @param cursor - The paragraph cursor.
 * @param section - The section definition containing the content schema.
 * @returns The parsed result (String, Array, or Object depending on the type).
 */
export function parseSectionContent(
  cursor: ParagraphCursor,
  section: Section
): unknown {
  const content = section.content;

  if (!content) {
    return parseTextBlockSection(cursor);
  }

  switch (content.kind) {
    case "tree": {
      if (!content.node) {
        return [];
      }
      const allNodeTitleStyles = new Set<NamedStyleType>();
      collectNodeStylesRecursive(content.node, allNodeTitleStyles);
      return parseTreeSection(cursor, section, allNodeTitleStyles);
    }
    case "list":
      return parseListSection(cursor, section);
    default:
      return parseTextBlockSection(cursor);
  }
}
