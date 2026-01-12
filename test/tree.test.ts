import { describe, it, expect } from "vitest";
import {
  NamedStyleType,
  Node,
  Section,
  ParseSchema,
  Schema,
} from "../src/types";
import { ParagraphCursor } from "../src/cursor";
import {
  collectNodeStylesRecursive,
  createNodeFromTitle,
  parseTreeSection,
} from "../src/tree";
import { createMockParagraph } from "./helpers/factories";

// ======================================================================
// 1. Helper Function: collectNodeStylesRecursive
// ======================================================================
/**
 * Verifies that the function correctly traverses the nested schema
 * and collects all Heading Styles (e.g., H3, H4) used in the tree.
 */
describe("collectNodeStylesRecursive", () => {
  it("should collect all heading styles from a nested tree schema", () => {
    // Arrange
    const nodeSchema: Node = {
      title: { namedStyleType: "HEADING_3" },
      content: {
        kind: "tree",
        node: {
          title: { namedStyleType: "HEADING_4" },
          content: {
            kind: "tree",
            node: {
              title: { namedStyleType: "HEADING_5" },
              content: { kind: "list" },
            },
          },
        },
      },
    };
    const styleSet = new Set<NamedStyleType>();

    // Act
    collectNodeStylesRecursive(nodeSchema, styleSet);

    // Assert
    expect(styleSet.has("HEADING_3")).toBe(true);
    expect(styleSet.has("HEADING_4")).toBe(true);
    expect(styleSet.has("HEADING_5")).toBe(true);
    expect(styleSet.has("HEADING_2")).toBe(false);
    expect(styleSet.size).toBe(3);
  });
});

// ======================================================================
// 2. Helper Function: createNodeFromTitle
// ======================================================================
/**
 * Verifies that title text is correctly converted into a Node object,
 * handling simple strings vs. structured data (KeyedList/Delimited).
 */
describe("createNodeFromTitle", () => {
  it("should create a simple node for plain text titles", () => {
    // Arrange
    const titleSchema = { namedStyleType: "HEADING_3" } as Schema;
    const text = "My Project";

    // Act
    const result = createNodeFromTitle(text, titleSchema);

    // Assert
    expect(result).toEqual({ title: "My Project", content: [] });
  });

  it("should parse keyed titles if keyDelimiter is provided", () => {
    // Arrange
    const titleSchema = {
      namedStyleType: "HEADING_3",
      keyDelimiter: ":",
    };
    const text = "Project: Alpha";

    // Act
    const result = createNodeFromTitle(text, titleSchema);

    // Assert
    expect(result).toEqual({
      title: { key: "Project", value: ["Alpha"] },
      content: [],
    });
  });

  it("should parse delimited titles if delimiter/keys are provided", () => {
    // Arrange
    const titleSchema = {
      namedStyleType: "HEADING_3",
      keys: ["role", "period"],
      delimiter: "|",
    };
    const text = "Engineer | 2024";

    // Act
    const result = createNodeFromTitle(text, titleSchema);

    // Assert
    expect(result).toEqual({
      title: { role: "Engineer", period: "2024" },
      content: [],
    });
  });
});

// ======================================================================
// 3. Core Logic: parseTreeSection (Recursive Parsing)
// ======================================================================
/**
 * Verifies the main parsing logic, including nesting (recursion),
 * sibling nodes, and content collection.
 */
describe("parseTreeSection", () => {
  const dummySchema: ParseSchema = { sections: [] };

  const createTreeSection = (node: Node): Section => ({
    title: { name: "Root", namedStyleType: "HEADING_2" },
    content: { kind: "tree", node },
  });

  it("should parse a simple 1-level tree (Heading -> List Content)", () => {
    // Arrange
    const section = createTreeSection({
      title: { namedStyleType: "HEADING_3" },
      content: { kind: "list" },
    });
    const allStyles = new Set<NamedStyleType>(["HEADING_3"]);

    const paragraphs = [
      createMockParagraph({ text: "Node 1", namedStyleType: "HEADING_3" })
        .paragraph,
      createMockParagraph({ text: "- Item A" }).paragraph,
      createMockParagraph({ text: "Node 2", namedStyleType: "HEADING_3" })
        .paragraph,
      createMockParagraph({ text: "- Item B" }).paragraph,
    ];
    const cursor = new ParagraphCursor(paragraphs, dummySchema);

    // Act
    const result = parseTreeSection(cursor, section, allStyles);

    // Assert
    expect(result).toEqual([
      { title: "Node 1", content: ["- Item A"] },
      { title: "Node 2", content: ["- Item B"] },
    ]);
  });

  it("should parse a nested 2-level tree (H3 -> H4 -> List Content)", () => {
    // Arrange
    const section = createTreeSection({
      title: { namedStyleType: "HEADING_3" },
      content: {
        kind: "tree",
        node: {
          title: { namedStyleType: "HEADING_4" },
          content: { kind: "list" },
        },
      },
    });
    const allStyles = new Set<NamedStyleType>(["HEADING_3", "HEADING_4"]);

    const paragraphs = [
      createMockParagraph({ text: "Parent A", namedStyleType: "HEADING_3" })
        .paragraph,
      createMockParagraph({ text: "Child A-1", namedStyleType: "HEADING_4" })
        .paragraph,
      createMockParagraph({ text: "Detail 1" }).paragraph,
      createMockParagraph({ text: "Parent B", namedStyleType: "HEADING_3" })
        .paragraph,
      createMockParagraph({ text: "Child B-1", namedStyleType: "HEADING_4" })
        .paragraph,
    ];
    const cursor = new ParagraphCursor(paragraphs, dummySchema);

    // Act
    const result = parseTreeSection(cursor, section, allStyles);

    // Assert
    expect(result).toEqual([
      {
        title: "Parent A",
        content: [{ title: "Child A-1", content: ["Detail 1"] }],
      },
      {
        title: "Parent B",
        content: [{ title: "Child B-1", content: [] }],
      },
    ]);
  });

  it("should ignore orphan text before the first root node", () => {
    // Arrange
    const section = createTreeSection({
      title: { namedStyleType: "HEADING_3" },
      content: { kind: "list" },
    });
    const allStyles = new Set<NamedStyleType>(["HEADING_3"]);

    const paragraphs = [
      createMockParagraph({ text: "Orphan Text" }).paragraph,
      createMockParagraph({ text: "Root Node", namedStyleType: "HEADING_3" })
        .paragraph,
      createMockParagraph({ text: "Valid Content" }).paragraph,
    ];
    const cursor = new ParagraphCursor(paragraphs, dummySchema);

    // Act
    const result = parseTreeSection(cursor, section, allStyles);

    // Assert
    expect(result).toEqual([
      { title: "Root Node", content: ["Valid Content"] },
    ]);
  });
});

