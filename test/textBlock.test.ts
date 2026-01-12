// text.test.ts
import { describe, it, expect } from "vitest";
import { docs_v1 } from "googleapis";
import { Section, ParseSchema } from "../src/types";
import { ParagraphCursor } from "../src/cursor";
import { parseTextBlockSection } from "../src/textBlock";
import { createMockParagraph } from "./helpers/factories";

// ======================================================================
// 1. Core Logic: parseTextBlockSection
// ======================================================================
/**
 * Verifies that the function collects sequential text paragraphs into a single block,
 * respecting section boundaries and heading interruptions.
 */
describe("parseTextBlockSection", () => {
  const dummySchema: ParseSchema = { sections: [] };

  describe("Basic Behavior", () => {
    it("should collect multiple lines of text and join them with spaces", () => {
      // Arrange
      const paragraphs = [
        createMockParagraph({ text: "Hello" }).paragraph,
        createMockParagraph({ text: "World" }).paragraph,
        createMockParagraph({ text: "Engineers" }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, dummySchema);

      // Act
      const result = parseTextBlockSection(cursor);

      // Assert
      expect(result).toBe("Hello World Engineers");
    });
  });

  describe("Stop Conditions", () => {
    it("should stop collecting when a new section defined in the schema is encountered", () => {
      // Arrange
      const sectionSchema: Section = {
        title: { name: "Next Section", namedStyleType: "HEADING_2" },
      };
      const parseSchemaWithSection: ParseSchema = {
        sections: [sectionSchema],
      };

      const paragraphs = [
        createMockParagraph({ text: "Hello" }).paragraph,
        createMockParagraph({
          text: "Next Section",
          namedStyleType: "HEADING_2",
        }).paragraph,
        createMockParagraph({ text: "Should not be included" }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, parseSchemaWithSection);

      // Act
      const result = parseTextBlockSection(cursor);

      // Assert
      expect(result).toBe("Hello");
    });

    it("should stop collecting when any paragraph heading (e.g., H3) is encountered", () => {
      // Arrange
      const paragraphs = [
        createMockParagraph({ text: "Hello" }).paragraph,
        createMockParagraph({
          text: "Some Heading",
          namedStyleType: "HEADING_3",
        }).paragraph,
        createMockParagraph({ text: "Should not be included" }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, dummySchema);

      // Act
      const result = parseTextBlockSection(cursor);

      // Assert
      expect(result).toBe("Hello");
    });

    it("should prioritize section boundaries over generic heading checks", () => {
      // Arrange
      const sectionSchema: Section = {
        title: { name: "Skills", namedStyleType: "HEADING_2" },
      };
      const parseSchemaWithSection: ParseSchema = {
        sections: [sectionSchema],
      };

      const paragraphs = [
        createMockParagraph({
          text: "Skills",
          namedStyleType: "HEADING_2",
        }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, parseSchemaWithSection);

      // Act
      const result = parseTextBlockSection(cursor);

      // Assert
      expect(result).toBe("");
    });
  });

  describe("Edge Cases", () => {
    it("should continue processing past empty text lines", () => {
      // Arrange
      const paragraphs = [
        createMockParagraph({ text: "Hello" }).paragraph,
        createMockParagraph({ text: "" }).paragraph,
        createMockParagraph({ text: "World" }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, dummySchema);

      // Act
      const result = parseTextBlockSection(cursor);

      // Assert
      expect(result).toBe("Hello World");
    });

    it("should return an empty string if the document is empty", () => {
      // Arrange
      const paragraphs: docs_v1.Schema$Paragraph[] = [];
      const cursor = new ParagraphCursor(paragraphs, dummySchema);

      // Act
      const result = parseTextBlockSection(cursor);

      // Assert
      expect(result).toBe("");
    });

    it("should return an empty string if the first paragraph triggers a stop condition (New Section)", () => {
      // Arrange
      const sectionSchema: Section = {
        title: { name: "New Section", namedStyleType: "HEADING_2" },
      };
      const parseSchemaWithSection: ParseSchema = {
        sections: [sectionSchema],
      };

      const paragraphs = [
        createMockParagraph({
          text: "New Section",
          namedStyleType: "HEADING_2",
        }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, parseSchemaWithSection);

      // Act
      const result = parseTextBlockSection(cursor);

      // Assert
      expect(result).toBe("");
    });

    it("should return an empty string if the first paragraph triggers a stop condition (Heading)", () => {
      // Arrange
      const paragraphs = [
        createMockParagraph({
          text: "Some Heading",
          namedStyleType: "HEADING_3",
        }).paragraph,
      ];
      const cursor = new ParagraphCursor(paragraphs, dummySchema);

      // Act
      const result = parseTextBlockSection(cursor);

      // Assert
      expect(result).toBe("");
    });
  });
});
