import type { docs_v1 } from "googleapis";

/**
 * Creates a mock `StructuralElement` containing a `Paragraph`, primarily for testing purposes.
 *
 * This helper simplifies the creation of the nested Google Docs API structure
 * by automatically wrapping the text within `elements` and `textRun`.
 *
 * @param params - Configuration object for the mock paragraph.
 * @param {string} [params.text] - The text content of the paragraph.
 * @param {string} [params.namedStyleType] - The named style type (e.g., "HEADING_1", "NORMAL_TEXT").
 * @param {boolean} [params.bullet] - Whether this paragraph should be treated as a bulleted list item.
 * @returns {docs_v1.Schema$StructuralElement} A structural element that is guaranteed to contain a `paragraph` property.
 */
export function createMockParagraph(params: {
  text?: string;
  namedStyleType?: string; // "HEADING_1" | "HEADING_2" | ... | "NORMAL_TEXT"
  bullet?: boolean;
}): docs_v1.Schema$StructuralElement & {
  paragraph: docs_v1.Schema$Paragraph;
} {
  const { text, namedStyleType, bullet = false } = params;

  const paragraph: docs_v1.Schema$Paragraph = {
    elements: text
      ? [
        {
          textRun: {
            content: text,
          },
        },
      ]
      : [],
    paragraphStyle: namedStyleType ? { namedStyleType } : {},
  };

  if (bullet) {
    paragraph.bullet = {};
  }

  return { paragraph };
}

/**
 * Creates a mock Google Docs `Document` object populated with the provided paragraphs.
 *
 * This wraps the structural elements into the `body.content` property, mimicking
 * the structure of a real Google Docs API response.
 *
 * @param {docs_v1.Schema$StructuralElement[]} paragraphs - An array of structural elements to include in the document body.
 * @returns {docs_v1.Schema$Document} A mock Document object.
 */
export function createMockDocument(
  paragraphs: docs_v1.Schema$StructuralElement[]
): docs_v1.Schema$Document {
  return {
    body: {
      content: paragraphs,
    },
  };
}
