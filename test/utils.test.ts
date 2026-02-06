import { describe, it, expect } from "vitest";
import type { docs_v1 } from "googleapis";
import { Title } from "../src/types";
import {
  extractParagraphText,
  hasNamedStyle,
  getParagraphNamedStyleType,
  isNamedStyleType,
  splitAndTrim,
  parseDelimitedList,
  parseToKeyedList,
  parseToFields,
  parseStructuredText,
} from "../src/utils";
import { createMockParagraph } from "./helpers/factories";
import { VALID_NAMED_STYLES } from "../src/constants";

// ======================================================================
// 1. Helper Function: extractParagraphText
// ======================================================================
/**
 * Verifies that text content is correctly extracted from Google Docs Paragraph objects,
 * handling multiple text runs, newlines, and empty elements.
 */
describe("extractParagraphText", () => {
  it("should extract text content from multiple text runs and trim whitespace", () => {
    // Arrange
    const paragraph: docs_v1.Schema$Paragraph = {
      elements: [
        { textRun: { content: "  Hello " } },
        { textRun: { content: "World  " } },
      ],
    };

    // Act
    const result = extractParagraphText(paragraph);

    // Assert
    expect(result).toBe("Hello World");
  });

  it("should replace newline characters (\\n) with spaces", () => {
    // Arrange
    const paragraph = createMockParagraph({ text: "Hello\nWorld\n" }).paragraph;

    // Act
    const result = extractParagraphText(paragraph);

    // Assert
    expect(result).toBe("Hello World");
  });

  it("should handle mixed elements (ignoring non-text content) and concatenate correctly", () => {
    // Arrange
    const paragraph: docs_v1.Schema$Paragraph = {
      elements: [
        { textRun: { content: "Start" } },
        { inlineObjectElement: {} },
        { textRun: {} },
        { textRun: { content: "End" } },
      ],
    };

    // Act
    const result = extractParagraphText(paragraph);

    // Assert
    expect(result).toBe("StartEnd");
  });

  it("should return an empty string if the paragraph or elements are empty", () => {
    expect(extractParagraphText({})).toBe("");
    expect(extractParagraphText({ elements: [] })).toBe("");
  });

  it("should return an empty string if the content consists only of whitespace", () => {
    const paragraph = createMockParagraph({ text: "   \n  " }).paragraph;
    expect(extractParagraphText(paragraph)).toBe("");
  });
});

// ======================================================================
// 2. Style Helpers: hasNamedStyle, getParagraphNamedStyleType, isNamedStyleType
// ======================================================================
/**
 * Verifies logic for checking and retrieving Google Docs Named Styles (Heading 1-6, Title, etc.).
 */
describe("Style Helpers", () => {
  describe("hasNamedStyle", () => {
    it("should return true if the paragraph matches the target style", () => {
      const paragraph = createMockParagraph({
        text: "Text",
        namedStyleType: "HEADING_1",
      }).paragraph;
      expect(hasNamedStyle(paragraph, "HEADING_1")).toBe(true);
    });

    it("should return false if the style does not match or is undefined", () => {
      const paragraph = createMockParagraph({
        text: "Text",
        namedStyleType: "HEADING_1",
      }).paragraph;
      expect(hasNamedStyle(paragraph, "HEADING_2")).toBe(false);
      expect(hasNamedStyle(paragraph, undefined)).toBe(false);
    });
  });

  describe("getParagraphNamedStyleType", () => {
    it("should return the correct namedStyleType if present", () => {
      const paragraph = createMockParagraph({
        text: "Text",
        namedStyleType: "HEADING_2",
      }).paragraph;
      expect(getParagraphNamedStyleType(paragraph)).toBe("HEADING_2");
    });

    it("should return 'NORMAL_TEXT' if style is missing but elements exist (default behavior)", () => {
      const paragraph: docs_v1.Schema$Paragraph = {
        elements: [{ textRun: { content: "Text" } }],
      };
      expect(getParagraphNamedStyleType(paragraph)).toBe("NORMAL_TEXT");
    });

    it("should return undefined if the paragraph is completely empty (no style, no content)", () => {
      const paragraph: docs_v1.Schema$Paragraph = {};
      expect(getParagraphNamedStyleType(paragraph)).toBeUndefined();
    });

    it("should return undefined for invalid or custom style strings", () => {
      const paragraph = createMockParagraph({
        text: "Text",
        namedStyleType: "SOME_CUSTOM_STYLE",
      }).paragraph;
      expect(getParagraphNamedStyleType(paragraph)).toBeUndefined();
    });
  });

  describe("isNamedStyleType", () => {
    it("should return true for valid heading styles (HEADING_1~6, TITLE, SUBTITLE)", () => {
      VALID_NAMED_STYLES.forEach((style) => {
        expect(isNamedStyleType(style)).toBe(true);
      });
    });

    it("should return false for 'NORMAL_TEXT' or invalid inputs", () => {
      expect(isNamedStyleType("NORMAL_TEXT")).toBe(false);
      expect(isNamedStyleType("INVALID")).toBe(false);
      expect(isNamedStyleType("")).toBe(false);
      expect(isNamedStyleType(undefined)).toBe(false);
    });
  });
});

