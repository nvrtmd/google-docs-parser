import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockParagraph, createMockDocument } from "./helpers/factories";
import { ParseSchema } from "../src/types";
import { getParsedDocument } from "../src/parser";

// ======================================================================
// Mocks: googleapis / google-auth-library
// ======================================================================

const mockDocsGet = vi.fn();
const mockCreateDocsClient = vi.fn();

vi.mock("../src/auth", () => {
  return {
    createDocsClient: (...args: unknown[]) => mockCreateDocsClient(...args),
  };
});

// ======================================================================
// 1. API Wrapper & Basic Error Handling
// ======================================================================
/**
 * Tests for the public API surface `getParsedDocument`.
 * Verifies network error handling, permission issues, and empty responses.
 */
describe("getParsedDocument - API & Error Handling", () => {
  beforeEach(() => {
    mockDocsGet.mockReset();
    mockCreateDocsClient.mockReturnValue({
      documents: { get: mockDocsGet },
    });
  });

  it("should throw a formatted error when the Google Docs API request fails", async () => {
    // Arrange
    const schema: ParseSchema = { sections: [] };
    mockDocsGet.mockRejectedValue(new Error("API Error: Not Found"));

    // Act & Assert
    await expect(getParsedDocument("invalid-doc-id", schema)).rejects.toThrow(
      "Google Docs API call failed. Check Doc ID and Service Account permissions. Original error: API Error: Not Found"
    );
  });

  it("should throw an error when the API returns an empty data object", async () => {
    // Arrange
    const schema: ParseSchema = { sections: [] };
    mockDocsGet.mockResolvedValue({ data: null });

    // Act & Assert
    await expect(
      getParsedDocument("empty-response-doc", schema)
    ).rejects.toThrow("Empty document response from Google Docs API.");
  });

  it("should return an empty object if the document body contains no paragraphs", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Intro", namedStyleType: "HEADING_2" } }],
    };
    const doc = createMockDocument([]); // Empty body
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("empty-doc", schema);

    // Assert
    expect(result).toEqual({});
  });
});

// ======================================================================
// 2. Section Resolution & Matching
// ======================================================================
/**
 * Tests how the parser identifies sections within the document.
 * Covers matching logic, case insensitivity, and skipping undefined sections.
 */
describe("getParsedDocument - Section Resolution", () => {
  beforeEach(() => {
    mockDocsGet.mockReset();
  });

  it("should match section titles case-insensitively (Spec: Case Insensitive)", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [
        { title: { name: "EXPERIENCE", namedStyleType: "HEADING_2" } },
      ],
    };
    // Document uses lowercase "experience"
    const doc = createMockDocument([
      createMockParagraph({ text: "experience", namedStyleType: "HEADING_2" }),
      createMockParagraph({
        text: "Worked at Google",
        namedStyleType: "NORMAL_TEXT",
      }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-case-insensitive", schema);

    // Assert: The key in the result should match the schema's defined name ("EXPERIENCE")
    expect(result).toEqual({
      EXPERIENCE: "Worked at Google",
    });
  });

  it("should ignore content belonging to sections not defined in the schema", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Allowed", namedStyleType: "HEADING_2" } }],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Allowed", namedStyleType: "HEADING_2" }),
      createMockParagraph({ text: "Content A", namedStyleType: "NORMAL_TEXT" }),
      createMockParagraph({
        text: "IgnoredSection",
        namedStyleType: "HEADING_2",
      }),
      createMockParagraph({ text: "Content B", namedStyleType: "NORMAL_TEXT" }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-undefined-sections", schema);

    // Assert
    expect(result).toEqual({ Allowed: "Content A" });
    expect(result).not.toHaveProperty("IgnoredSection");
  });

  it("should overwrite the content if duplicate sections appear (Last-Write-Wins)", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Notes", namedStyleType: "HEADING_2" } }],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Notes", namedStyleType: "HEADING_2" }),
      createMockParagraph({
        text: "First Draft",
        namedStyleType: "NORMAL_TEXT",
      }),
      createMockParagraph({ text: "Notes", namedStyleType: "HEADING_2" }),
      createMockParagraph({
        text: "Final Draft",
        namedStyleType: "NORMAL_TEXT",
      }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-duplicate-sections", schema);

    // Assert
    expect(result).toEqual({ Notes: "Final Draft" });
  });

  it("should handle sections containing leading/trailing whitespace in the document", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Summary", namedStyleType: "HEADING_2" } }],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "  Summary  ", namedStyleType: "HEADING_2" }),
      createMockParagraph({
        text: "Valid Content",
        namedStyleType: "NORMAL_TEXT",
      }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-whitespace-title", schema);

    // Assert
    expect(result).toEqual({ Summary: "Valid Content" });
  });
});

