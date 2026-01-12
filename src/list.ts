import { Section } from "./types";
import { ParagraphCursor } from "./cursor";
import { parseStructuredText } from "./utils";

/**
 * Parses a section defined as a 'List'.
 *
 * This function iterates through paragraphs, parsing each line according to the
 * section's content schema (e.g., delimiters, keys). It supports both flat lists
 * and nested structures depending on the `isFlatten` configuration.
 *
 * @param cursor - The cursor traversing the document paragraphs.
 * @param section - The section definition containing the list schema.
 * @returns An array of parsed items (strings, objects, or arrays).
 */
export function parseListSection(
  cursor: ParagraphCursor,
  section: Section
): unknown[] {
  const result: unknown[] = [];
  if (!section.content || section.content.kind !== "list") {
    return [];
  }
  const contentSchema = section.content;

  while (!cursor.isEndOfDocument()) {
    const info = cursor.getCurrentParagraph();
    if (!info) {
      cursor.getNextParagraph();
      continue;
    }

    if (cursor.isAtNewSection()) break;
    if (cursor.isAtParagraphHeading()) break;

    const parsed = parseStructuredText(info.text, contentSchema);

    if (contentSchema.isFlatten && Array.isArray(parsed)) {
      result.push(...parsed);
    } else {
      result.push(parsed);
    }
    cursor.getNextParagraph();
  }
  return result;
}