// ======================================================================
// 3. String Helper: splitAndTrim
// ======================================================================
/**
 * Verifies the utility for splitting strings by a delimiter and trimming whitespace.
 */
describe("splitAndTrim", () => {
  it("should split by delimiter and trim whitespace from each item", () => {
    const text = "  Apple  ,  Banana  ,  Cherry  ";
    expect(splitAndTrim(text, ",")).toEqual(["Apple", "Banana", "Cherry"]);
  });

  it("should keep empty strings when filterEmpty is false (default)", () => {
    // Arrange
    const text = "A,,B";

    // Act
    const result = splitAndTrim(text, ",", false);

    // Assert
    expect(result).toEqual(["A", "", "B"]);
  });

  it("should remove empty strings when filterEmpty is true", () => {
    // Arrange
    const text = "A, ,B";

    // Act
    const result = splitAndTrim(text, ",", true);

    // Assert
    expect(result).toEqual(["A", "B"]);
  });

  it("should handle custom delimiters (e.g., pipe)", () => {
    expect(splitAndTrim("A | B", "|")).toEqual(["A", "B"]);
  });

  it("should return an empty array for empty input strings", () => {
    expect(splitAndTrim("", ",")).toEqual([]);
  });
});

// ======================================================================
// 4. Parsing Logic: Specific Parsers (Keyed, Fields, List)
// ======================================================================
/**
 * Verifies specific parsing strategies: Delimited Lists, Key-Value pairs, and Positional Fields.
 */
describe("Specific Parsing Functions", () => {
  describe("parseDelimitedList", () => {
    it("should split string and strictly filter out empty values", () => {
      const text = "Apple, , Banana,";
      expect(parseDelimitedList(text, ",")).toEqual(["Apple", "Banana"]);
    });

    it("should return empty array for strings containing only separators", () => {
      expect(parseDelimitedList(" , , ", ",")).toEqual([]);
    });
  });

  describe("parseToKeyedList", () => {
    it("should parse into key and value list structure", () => {
      // Arrange
      const text = "Skills: React, Vue";

      // Act
      const result = parseToKeyedList(text, ":", ",");

      // Assert
      expect(result).toEqual({ key: "Skills", value: ["React", "Vue"] });
    });

    it("should return empty value array if value part is missing", () => {
      expect(parseToKeyedList("Skills:", ":", ",")).toEqual({
        key: "Skills",
        value: [],
      });
    });

    it("should return the original text if the key delimiter is missing or at index 0", () => {
      expect(parseToKeyedList("No Key Here", ":", ",")).toBe("No Key Here");
      expect(parseToKeyedList(":Invalid Key", ":", ",")).toBe(":Invalid Key");
    });

    it("should split only on the first occurrence of the key delimiter", () => {
      const text = "Time: 10:00 AM";
      expect(parseToKeyedList(text, ":", ",")).toEqual({
        key: "Time",
        value: ["10:00 AM"],
      });
    });
  });

  describe("parseToFields", () => {
    const keys = ["company", "role", "year"];

    it("should map values to keys by position", () => {
      // Arrange
      const text = "Google | Engineer | 2023";

      // Act
      const result = parseToFields(text, keys, "|");

      // Assert
      expect(result).toEqual({
        company: "Google",
        role: "Engineer",
        year: "2023",
      });
    });

    it("should fill missing values with empty strings", () => {
      const text = "Google | Engineer";
      expect(parseToFields(text, keys, "|")).toEqual({
        company: "Google",
        role: "Engineer",
        year: "",
      });
    });

    it("should maintain empty strings for explicit gaps to preserve order", () => {
      const text = "Google || 2023";
      expect(parseToFields(text, keys, "|")).toEqual({
        company: "Google",
        role: "",
        year: "2023",
      });
    });

    it("should ignore extra values exceeding the number of keys", () => {
      const text = "Google | Engineer | 2023 | Extra";
      expect(parseToFields(text, keys, "|")).toEqual({
        company: "Google",
        role: "Engineer",
        year: "2023",
      });
    });
  });
});