// ======================================================================
// 3. Content Mode: Text Blocks
// ======================================================================
/**
 * Tests for the default parsing mode: joining paragraphs into a string.
 */
describe("getParsedDocument - Mode: Text Block", () => {
  beforeEach(() => {
    mockDocsGet.mockReset();
  });

  it("should concatenate multiple NORMAL_TEXT paragraphs with spaces", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Intro", namedStyleType: "HEADING_2" } }],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Intro", namedStyleType: "HEADING_2" }),
      createMockParagraph({ text: "Hello.", namedStyleType: "NORMAL_TEXT" }),
      createMockParagraph({ text: "World.", namedStyleType: "NORMAL_TEXT" }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-text-block", schema);

    // Assert
    expect(result).toEqual({ Intro: "Hello. World." });
  });

  it("should return an empty string for a section with no content", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Empty", namedStyleType: "HEADING_2" } }],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Empty", namedStyleType: "HEADING_2" }),
      createMockParagraph({ text: "NextSection", namedStyleType: "HEADING_2" }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-empty-text", schema);

    // Assert
    expect(result).toEqual({ Empty: "" });
  });
});

// ======================================================================
// 4. Content Mode: Lists (Flat, Nested, Keyed, Delimited)
// ======================================================================
/**
 * Tests for parsing list structures.
 * Covers flattening, preserving structure, key-value pairs, and delimited strings.
 */
describe("getParsedDocument - Mode: Lists", () => {
  beforeEach(() => {
    mockDocsGet.mockReset();
  });

  it("should flatten a multi-line list into a single array when `isFlatten: true`", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [
        {
          title: { name: "Stack", namedStyleType: "HEADING_2" },
          content: { kind: "list", delimiter: ",", isFlatten: true },
        },
      ],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Stack", namedStyleType: "HEADING_2" }),
      createMockParagraph({ text: "A, B", namedStyleType: "NORMAL_TEXT" }),
      createMockParagraph({ text: "C", namedStyleType: "NORMAL_TEXT" }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-list-flatten", schema);

    // Assert
    expect(result).toEqual({ Stack: ["A", "B", "C"] });
  });

  it("should preserve line grouping as nested arrays when `isFlatten: false`", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [
        {
          title: { name: "Groups", namedStyleType: "HEADING_2" },
          content: { kind: "list", delimiter: ",", isFlatten: false },
        },
      ],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Groups", namedStyleType: "HEADING_2" }),
      createMockParagraph({
        text: "Front, Back",
        namedStyleType: "NORMAL_TEXT",
      }),
      createMockParagraph({ text: "Dev, Ops", namedStyleType: "NORMAL_TEXT" }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-list-nested", schema);

    // Assert
    expect(result).toEqual({
      Groups: [
        ["Front", "Back"],
        ["Dev", "Ops"],
      ],
    });
  });

  it("should parse 'Key: Value' lines into objects using `keyDelimiter`", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [
        {
          title: { name: "Info", namedStyleType: "HEADING_2" },
          content: { kind: "list", keyDelimiter: ":", delimiter: "," },
        },
      ],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Info", namedStyleType: "HEADING_2" }),
      createMockParagraph({
        text: "Name: John Doe",
        namedStyleType: "NORMAL_TEXT",
      }),
      createMockParagraph({
        text: "Roles: Admin, Editor",
        namedStyleType: "NORMAL_TEXT",
      }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-keyed-list", schema);

    // Assert
    expect(result).toEqual({
      Info: [
        { key: "Name", value: ["John Doe"] },
        { key: "Roles", value: ["Admin", "Editor"] },
      ],
    });
  });

  it("should parse delimiter-separated values into mapped objects (`keys`)", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [
        {
          title: { name: "History", namedStyleType: "HEADING_2" },
          content: { kind: "list", keys: ["year", "event"], delimiter: "|" },
        },
      ],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "History", namedStyleType: "HEADING_2" }),
      createMockParagraph({
        text: "2020 | Started",
        namedStyleType: "NORMAL_TEXT",
      }),
      createMockParagraph({
        text: "2021 | Launched",
        namedStyleType: "NORMAL_TEXT",
      }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-delimited-fields", schema);

    // Assert
    expect(result).toEqual({
      History: [
        { year: "2020", event: "Started" },
        { year: "2021", event: "Launched" },
      ],
    });
  });

  it("should handle missing fields in delimited lists by filling with empty strings", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [
        {
          title: { name: "Data", namedStyleType: "HEADING_2" },
          content: {
            kind: "list",
            keys: ["id", "val", "extra"],
            delimiter: "|",
          },
        },
      ],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Data", namedStyleType: "HEADING_2" }),
      createMockParagraph({ text: "001 | A", namedStyleType: "NORMAL_TEXT" }), // Missing 'extra'
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-delimited-missing", schema);

    // Assert
    expect(result).toEqual({
      Data: [{ id: "001", val: "A", extra: "" }],
    });
  });
});

