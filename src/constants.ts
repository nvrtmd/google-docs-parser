/**
 * A constant tuple of supported Google Docs named styles that represent headings or titles.
 * These are used to identify structural nodes and section boundaries within the document tree.
 */
export const VALID_NAMED_STYLES = [
  "HEADING_1",
  "HEADING_2",
  "HEADING_3",
  "HEADING_4",
  "HEADING_5",
  "HEADING_6",
  "TITLE",
  "SUBTITLE",
] as const;

/**
 * A union type representing any one of the valid named styles defined in `VALID_NAMED_STYLES`.
 */
export type ValidNamedStyle = (typeof VALID_NAMED_STYLES)[number];

/**
 * A Set containing the valid named styles for efficient O(1) validation checks.
 * This is primarily used in type guards to verify if a style string is a valid heading.
 */
export const VALID_NAMED_STYLES_SET = new Set<string>(VALID_NAMED_STYLES);
