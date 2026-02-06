import { describe, it, expect, beforeEach } from "vitest";
import type { docs_v1 } from "googleapis";
import { ParseSchema } from "../src/types";
import { ParagraphCursor, getParagraph } from "../src/cursor";
import { createMockParagraph } from "./helpers/factories";

// ======================================================================
// 1. Helper Function: getParagraph
// ======================================================================
/**
 * Tests the helper function that extracts usable data (text, style)
 * from the raw Google Docs Paragraph object.
 */
describe("getParagraph", () => {
  it("should extract text and style correctly from a valid paragraph", () => {
    // Arrange
    const MOCK_TEXT = "Test Content";
    const MOCK_STYLE = "HEADING_1";
    const mockElement = createMockParagraph({
      text: MOCK_TEXT,
      namedStyleType: MOCK_STYLE,
    });

    // Act
    const result = getParagraph(mockElement.paragraph);

    // Assert
    expect(result).toEqual({
      text: MOCK_TEXT,
      style: MOCK_STYLE,
      paragraph: mockElement.paragraph,
    });
  });

  it("should default the style to 'NORMAL_TEXT' if namedStyleType is missing", () => {
    // Arrange
    const MOCK_TEXT = "No Style Text";
    const rawParagraph: docs_v1.Schema$Paragraph = {
      elements: [{ textRun: { content: MOCK_TEXT } }],
    };

    // Act
    const result = getParagraph(rawParagraph);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.style).toBe("NORMAL_TEXT");
  });

  describe("Edge Cases (Empty & Whitespace)", () => {
    it("should return null if the paragraph contains no text", () => {
      const mockElement = createMockParagraph({ text: "" });
      expect(getParagraph(mockElement.paragraph)).toBeNull();
    });

    it("should return null if the paragraph contains only whitespace", () => {
      const mockElement = createMockParagraph({ text: "   \t   " });
      expect(getParagraph(mockElement.paragraph)).toBeNull();
    });

    it("should return null if the paragraph contains only newline characters", () => {
      const mockElement = createMockParagraph({ text: "\n" });
      expect(getParagraph(mockElement.paragraph)).toBeNull();
    });
  });
});

// ======================================================================
// 2. Class: ParagraphCursor - Navigation & State
// ======================================================================
/**
 * Verifies the navigation logic (moving index) and state management.
 */
describe("ParagraphCursor - Navigation", () => {
  const MOCK_SCHEMA: ParseSchema = { sections: [] };
  let simpleParagraphs: docs_v1.Schema$Paragraph[];

  beforeEach(() => {
    simpleParagraphs = [
      createMockParagraph({ text: "Line 1" }).paragraph,
      createMockParagraph({ text: "Line 2" }).paragraph,
      createMockParagraph({ text: "Line 3" }).paragraph,
    ];
  });

  it("should start at index 0 and return the first paragraph", () => {
    const cursor = new ParagraphCursor(simpleParagraphs, MOCK_SCHEMA);

    expect(cursor.isEndOfDocument()).toBe(false);
    expect(cursor.getCurrentParagraph()?.text).toBe("Line 1");
  });

  it("should advance to the next paragraph sequentially", () => {
    const cursor = new ParagraphCursor(simpleParagraphs, MOCK_SCHEMA);

    expect(cursor.getNextParagraph()?.text).toBe("Line 2");
    expect(cursor.getNextParagraph()?.text).toBe("Line 3");

    expect(cursor.getNextParagraph()).toBeNull();
    expect(cursor.isEndOfDocument()).toBe(true);
  });

  it("should return null but consume the index when encountering an empty paragraph", () => {
    // Arrange: [Valid, Empty, Valid]
    const mixedParagraphs = [
      createMockParagraph({ text: "Start" }).paragraph,
      createMockParagraph({ text: "" }).paragraph, // Empty Line
      createMockParagraph({ text: "End" }).paragraph,
    ];
    const cursor = new ParagraphCursor(mixedParagraphs, MOCK_SCHEMA);

    // Act & Assert
    expect(cursor.getCurrentParagraph()?.text).toBe("Start");

    const emptyStep = cursor.getNextParagraph();
    expect(emptyStep).toBeNull();
    expect(cursor.isEndOfDocument()).toBe(false);

    const finalStep = cursor.getNextParagraph();
    expect(finalStep?.text).toBe("End");
  });

  it("should remain idempotent when calling getCurrentParagraph multiple times", () => {
    const cursor = new ParagraphCursor(simpleParagraphs, MOCK_SCHEMA);

    expect(cursor.getCurrentParagraph()?.text).toBe("Line 1");
    expect(cursor.getCurrentParagraph()?.text).toBe("Line 1");

    expect(cursor.getNextParagraph()?.text).toBe("Line 2");
  });
});

