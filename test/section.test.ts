import { describe, it, expect } from "vitest";
import { ParseSchema, Section } from "../src/types";
import { ParagraphCursor } from "../src/cursor";
import { getSectionTitle, parseSectionContent } from "../src/section";
import { createMockParagraph } from "./helpers/factories";

// ======================================================================
// 1. getSectionTitle (Section Identification Logic)
// ======================================================================
/**
 * Verifies if the function correctly identifies a section title based on
 * the schema (text content + style) matching.
 */
describe("getSectionTitle", () => {
  it("should match when both text and namedStyleType are identical", () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Skills", namedStyleType: "HEADING_2" } }],
    };
    const paragraph = createMockParagraph({
      text: "Skills",
      namedStyleType: "HEADING_2",
    }).paragraph;

    // Act
    const result = getSectionTitle(paragraph, "Skills", schema);

    // Assert
    expect(result).toBe("Skills");
  });

  it("should match case-insensitively", () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [
        { title: { name: "Experience", namedStyleType: "HEADING_2" } },
      ],
    };
    const paragraph = createMockParagraph({
      text: "experience",
      namedStyleType: "HEADING_2",
    }).paragraph;

    // Act
    const result = getSectionTitle(paragraph, "experience", schema);

    // Assert
    expect(result).toBe("Experience");
  });

  it("should match even with leading/trailing whitespace in input", () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Projects", namedStyleType: "HEADING_2" } }],
    };
    const paragraph = createMockParagraph({
      text: "  Projects  ",
      namedStyleType: "HEADING_2",
    }).paragraph;

    // Act
    const result = getSectionTitle(paragraph, "  Projects  ", schema);

    // Assert
    expect(result).toBe("Projects");
  });

  it("should return null if style matches but text does not", () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Education", namedStyleType: "HEADING_2" } }],
    };
    const paragraph = createMockParagraph({
      text: "Skills",
      namedStyleType: "HEADING_2",
    }).paragraph;

    // Act
    const result = getSectionTitle(paragraph, "Skills", schema);

    // Assert
    expect(result).toBeNull();
  });

  it("should return null if text matches but style does not", () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Education", namedStyleType: "HEADING_2" } }],
    };
    const paragraph = createMockParagraph({
      text: "Education",
      namedStyleType: "HEADING_1",
    }).paragraph;

    // Act
    const result = getSectionTitle(paragraph, "Education", schema);

    // Assert
    expect(result).toBeNull();
  });

  it("should return null if schema sections are empty or undefined", () => {
    // Arrange
    const emptySchema: ParseSchema = { sections: [] };
    const undefinedSchema = {} as ParseSchema;

    const paragraph = createMockParagraph({
      text: "Any",
      namedStyleType: "HEADING_2",
    }).paragraph;

    // Act & Assert
    expect(getSectionTitle(paragraph, "Any", emptySchema)).toBeNull();
    expect(getSectionTitle(paragraph, "Any", undefinedSchema)).toBeNull();
  });

  it("should return null if schema definition is incomplete (missing name or style)", () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [
        { title: { namedStyleType: "HEADING_2" } },
        // @ts-ignore: Intentionally invalid type
        { title: { name: "NoStyle" } },
      ],
    };
    const paragraph = createMockParagraph({
      text: "NoStyle",
      namedStyleType: "HEADING_2",
    }).paragraph;

    // Act
    const result = getSectionTitle(paragraph, "NoStyle", schema);

    // Assert
    expect(result).toBeNull();
  });

  it("should find the first matching section if multiple definitions exist", () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [
        { title: { name: "Intro", namedStyleType: "HEADING_2" } },
        { title: { name: "Skills", namedStyleType: "HEADING_2" } },
        { title: { name: "Experience", namedStyleType: "HEADING_2" } },
      ],
    };
    const paragraph = createMockParagraph({
      text: "Skills",
      namedStyleType: "HEADING_2",
    }).paragraph;

    // Act
    const result = getSectionTitle(paragraph, "Skills", schema);

    // Assert
    expect(result).toBe("Skills");
  });
});

// ======================================================================
// 2. parseSectionContent (Dispatcher Logic)
// ======================================================================
/**
 * Verifies if the function correctly delegates parsing to specific
 * handlers (TextBlock, List, Tree) based on the section configuration.
 */
describe("parseSectionContent", () => {
  const dummySchema: ParseSchema = { sections: [] };

  it("should delegate to TextBlock parser if 'content' is undefined", () => {
    // Arrange
    const section: Section = {
      title: { name: "Summary", namedStyleType: "HEADING_2" },
    };
    const paragraphs = [
      createMockParagraph({ text: "Line 1" }).paragraph,
      createMockParagraph({ text: "Line 2" }).paragraph,
    ];
    const cursor = new ParagraphCursor(paragraphs, dummySchema);

    // Act
    const result = parseSectionContent(cursor, section);

    // Assert
    expect(result).toBe("Line 1 Line 2");
  });

  it("should delegate to List parser if 'content.kind' is 'list'", () => {
    // Arrange
    const section: Section = {
      title: { name: "Skills", namedStyleType: "HEADING_2" },
      content: { kind: "list", delimiter: ",", isFlatten: true },
    };
    const paragraphs = [
      createMockParagraph({ text: "React, Vue, Angular" }).paragraph,
    ];
    const cursor = new ParagraphCursor(paragraphs, dummySchema);

    // Act
    const result = parseSectionContent(cursor, section);

    // Assert
    expect(result).toEqual(["React", "Vue", "Angular"]);
  });

  it("should delegate to Tree parser if 'content.kind' is 'tree'", () => {
    // Arrange
    const section: Section = {
      title: { name: "Experience", namedStyleType: "HEADING_2" },
      content: {
        kind: "tree",
        node: { title: { namedStyleType: "HEADING_3" } },
      },
    };
    const paragraphs = [
      createMockParagraph({ text: "Job Title", namedStyleType: "HEADING_3" })
        .paragraph,
      createMockParagraph({ text: "Details" }).paragraph,
    ];
    const cursor = new ParagraphCursor(paragraphs, dummySchema);

    // Act
    const result = parseSectionContent(cursor, section);

    // Assert
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(1);
    expect((result as unknown[])[0]).toEqual({
      title: "Job Title",
      content: ["Details"],
    });
  });

  it("should fallback to TextBlock parser if 'content.kind' is unknown", () => {
    // Arrange
    const section: Section = {
      title: { name: "Unknown", namedStyleType: "HEADING_2" },
      content: {
        // @ts-ignore: Testing invalid kind
        kind: "unknown_type",
      },
    };
    const paragraphs = [
      createMockParagraph({ text: "Fallback Text" }).paragraph,
    ];
    const cursor = new ParagraphCursor(paragraphs, dummySchema);

    // Act
    const result = parseSectionContent(cursor, section);

    // Assert
    expect(result).toBe("Fallback Text");
  });

  it("should return empty array if 'tree' content is missing 'node' definition", () => {
    // Arrange
    const section: Section = {
      title: { name: "Broken", namedStyleType: "HEADING_2" },
      content: { kind: "tree" } as any,
    };
    const paragraphs = [createMockParagraph({ text: "Some text" }).paragraph];
    const cursor = new ParagraphCursor(paragraphs, dummySchema);

    // Act
    const result = parseSectionContent(cursor, section);

    // Assert
    expect(result).toEqual([]);
  });
});