// ======================================================================
// 4. Termination & Edge Cases
// ======================================================================
/**
 * Verifies robust handling of boundaries: new sections, unexpected headings,
 * and strict content rules.
 */
describe("parseTreeSection - Termination & Rules", () => {
  const dummySchema: ParseSchema = { sections: [] };
  const allStyles = new Set<NamedStyleType>(["HEADING_3", "HEADING_4"]);

  const createH3H4Section = (): Section => ({
    title: { name: "Root", namedStyleType: "HEADING_2" },
    content: {
      kind: "tree",
      node: {
        title: { namedStyleType: "HEADING_3" },
        content: {
          kind: "tree",
          node: {
            title: { namedStyleType: "HEADING_4" },
            content: { kind: "list" },
          },
        },
      },
    },
  });

  it("should stop parsing when a new section (H2) starts", () => {
    // Arrange
    const section = createH3H4Section();
    const parseSchemaWithNext: ParseSchema = {
      sections: [
        section,
        { title: { name: "Next", namedStyleType: "HEADING_2" } },
      ],
    };

    const paragraphs = [
      createMockParagraph({ text: "Node 1", namedStyleType: "HEADING_3" })
        .paragraph,
      createMockParagraph({ text: "Next", namedStyleType: "HEADING_2" })
        .paragraph,
    ];
    const cursor = new ParagraphCursor(paragraphs, parseSchemaWithNext);

    // Act
    const result = parseTreeSection(cursor, section, allStyles);

    // Assert
    expect(result).toEqual([{ title: "Node 1", content: [] }]);
  });

  it("should stop parsing current node if a higher-level heading (H3) appears while parsing child (H4)", () => {
    // Arrange
    const section = createH3H4Section();
    const paragraphs = [
      createMockParagraph({ text: "Parent 1", namedStyleType: "HEADING_3" })
        .paragraph,
      createMockParagraph({ text: "Child 1", namedStyleType: "HEADING_4" })
        .paragraph,
      createMockParagraph({ text: "Parent 2", namedStyleType: "HEADING_3" })
        .paragraph,
    ];
    const cursor = new ParagraphCursor(paragraphs, dummySchema);

    // Act
    const result = parseTreeSection(cursor, section, allStyles);

    // Assert
    expect(result).toEqual([
      {
        title: "Parent 1",
        content: [{ title: "Child 1", content: [] }],
      },
      {
        title: "Parent 2",
        content: [],
      },
    ]);
  });

  it("should ignore direct text content if the node expects children (strict nesting)", () => {
    // Arrange
    const section = createH3H4Section();
    const paragraphs = [
      createMockParagraph({ text: "Parent", namedStyleType: "HEADING_3" })
        .paragraph,
      createMockParagraph({ text: "Invalid Text" }).paragraph,
      createMockParagraph({ text: "Child", namedStyleType: "HEADING_4" })
        .paragraph,
    ];
    const cursor = new ParagraphCursor(paragraphs, dummySchema);

    // Act
    const result = parseTreeSection(cursor, section, allStyles);

    // Assert
    expect(result).toEqual([
      {
        title: "Parent",
        content: [{ title: "Child", content: [] }],
      },
    ]);
  });

  it("should stop parsing if an undefined heading style (e.g., H5) is encountered", () => {
    // Arrange
    const section = createH3H4Section();
    const paragraphs = [
      createMockParagraph({ text: "Parent", namedStyleType: "HEADING_3" })
        .paragraph,
      createMockParagraph({ text: "Unexpected", namedStyleType: "HEADING_5" })
        .paragraph,
    ];
    const cursor = new ParagraphCursor(paragraphs, dummySchema);

    // Act
    const result = parseTreeSection(cursor, section, allStyles);

    // Assert
    expect(result).toEqual([{ title: "Parent", content: [] }]);
  });
});