// ======================================================================
// 5. Content Mode: Tree Structures
// ======================================================================
/**
 * Tests for recursive tree parsing.
 * Verifies nesting logic, heading level boundaries, and orphan handling.
 */
describe("getParsedDocument - Mode: Tree", () => {
  beforeEach(() => {
    mockDocsGet.mockReset();
  });

  it("should parse a 2-level nested tree (H3 -> H4)", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [
        {
          title: { name: "Projects", namedStyleType: "HEADING_2" },
          content: {
            kind: "tree",
            node: {
              title: { namedStyleType: "HEADING_3", keys: ["client"] },
              content: {
                kind: "tree",
                node: {
                  title: { namedStyleType: "HEADING_4", keys: ["feature"] },
                  content: { kind: "list" },
                },
              },
            },
          },
        },
      ],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Projects", namedStyleType: "HEADING_2" }),
      createMockParagraph({ text: "Client A", namedStyleType: "HEADING_3" }),
      createMockParagraph({ text: "Feature X", namedStyleType: "HEADING_4" }),
      createMockParagraph({ text: "- Task 1", namedStyleType: "NORMAL_TEXT" }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-tree-simple", schema);

    // Assert
    expect(result).toEqual({
      Projects: [
        {
          title: { client: "Client A" },
          content: [
            {
              title: { feature: "Feature X" },
              content: ["- Task 1"],
            },
          ],
        },
      ],
    });
  });

  it("should stop parsing a child node when an ancestor or sibling heading is encountered", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [
        {
          title: { name: "Org", namedStyleType: "HEADING_2" },
          content: {
            kind: "tree",
            node: {
              title: { namedStyleType: "HEADING_3" }, // Parent
              content: {
                kind: "tree",
                node: {
                  title: { namedStyleType: "HEADING_4" }, // Child
                  content: { kind: "list" },
                },
              },
            },
          },
        },
      ],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Org", namedStyleType: "HEADING_2" }),
      createMockParagraph({ text: "Team A", namedStyleType: "HEADING_3" }),
      createMockParagraph({ text: "Squad 1", namedStyleType: "HEADING_4" }),
      createMockParagraph({ text: "Work", namedStyleType: "NORMAL_TEXT" }),
      // "Team B" is H3, so it should close "Squad 1" (H4) and "Team A" (H3)
      createMockParagraph({ text: "Team B", namedStyleType: "HEADING_3" }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument(
      "doc-tree-sibling-interruption",
      schema
    );

    // Assert
    expect(result).toEqual({
      Org: [
        {
          title: "Team A",
          content: [{ title: "Squad 1", content: ["Work"] }],
        },
        {
          title: "Team B",
          content: [], // No H4 children
        },
      ],
    });
  });

  it("should ignore content that appears before the first defined root node", async () => {
    // Arrange: Tree expects H3 as root
    const schema: ParseSchema = {
      sections: [
        {
          title: { name: "Exp", namedStyleType: "HEADING_2" },
          content: {
            kind: "tree",
            node: {
              title: { namedStyleType: "HEADING_3" },
              content: { kind: "list" },
            },
          },
        },
      ],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Exp", namedStyleType: "HEADING_2" }),
      createMockParagraph({
        text: "Orphan Text",
        namedStyleType: "NORMAL_TEXT",
      }), // Should be skipped
      createMockParagraph({ text: "Job A", namedStyleType: "HEADING_3" }),
      createMockParagraph({ text: "Desc", namedStyleType: "NORMAL_TEXT" }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-tree-orphan", schema);

    // Assert
    expect(result).toEqual({
      Exp: [{ title: "Job A", content: ["Desc"] }],
    });
  });
});

// ======================================================================
// 6. Robustness & Ignored Elements
// ======================================================================
/**
 * Tests for handling non-standard formatting, tables, and document artifacts.
 */
describe("getParsedDocument - Robustness", () => {
  beforeEach(() => {
    mockDocsGet.mockReset();
  });

  it("should safely ignore Table and SectionBreak elements", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Test", namedStyleType: "HEADING_2" } }],
    };

    // Manual construction of mixed content
    const rawDoc = {
      body: {
        content: [
          createMockParagraph({ text: "Test", namedStyleType: "HEADING_2" })
            .paragraph, // Wait, createMockParagraph returns { paragraph } or element?
          // Using helper properly inside the array construction (helper returns object with paragraph key)
          // Let's assume the mockDocsGet returns the full object structure.
          // Note: createMockParagraph returns { paragraph: ... }, we need the full StructuralElement structure for the array.
          // Let's just mock the array directly for this test to be safe.
          {
            paragraph: {
              elements: [{ textRun: { content: "Test" } }],
              paragraphStyle: { namedStyleType: "HEADING_2" },
            },
          },
          { table: { tableRows: [] } }, // Table
          { sectionBreak: {} }, // Section Break
          {
            paragraph: {
              elements: [{ textRun: { content: "Content" } }],
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
            },
          },
        ] as any[],
      },
    };
    mockDocsGet.mockResolvedValue({ data: rawDoc });

    // Act
    const result = await getParsedDocument("doc-with-tables", schema);

    // Assert
    expect(result).toEqual({ Test: "Content" });
  });

  it("should stop parsing a section if an unexpected Heading level is encountered (Schema Mismatch)", async () => {
    // Arrange: Schema expects H3, but document has H5
    const schema: ParseSchema = {
      sections: [
        {
          title: { name: "Skills", namedStyleType: "HEADING_2" },
          content: {
            kind: "tree",
            node: {
              title: { namedStyleType: "HEADING_3" },
              content: { kind: "list" },
            },
          },
        },
      ],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Skills", namedStyleType: "HEADING_2" }),
      createMockParagraph({ text: "Core", namedStyleType: "HEADING_3" }),
      createMockParagraph({ text: "- JS", namedStyleType: "NORMAL_TEXT" }),
      // H5 is not in the tree definition, so it should break the sequence/stop the current block
      createMockParagraph({ text: "Deep Detail", namedStyleType: "HEADING_5" }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-unexpected-heading", schema);

    // Assert
    expect(result).toEqual({
      Skills: [{ title: "Core", content: ["- JS"] }],
    });
  });
});

// ======================================================================
// 7. Snapshots: Complex Integration
// ======================================================================
/**
 * Snapshot tests for validating complex, real-world document structures.
 */
describe("getParsedDocument - Snapshots", () => {
  beforeEach(() => {
    mockDocsGet.mockReset();
  });

  it("should match snapshot for a comprehensive resume document", async () => {
    // Arrange
    const schema: ParseSchema = {
      sections: [
        { title: { name: "Profile", namedStyleType: "HEADING_2" } },
        {
          title: { name: "Experience", namedStyleType: "HEADING_2" },
          content: {
            kind: "tree",
            node: {
              title: { namedStyleType: "HEADING_3", keys: ["company", "role"] },
              content: { kind: "list" },
            },
          },
        },
      ],
    };
    const doc = createMockDocument([
      createMockParagraph({ text: "Profile", namedStyleType: "HEADING_2" }),
      createMockParagraph({
        text: "Frontend Developer.",
        namedStyleType: "NORMAL_TEXT",
      }),
      createMockParagraph({ text: "Experience", namedStyleType: "HEADING_2" }),
      createMockParagraph({
        text: "Tech Corp | Senior Dev",
        namedStyleType: "HEADING_3",
      }),
      createMockParagraph({
        text: "- Built UI",
        namedStyleType: "NORMAL_TEXT",
      }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-snapshot-resume", schema);

    // Assert
    expect(result).toMatchSnapshot();
  });
});

// ======================================================================
// 8. Edge Cases & Internal Logic Coverage (Enhanced)
// ======================================================================
/**
 * Tests targeting specific logic paths in parser.ts like null-checks
 * and cursor state management.
 */
describe("getParsedDocument - Enhanced Coverage", () => {
  beforeEach(() => {
    mockDocsGet.mockReset();
  });

  it("should handle a document with an undefined body safely", async () => {
    // Rationale: Tests `const content = doc.body?.content || [];` in parser.ts
    // Arrange
    const schema: ParseSchema = { sections: [] };
    // Manually create a doc object without a body property
    const rawDoc = {
      documentId: "no-body-doc",
      title: "Untitled",
      // body is undefined
    };
    mockDocsGet.mockResolvedValue({ data: rawDoc });

    // Act
    const result = await getParsedDocument("doc-no-body", schema);

    // Assert
    expect(result).toEqual({});
  });

  it("should ignore non-paragraph elements (e.g., images/tables only) in the content stream", async () => {
    // Rationale: Tests `.filter((paragraph) => !!paragraph)` in validParagraphList construction
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Intro", namedStyleType: "HEADING_2" } }],
    };

    // Construct content with ONLY non-paragraph elements
    const rawDoc = {
      body: {
        content: [
          { sectionBreak: {} },
          { table: { tableRows: [] } },
          { tableOfContents: {} },
        ],
      },
    };
    mockDocsGet.mockResolvedValue({ data: rawDoc });

    // Act
    const result = await getParsedDocument("doc-non-paragraph-only", schema);

    // Assert
    expect(result).toEqual({});
  });

  it("should correctly parse sections regardless of the order defined in the Schema", async () => {
    // Rationale: Ensures parseDocument iterates based on Cursor (Document), not Schema array order.
    // Arrange
    // Schema defines "Part B" BEFORE "Part A"
    const schema: ParseSchema = {
      sections: [
        { title: { name: "Part B", namedStyleType: "HEADING_2" } },
        { title: { name: "Part A", namedStyleType: "HEADING_2" } },
      ],
    };

    // Document has "Part A" then "Part B"
    const doc = createMockDocument([
      createMockParagraph({ text: "Part A", namedStyleType: "HEADING_2" }),
      createMockParagraph({ text: "Content A", namedStyleType: "NORMAL_TEXT" }),
      createMockParagraph({ text: "Part B", namedStyleType: "HEADING_2" }),
      createMockParagraph({ text: "Content B", namedStyleType: "NORMAL_TEXT" }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-schema-order-mismatch", schema);

    // Assert
    expect(result).toEqual({
      "Part A": "Content A",
      "Part B": "Content B",
    });
  });

  it("should NOT treat text matching a section title as a new section if the style does not match", async () => {
    // Rationale: Verifies that Section matching relies on Style + Text, not just Text.
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Overview", namedStyleType: "HEADING_2" } }],
    };

    const doc = createMockDocument([
      // Real Section Start
      createMockParagraph({ text: "Overview", namedStyleType: "HEADING_2" }),
      // This text matches the title but is NORMAL_TEXT. It should be part of the content.
      createMockParagraph({ text: "Overview", namedStyleType: "NORMAL_TEXT" }),
      createMockParagraph({
        text: "is important.",
        namedStyleType: "NORMAL_TEXT",
      }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-false-positive-title", schema);

    // Assert
    // If logic was wrong, it might reset the section or ignore the second "Overview".
    // Correct behavior: "Overview is important." (concatenated)
    expect(result).toEqual({
      Overview: "Overview is important.",
    });
  });
  it("should handle unexpected errors that are not Error instances (Branch Coverage)", async () => {
    // Rationale: Tests the 'else' branch of `e instanceof Error ? e.message : String(e)`
    // Arrange
    const schema: ParseSchema = { sections: [] };
    mockDocsGet.mockRejectedValue("String Error Message");

    // Act & Assert
    await expect(getParsedDocument("doc-string-error", schema)).rejects.toThrow(
      "Original error: String Error Message"
    );
  });

  it("should skip sections found by cursor but not present in schema (Branch Coverage)", async () => {
    // Rationale: Tests the 'if (section)' check when it evaluates to false
    // Arrange
    const schema: ParseSchema = {
      sections: [{ title: { name: "Wanted", namedStyleType: "HEADING_2" } }],
    };

    const doc = createMockDocument([
      createMockParagraph({ text: "Unwanted", namedStyleType: "HEADING_2" }),
      createMockParagraph({
        text: "Skip this content",
        namedStyleType: "NORMAL_TEXT",
      }),

      createMockParagraph({ text: "Wanted", namedStyleType: "HEADING_2" }),
      createMockParagraph({ text: "Keep this", namedStyleType: "NORMAL_TEXT" }),
    ]);
    mockDocsGet.mockResolvedValue({ data: doc });

    // Act
    const result = await getParsedDocument("doc-unwanted-section", schema);

    // Assert
    expect(result).toEqual({ Wanted: "Keep this" });
    expect(result).not.toHaveProperty("Unwanted");
  });
});