// ======================================================================
// 3. Class: ParagraphCursor - Edge Cases (Robustness)
// ======================================================================
describe("ParagraphCursor - Edge Cases", () => {
  const MOCK_SCHEMA: ParseSchema = { sections: [] };

  it("should handle an empty document array correctly", () => {
    const cursor = new ParagraphCursor([], MOCK_SCHEMA);

    expect(cursor.isEndOfDocument()).toBe(true);
    expect(cursor.getCurrentParagraph()).toBeNull();
    expect(cursor.getNextParagraph()).toBeNull();
  });

  it("should safely handle repeated calls after document end", () => {
    const cursor = new ParagraphCursor([], MOCK_SCHEMA);

    cursor.getNextParagraph();
    cursor.getNextParagraph();

    expect(cursor.isEndOfDocument()).toBe(true);
    expect(cursor.getNextParagraph()).toBeNull();
  });

  it("should handle a document ending with an empty paragraph", () => {
    // Arrange: [Valid, Empty]
    const paragraphs = [
      createMockParagraph({ text: "Last Valid" }).paragraph,
      createMockParagraph({ text: "" }).paragraph,
    ];
    const cursor = new ParagraphCursor(paragraphs, MOCK_SCHEMA);

    // Act & Assert
    expect(cursor.getCurrentParagraph()?.text).toBe("Last Valid");

    expect(cursor.getNextParagraph()).toBeNull();

    expect(cursor.getNextParagraph()).toBeNull();
    expect(cursor.isEndOfDocument()).toBe(true);
  });
});

// ======================================================================
// 4. Class: ParagraphCursor - Context Analysis
// ======================================================================
/**
 * Verifies context detection logic:
 * - isAtParagraphHeading (Style check)
 * - isAtNewSection (Schema matching)
 */
describe("ParagraphCursor - Context Analysis", () => {
  describe("isAtParagraphHeading", () => {
    it("should return true for named headings (HEADING_1 ~ HEADING_6)", () => {
      const mockElement = createMockParagraph({
        text: "Title",
        namedStyleType: "HEADING_1",
      });
      const cursor = new ParagraphCursor([mockElement.paragraph], {
        sections: [],
      });

      expect(cursor.isAtParagraphHeading()).toBe(true);
    });

    it("should return true for special headings (TITLE, SUBTITLE)", () => {
      const titleElement = createMockParagraph({
        text: "T",
        namedStyleType: "TITLE",
      });
      const subElement = createMockParagraph({
        text: "S",
        namedStyleType: "SUBTITLE",
      });

      const cursorTitle = new ParagraphCursor([titleElement.paragraph], {
        sections: [],
      });
      const cursorSub = new ParagraphCursor([subElement.paragraph], {
        sections: [],
      });

      expect(cursorTitle.isAtParagraphHeading()).toBe(true);
      expect(cursorSub.isAtParagraphHeading()).toBe(true);
    });

    it("should return false for NORMAL_TEXT", () => {
      const mockElement = createMockParagraph({
        text: "Content",
        namedStyleType: "NORMAL_TEXT",
      });
      const cursor = new ParagraphCursor([mockElement.paragraph], {
        sections: [],
      });

      expect(cursor.isAtParagraphHeading()).toBe(false);
    });
  });

  describe("isAtNewSection (Schema Matching)", () => {
    const MOCK_SCHEMA: ParseSchema = {
      sections: [
        { title: { name: "Experience", namedStyleType: "HEADING_2" } },
      ],
    };

    it("should detect a new section when title and style match exactly", () => {
      const matchElement = createMockParagraph({
        text: "Experience",
        namedStyleType: "HEADING_2",
      });
      const cursor = new ParagraphCursor([matchElement.paragraph], MOCK_SCHEMA);

      expect(cursor.isAtNewSection()).toBe(true);
      expect(cursor.getCurrentSectionTitle()).toBe("Experience");
    });

    it("should detect a new section case-insensitively", () => {
      const caseMismatchElement = createMockParagraph({
        text: "EXPERIENCE",
        namedStyleType: "HEADING_2",
      });
      const cursor = new ParagraphCursor(
        [caseMismatchElement.paragraph],
        MOCK_SCHEMA
      );

      expect(cursor.isAtNewSection()).toBe(true);
      expect(cursor.getCurrentSectionTitle()).toBe("Experience");
    });

    it("should NOT detect if style matches but content is not in schema (Content Mismatch)", () => {
      const contentMismatchElement = createMockParagraph({
        text: "Education",
        namedStyleType: "HEADING_2",
      });
      const cursor = new ParagraphCursor(
        [contentMismatchElement.paragraph],
        MOCK_SCHEMA
      );

      expect(cursor.isAtNewSection()).toBe(false);
      expect(cursor.getCurrentSectionTitle()).toBeNull();
      expect(cursor.isAtParagraphHeading()).toBe(true);
    });

    it("should NOT detect if content matches but style is wrong (Style Mismatch)", () => {
      const styleMismatchElement = createMockParagraph({
        text: "Experience",
        namedStyleType: "NORMAL_TEXT",
      });
      const cursor = new ParagraphCursor(
        [styleMismatchElement.paragraph],
        MOCK_SCHEMA
      );

      expect(cursor.isAtNewSection()).toBe(false);
      expect(cursor.getCurrentSectionTitle()).toBeNull();
    });

    it("should return false for all checks if paragraph is null (empty line)", () => {
      const emptyElement = createMockParagraph({ text: "" });
      const cursor = new ParagraphCursor([emptyElement.paragraph], MOCK_SCHEMA);

      expect(cursor.isAtNewSection()).toBe(false);
      expect(cursor.isAtParagraphHeading()).toBe(false);
      expect(cursor.getCurrentSectionTitle()).toBeNull();
    });
  });
});
