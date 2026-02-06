import type { ParseSchema, GetParsedType, ParsedDocument } from "../types";
import type { DocsDocument } from "./types";
import { getDocument } from "./client";
import { ParagraphCursor } from "../cursor";
import { parseSectionContent } from "../section";

/**
 * Parses a DocsDocument (same logic as the original parseDocument).
 *
 * Uses DocsDocument type instead of googleapis' docs_v1.Schema$Document.
 */
function parseDocument(
  doc: DocsDocument,
  parseSchema: ParseSchema
): ParsedDocument {
  const content = doc.body?.content || [];
  const result: ParsedDocument = {};

  // Convert DocsDocument type to googleapis-compatible type
  const validParagraphList = content
    .map((element) => element.paragraph)
    .filter((paragraph): paragraph is NonNullable<typeof paragraph> => !!paragraph);

  const cursor = new ParagraphCursor(validParagraphList as any, parseSchema);

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
 * getParsedDocument for Edge Runtime.
 *
 * Compatible with Cloudflare Workers, Vercel Edge Functions, etc.
 *
 * @example
 * ```typescript
 * // Cloudflare Workers
 * import { getParsedDocument } from '@yuji-min/google-docs-parser/edge'
 *
 * export default {
 *   async fetch(request, env) {
 *     process.env.GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_CREDENTIALS
 *     const data = await getParsedDocument('doc-id', schema)
 *     return Response.json(data)
 *   }
 * }
 * ```
 */
export async function getParsedDocument<T extends ParseSchema>(
  documentId: string,
  parseSchema: T
): Promise<GetParsedType<T>> {
  try {
    const doc = await getDocument(documentId);
    const parsedDocument = parseDocument(doc, parseSchema);
    return parsedDocument as GetParsedType<T>;
  } catch (e) {
    throw new Error(
      `Google Docs API call failed. Check Doc ID and Service Account permissions. Original error: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
}

// Export types for Edge
export type { ServiceAccountCredentials, DocsDocument } from "./types";
