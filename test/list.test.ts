import { describe, it, expect } from "vitest";
import { Section, ParseSchema, Content } from "../src/types";
import { ParagraphCursor } from "../src/cursor";
import { parseListSection } from "../src/list";
import { createMockParagraph } from "./helpers/factories";

describe("parseListSection", () => {
  const dummySchema: ParseSchema = { sections: [] };

  // ======================================================================
  // 1. Basic List Parsing (Flatten vs Nested)
  // ======================================================================
  /**
   * Verifies the fundamental parsing behavior: whether to merge results into
   * a single array (flatten) or preserve the line-by-line structure.
   */
  describe("Basic Parsing Modes", () => {
    it("should flatten multi-line arrays into a single array when isFlatten is true", () => {
      // Arrange
      const sectionSchema: Section = {
        title: { name: "Skills", namedStyleType: "HEADING_2" },
        content: { kind: "list", delimiter: ",", isFlatten: true },
      };

      const paragraphs = [
        createMockParagraph({ text: "Java, Kotlin" }).paragraph,
        createMockParagraph({ text: "Python, Go" }).paragraph,
        createMockParagraph({ text: "Rust" }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, dummySchema);

      // Act
      const result = parseListSection(cursor, sectionSchema);

      // Assert: ["Java", "Kotlin"] + ["Python", "Go"] + ["Rust"]
      expect(result).toEqual(["Java", "Kotlin", "Python", "Go", "Rust"]);
    });

    it("should preserve line grouping as nested arrays when isFlatten is false", () => {
      // Arrange
      const sectionSchema: Section = {
        title: { name: "History", namedStyleType: "HEADING_2" },
        content: { kind: "list", delimiter: ",", isFlatten: false },
      };

      const paragraphs = [
        createMockParagraph({ text: "A, B, C" }).paragraph,
        createMockParagraph({ text: "D, E" }).paragraph,
        createMockParagraph({ text: "F" }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, dummySchema);

      // Act
      const result = parseListSection(cursor, sectionSchema);

      // Assert: [ ["A", "B", "C"], ["D", "E"], ["F"] ]
      expect(result).toEqual([["A", "B", "C"], ["D", "E"], ["F"]]);
    });
  });

  // ======================================================================
  // 2. Termination Conditions
  // ======================================================================
  /**
   * Verifies that the parser stops correctly when encountering new sections,
   * unknown headings, or the end of the document.
   */
  describe("Termination Logic", () => {
    const sectionSchema: Section = {
      title: { name: "Current", namedStyleType: "HEADING_2" },
      content: { kind: "list" },
    };
    const nextSectionSchema: Section = {
      title: { name: "Next", namedStyleType: "HEADING_2" },
    };
    const multiSectionSchema: ParseSchema = {
      sections: [sectionSchema, nextSectionSchema],
    };

    it("should stop parsing when a new section title is encountered", () => {
      // Arrange
      const paragraphs = [
        createMockParagraph({ text: "Item A" }).paragraph,
        createMockParagraph({ text: "Next", namedStyleType: "HEADING_2" })
          .paragraph,
        createMockParagraph({ text: "Item B" }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, multiSectionSchema);

      // Act
      const result = parseListSection(cursor, sectionSchema);

      // Assert
      expect(result).toEqual([["Item A"]]);
    });

    it("should stop parsing when any named heading (not in schema) is encountered", () => {
      // Arrange
      const paragraphs = [
        createMockParagraph({ text: "Item 1" }).paragraph,
        createMockParagraph({ text: "Unexpected", namedStyleType: "HEADING_3" })
          .paragraph,
        createMockParagraph({ text: "Item 2" }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, multiSectionSchema);

      // Act
      const result = parseListSection(cursor, sectionSchema);

      // Assert
      expect(result).toEqual([["Item 1"]]);
    });

    it("should return an empty array if the cursor starts at a new section immediately", () => {
      // Arrange
      const paragraphs = [
        createMockParagraph({ text: "Next", namedStyleType: "HEADING_2" })
          .paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, multiSectionSchema);

      // Act
      const result = parseListSection(cursor, sectionSchema);

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ======================================================================
  // 3. Complex Structures & Object Handling
  // ======================================================================
  /**
   * Tests how the list parser interacts with structured data types
   * like KeyedLists or DelimitedFields, especially regarding flattening.
   */
  describe("Complex Structures", () => {
    it("should NOT flatten if the parsed result is an object (Keyed List), even if isFlatten is true", () => {
      // Arrange
      const sectionSchema: Section = {
        title: { name: "Mixed", namedStyleType: "HEADING_2" },
        content: { kind: "list", keyDelimiter: ":", isFlatten: true },
      };

      const paragraphs = [createMockParagraph({ text: "Lang: JS" }).paragraph];
      const cursor = new ParagraphCursor(paragraphs, dummySchema);

      // Act
      const result = parseListSection(cursor, sectionSchema);

      // Assert
      expect(result).toEqual([{ key: "Lang", value: ["JS"] }]);
    });

    it("should NOT flatten if the parsed result is an object (Delimited Fields)", () => {
      // Arrange
      const sectionSchema: Section = {
        title: { name: "Education", namedStyleType: "HEADING_2" },
        content: {
          kind: "list",
          keys: ["school", "major", "period"],
          delimiter: "|",
          isFlatten: true,
        },
      };

      const paragraphs = [
        createMockParagraph({ text: "MIT | CS | 2020-2024" }).paragraph,
        createMockParagraph({ text: "Stanford | AI | 2024-2026" }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, dummySchema);

      // Act
      const result = parseListSection(cursor, sectionSchema);

      // Assert
      expect(result).toEqual([
        { school: "MIT", major: "CS", period: "2020-2024" },
        { school: "Stanford", major: "AI", period: "2024-2026" },
      ]);
    });
  });

  // ======================================================================
  // 4. Edge Cases & Robustness
  // ======================================================================
  describe("Edge Cases & Robustness", () => {
    const listSchema: Section = {
      title: { name: "Test", namedStyleType: "HEADING_2" },
      content: { kind: "list", delimiter: ",", isFlatten: true },
    };

    it("should skip empty paragraphs (null info) and continue parsing", () => {
      // Arrange
      const paragraphs = [
        createMockParagraph({ text: "" }).paragraph,
        createMockParagraph({ text: "Item A" }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, dummySchema);

      // Act
      const result = parseListSection(cursor, listSchema);

      // Assert
      expect(result).toEqual(["Item A"]);
    });

    it("should ignore items that parse into empty strings (e.g., text only containing delimiters)", () => {
      // Arrange
      const paragraphs = [createMockParagraph({ text: ",," }).paragraph];
      const cursor = new ParagraphCursor(paragraphs, dummySchema);

      // Act
      const result = parseListSection(cursor, listSchema);

      // Assert
      expect(result).toEqual([]);
    });

    it("should return an empty array immediately if the document is empty", () => {
      // Arrange
      const cursor = new ParagraphCursor([], dummySchema);

      // Act
      const result = parseListSection(cursor, listSchema);

      // Assert
      expect(result).toEqual([]);
    });

    it("should return an empty array if section content kind is NOT 'list' (Guard Clause)", () => {
      // Arrange
      const invalidSectionSchema: Section = {
        title: { name: "Oops", namedStyleType: "HEADING_2" },
        content: { kind: "tree" } as Content,
      };
      const paragraphs = [createMockParagraph({ text: "Item" }).paragraph];
      const cursor = new ParagraphCursor(paragraphs, dummySchema);

      // Act
      const result = parseListSection(cursor, invalidSectionSchema);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
