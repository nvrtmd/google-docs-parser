import type { docs_v1 } from "googleapis";
import { ParsedDocument, ParseSchema, GetParsedType } from "./types";
import { ParagraphCursor } from "./cursor";
import { parseSectionContent } from "./section";
import { createDocsClient } from "./auth";

/**
 * Parses the raw Google Docs document content according to the provided schema.
 *
 * This function converts the document into a stream of valid paragraphs and
 * uses a cursor to navigate and parse sections based on the schema definition.
 *
 * @param doc - The raw Google Docs document object.
 * @param parseSchema - The schema defining the structure of sections to parse.
 * @returns An object representing the parsed document content.
 */
function parseDocument(
  doc: docs_v1.Schema$Document,
  parseSchema: ParseSchema
): ParsedDocument {
  const content = doc.body?.content || [];
  const result: ParsedDocument = {};

  const validParagraphList = content
    .map((element) => element.paragraph)
    .filter((paragraph): paragraph is docs_v1.Schema$Paragraph => !!paragraph);

  const cursor = new ParagraphCursor(validParagraphList, parseSchema);

  while (!cursor.isEndOfDocument()) {
    const currentSectionTitle = cursor.getCurrentSectionTitle();
    if (currentSectionTitle) {
      const section = parseSchema.sections.find(
        (s) => s.title.name === currentSectionTitle
      );
      if (section) {
        cursor.getNextParagraph();
        const parsedData = parseSectionContent(cursor, section);
        result[currentSectionTitle] = parsedData;
        continue;
      }
    }
    cursor.getNextParagraph();
  }

  return result;
}

/**
 * Public API: Fetches and parses a Google Doc by its ID.
 *
 * This function handles authentication, API communication, and error wrapping.
 * It returns a fully typed object based on the provided schema generic `T`.
 *
 * @template T - The type of the ParseSchema, allowing for type inference of the result.
 * @param documentId - The unique ID of the Google Doc to parse.
 * @param parseSchema - The schema definition used to guide the parsing process.
 * @returns A promise resolving to the parsed document data.
 * @throws Will throw a descriptive error if the API call fails or returns an empty response.
 */
export async function getParsedDocument<T extends ParseSchema>(
  documentId: string,
  parseSchema: T
): Promise<GetParsedType<T>> {
  try {
    const docs = createDocsClient();
    const response = await docs.documents.get({ documentId });
    if (!response.data) {
      throw new Error("Empty document response from Google Docs API.");
    }

    const parsedDocument = parseDocument(response.data, parseSchema);
    return parsedDocument as GetParsedType<T>;
  } catch (e) {
    throw new Error(
      `Google Docs API call failed. Check Doc ID and Service Account permissions. Original error: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
}