// ======================================================================
// 5. Main Logic: parseStructuredText
// ======================================================================
/**
 * Verifies the main entry point for text parsing, ensuring correct priority
 * is given to different schema configurations (Keyed > Fields > List).
 */
describe("parseStructuredText", () => {
  // ----------------------------------------------------------------
  // Scenario A: Default List (Simple Array)
  // ----------------------------------------------------------------
  describe("Priority 3: Default List Parsing", () => {
    const schema: Title = { namedStyleType: "NORMAL_TEXT", delimiter: "," };

    it("should parse as a simple array using the delimiter", () => {
      const text = "Apple, Banana, Cherry";
      expect(parseStructuredText(text, schema)).toEqual([
        "Apple",
        "Banana",
        "Cherry",
      ]);
    });

    it("should filter out empty items", () => {
      const text = "Apple,, ,Banana";
      expect(parseStructuredText(text, schema)).toEqual(["Apple", "Banana"]);
    });

    it("should use comma (,) as default delimiter if none is provided", () => {
      const noDelimSchema: Title = { namedStyleType: "NORMAL_TEXT" };
      expect(parseStructuredText("A, B", noDelimSchema)).toEqual(["A", "B"]);
    });
  });

  // ----------------------------------------------------------------
  // Scenario B: Keyed List
  // ----------------------------------------------------------------
  describe("Priority 1: Keyed List Parsing", () => {
    const schema: Title = {
      namedStyleType: "NORMAL_TEXT",
      keyDelimiter: ":",
      delimiter: ",",
    };

    it("should parse as a Keyed List if keyDelimiter is present in schema", () => {
      const text = "Skills: React, Vue";
      expect(parseStructuredText(text, schema)).toEqual({
        key: "Skills",
        value: ["React", "Vue"],
      });
    });

    it("should return original text if keyDelimiter is missing in text (fallback)", () => {
      const text = "Just plain text";
      expect(parseStructuredText(text, schema)).toBe("Just plain text");
    });

    it("should handle multi-character key delimiters", () => {
      const customSchema: Title = {
        namedStyleType: "NORMAL_TEXT",
        keyDelimiter: "::",
        delimiter: ",",
      };
      expect(parseStructuredText("Meta:: React, Vue", customSchema)).toEqual({
        key: "Meta",
        value: ["React", "Vue"],
      });
    });
  });

  // ----------------------------------------------------------------
  // Scenario C: Delimited Fields
  // ----------------------------------------------------------------
  describe("Priority 2: Delimited Fields Parsing", () => {
    const schema: Title = {
      namedStyleType: "NORMAL_TEXT",
      keys: ["company", "role"],
      delimiter: "|",
    };

    it("should parse as Fields if keys are present in schema", () => {
      const text = "Google | Engineer";
      expect(parseStructuredText(text, schema)).toEqual({
        company: "Google",
        role: "Engineer",
      });
    });

    it("should handle empty strings by returning empty fields", () => {
      expect(parseStructuredText("", schema)).toEqual({
        company: "",
        role: "",
      });
    });

    it("should prioritize Keyed List over Fields if both are configured", () => {
      // Arrange
      const mixedSchema: Title = {
        namedStyleType: "NORMAL_TEXT",
        keyDelimiter: ":",
        keys: ["company", "role"],
        delimiter: ",",
      };

      // Act
      const text = "Company: Google, Engineer";
      const result = parseStructuredText(text, mixedSchema);

      // Assert
      expect(result).toEqual({
        key: "Company",
        value: ["Google", "Engineer"],
      });
    });
  });
});
