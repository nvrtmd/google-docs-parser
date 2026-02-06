import type { docs_v1 } from "googleapis";
import { ParseSchema, NamedStyleType } from "./types";
import {
  getParagraphNamedStyleType,
  isNamedStyleType,
  extractParagraphText,
} from "./utils";
import { getSectionTitle } from "./section";

/**
 * Represents a processed paragraph with extracted text and normalized style.
 */
export interface Paragraph {
  text: string;
  style: NamedStyleType | "NORMAL_TEXT" | undefined;
  paragraph: docs_v1.Schema$Paragraph;
}

/**
 * Extracts and normalizes data from a raw Google Docs paragraph.
 *
 * @param paragraph - The raw paragraph object from the API.
 * @returns A `Paragraph` object if text exists, otherwise `null` (e.g., empty lines).
 */
export function getParagraph(
  paragraph: docs_v1.Schema$Paragraph
): Paragraph | null {
  const text = extractParagraphText(paragraph);
  if (!text) return null;
  const style = getParagraphNamedStyleType(paragraph);
  return { text, style, paragraph };
}

/**
 * A stateful cursor for traversing a list of Google Docs paragraphs.
 *
 * It manages the current position (index) and provides methods to inspect
 * the current paragraph's context (e.g., style, section boundaries)
 * without manually handling array indices.
 */
export class ParagraphCursor {
  private index = 0;

  constructor(
    private paragraphList: docs_v1.Schema$Paragraph[],
    private parseSchema: ParseSchema
  ) {}

  /**
   * Retrieves the paragraph at the current cursor position.
   *
   * @returns The current `Paragraph` object, or `null` if the cursor is at the end of the document or the line is empty.
   */
  getCurrentParagraph(): Paragraph | null {
    if (this.isEndOfDocument()) return null;
    const paragraph = this.paragraphList[this.index];
    if (!paragraph) return null;
    return getParagraph(paragraph);
  }

  /**
   * Advances the cursor to the next position and returns the new paragraph.
   *
   * @returns The next `Paragraph` object, or `null` if the end of the document is reached.
   */
  getNextParagraph(): Paragraph | null {
    if (this.isEndOfDocument()) return null;
    this.index++;
    return this.getCurrentParagraph();
  }

  /**
   * Checks if the cursor has reached the end of the paragraph list.
   */
  isEndOfDocument(): boolean {
    return this.index >= this.paragraphList.length;
  }

  /**
   * Determines if the current paragraph corresponds to a section title defined in the schema.
   *
   * @returns The section name if matched, otherwise `null`.
   */
  getCurrentSectionTitle(): string | null {
    const info = this.getCurrentParagraph();
    if (!info) return null;
    return getSectionTitle(info.paragraph, info.text, this.parseSchema);
  }

  /**
   * Checks if the current cursor position marks the start of a new section.
   */
  isAtNewSection(): boolean {
    return this.getCurrentSectionTitle() !== null;
  }

  /**
   * Checks if the current paragraph has a named heading style (e.g., HEADING_1).
   */
  isAtParagraphHeading(): boolean {
    const info = this.getCurrentParagraph();
    return !!info && isNamedStyleType(info.style);
  }
}
