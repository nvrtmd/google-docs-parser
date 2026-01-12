import { ParagraphCursor } from "./cursor";

/**
 * Parses a continuous block of text paragraphs into a single string.
 *
 * This function iterates through paragraphs starting from the current cursor position
 * and collects text until a boundary is encountered.
 *
 * **Stop Conditions:**
 * 1. **New Section:** The cursor reaches a paragraph that marks the start of a new section defined in the schema.
 * 2. **Heading:** The cursor reaches any paragraph with a named heading style (e.g., HEADING_1, HEADING_2).
 *
 * @param cursor - The cursor traversing the document paragraphs.
 * @returns The combined text content of the block, joined by spaces.
 */
export function parseTextBlockSection(cursor: ParagraphCursor): string {
  const textPartList: string[] = [];

  while (!cursor.isEndOfDocument()) {
    const paragraph = cursor.getCurrentParagraph();
    if (!paragraph) {
      cursor.getNextParagraph();
      continue;
    }

    if (cursor.isAtNewSection()) break;
    if (cursor.isAtParagraphHeading()) break;

    textPartList.push(paragraph.text);
    cursor.getNextParagraph();
  }
  return textPartList.join(" ");
}
