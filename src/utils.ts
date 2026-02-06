import type { docs_v1 } from "googleapis";
import { Schema, NamedStyleType } from "./types";
import { VALID_NAMED_STYLES_SET } from "./constants";

/**
 * Extracts pure text content from a Google Docs Paragraph.
 *
 * - Joins content from all `textRun` elements.
 * - Trims leading and trailing whitespace.
 * - Normalizes newline characters (`\n`) to spaces.
 *
 * @param paragraph - The Google Docs paragraph object.
 * @returns The extracted and cleaned text string. Returns an empty string if the paragraph is empty.
 */
export function extractParagraphText(
  paragraph: docs_v1.Schema$Paragraph
): string {
  const elements = paragraph.elements ?? [];

  const text = elements
    .map((el: docs_v1.Schema$ParagraphElement) => el.textRun?.content || "")
    .join("")
    .trim()
    .replace(/\n/g, " ");

  return text || "";
}

/**
 * Checks if a paragraph has a specific `namedStyleType` (e.g., HEADING_1).
 *
 * @param paragraph - The paragraph to check.
 * @param namedStyleType - The style type to compare against.
 * @returns `true` if the paragraph's style matches the provided type; otherwise `false`.
 */
export function hasNamedStyle(
  paragraph: docs_v1.Schema$Paragraph,
  namedStyleType?: NamedStyleType
): boolean {
  if (!namedStyleType) return false;
  const style = paragraph.paragraphStyle?.namedStyleType;
  return style === namedStyleType;
}

/**
 * Retrieves the named style type of a paragraph, handling default behaviors and edge cases.
 *
 * Resolution Logic:
 * 1. Returns `undefined` if the paragraph has no style and no content (completely empty).
 * 2. Returns `"NORMAL_TEXT"` if the paragraph has content but no explicit style (Google Docs default).
 * 3. Returns `"NORMAL_TEXT"` if the style object exists but `namedStyleType` is missing.
 * 4. Returns the `namedStyleType` if it exists in the valid set (`VALID_NAMED_STYLES`).
 * 5. Returns `undefined` if the style is invalid or unknown.
 *
 * @param paragraph - The paragraph to analyze.
 * @returns The valid `NamedStyleType`, `"NORMAL_TEXT"`, or `undefined`.
 */
export function getParagraphNamedStyleType(
  paragraph: docs_v1.Schema$Paragraph
): NamedStyleType | "NORMAL_TEXT" | undefined {
  if (!paragraph.paragraphStyle && !paragraph.elements?.length) {
    return undefined;
  }
  if (!paragraph.paragraphStyle) {
    return "NORMAL_TEXT";
  }

  const namedStyleType = paragraph.paragraphStyle.namedStyleType;

  if (!namedStyleType) {
    return "NORMAL_TEXT";
  }

  if (VALID_NAMED_STYLES_SET.has(namedStyleType)) {
    return namedStyleType as NamedStyleType;
  }

  return undefined;
}

/**
 * Type Guard to check if a style is a valid Heading style (HEADING_1~6, TITLE, SUBTITLE).
 *
 * - Returns `false` for `"NORMAL_TEXT"`.
 * - Returns `false` for undefined or invalid strings.
 *
 * @param style - The style string to check.
 * @returns `true` if the style is a valid `NamedStyleType`.
 */
export function isNamedStyleType(
  style: NamedStyleType | "NORMAL_TEXT" | undefined
): style is NamedStyleType {
  if (typeof style !== "string") return false;
  if (style === "NORMAL_TEXT") return false;

  return VALID_NAMED_STYLES_SET.has(style);
}

/**
 * Splits a string by a delimiter and trims whitespace from each item.
 *
 * @param text - The string to split.
 * @param delimiter - The character to split by (e.g., ",").
 * @param filterEmpty - If `true`, removes empty strings from the result. Defaults to `false`.
 * @returns An array of trimmed strings.
 */
export function splitAndTrim(
  text: string,
  delimiter: string,
  filterEmpty = false
): string[] {
  if (text === "") {
    return [];
  }
  const items = text.split(delimiter).map((t) => t.trim());
  return filterEmpty ? items.filter((t) => t.length > 0) : items;
}

/**
 * Parses text into a Key-Value list structure.
 *
 * Format: "Key: Value1, Value2"
 *
 * @param text - The text to parse.
 * @param keyDelimiter - The separator between key and values (e.g., ":").
 * @param listDelimiter - The separator between list items (e.g., ",").
 * @returns An object `{ key, value[] }` if parsing succeeds, or the original text string if the key delimiter is missing.
 */
export function parseToKeyedList(
  text: string,
  keyDelimiter: string,
  listDelimiter: string
): { key: string; value: string[] } | string {
  const delimiterIndex = text.indexOf(keyDelimiter);

  if (delimiterIndex <= 0) {
    return text;
  }

  const key = text.substring(0, delimiterIndex).trim();
  const valuePart = text.substring(delimiterIndex + keyDelimiter.length).trim();

  const value = valuePart ? splitAndTrim(valuePart, listDelimiter, true) : [];

  return { key, value };
}

/**
 * Maps delimited text values to a list of keys by position.
 *
 * Format: "Value1 | Value2 | Value3" -> { Key1: "Value1", Key2: "Value2", ... }
 *
 * @param text - The text to parse.
 * @param keys - The list of field names (keys) to map values to.
 * @param delimiter - The separator between values (e.g., "|").
 * @returns A record object mapping keys to values. Missing values are filled with empty strings.
 */
export function parseToFields(
  text: string,
  keys: readonly string[],
  delimiter: string
): Record<string, unknown> {
  const values = splitAndTrim(text, delimiter, false);

  return keys.reduce((acc, key, index) => {
    const value = values[index];
    acc[key] = value !== undefined && value !== "" ? value : "";
    return acc;
  }, {} as Record<string, unknown>);
}

/**
 * Parses a simple delimited string into an array, filtering out empty items.
 *
 * Example: "Apple, , Banana" -> ["Apple", "Banana"]
 *
 * @param text - The text to parse.
 * @param delimiter - The separator (e.g., ",").
 * @returns An array of non-empty strings.
 */
export function parseDelimitedList(text: string, delimiter: string): string[] {
  const values = text
    .split(delimiter)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return values;
}

/**
 * Parses a single line of text into structured data based on the provided Schema.
 *
 * **Parsing Priorities:**
 * 1. **Keyed List**: If `schema.keyDelimiter` is set. (e.g., "Team: A, B")
 * 2. **Fixed Fields**: If `schema.keys` is set. (e.g., "Google | Engineer | 2023")
 * 3. **Default List**: Fallback to simple delimited list. (e.g., "A, B, C")
 *
 * @param text - The text content to parse.
 * @param schema - The schema object defining the parsing rules.
 * @returns The parsed result as an object, array, or string depending on the schema.
 */
export function parseStructuredText(
  text: string,
  schema: Schema
): Record<string, unknown> | string[] | string {
  const delimiter = schema.delimiter || ",";

  if (schema.keyDelimiter) {
    return parseToKeyedList(text, schema.keyDelimiter, delimiter);
  }

  if (schema.keys && schema.keys.length > 0) {
    return parseToFields(text, schema.keys, delimiter);
  }

  return parseDelimitedList(text, delimiter);
}
