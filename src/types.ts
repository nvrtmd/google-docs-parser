import { docs_v1 } from "googleapis";

// ----------------------------------------------------------------------
// 1. Style & Base Configuration Structures
// ----------------------------------------------------------------------

/**
 * Alias for the Google Docs API's named style type.
 * Examples: "HEADING_1", "HEADING_2", "NORMAL_TEXT", "TITLE".
 */
export type NamedStyleType = docs_v1.Schema$ParagraphStyle["namedStyleType"];

/**
 * Base configuration interface for parsing text content.
 * Defines how raw text strings are split, filtered, and mapped to data fields.
 */
export interface Schema {
  /**
   * The delimiter used to split text into multiple values (e.g., "," or "|").
   * @default ","
   */
  delimiter?: string;

  /**
   * An array of keys used to map split values to specific field names.
   * If provided, the text is parsed into an object (e.g., "A, B" -> { key1: "A", key2: "B" }).
   */
  keys?: readonly string[];

  /**
   * The delimiter used to separate a key from its values (e.g., ":").
   * Used for "Key: Value" parsing logic.
   */
  keyDelimiter?: string;

  /**
   * If true, indicates that the result should be flattened in specific contexts.
   */
  isFlatten?: boolean;
}

/**
 * Configuration for a heading node (Title).
 * Extends `Schema` to allow parsing structured data from the heading text itself.
 */
export interface Title extends Schema {
  /**
   * The property name key for this section in the final output object.
   * This matches the key in the `ParsedDocument`.
   */
  name?: string;

  /**
   * The specific Google Docs style type that identifies this title (e.g., "HEADING_1").
   */
  namedStyleType: NamedStyleType;
}

// ----------------------------------------------------------------------
// 2. Content: List / Tree Mode Separation
// ----------------------------------------------------------------------

/**
 * Configuration for parsing content as a flat list.
 * Expects a sequence of items (usually bullet points or paragraphs) under a heading.
 */
export interface List extends Schema {
  kind: "list";
}

/**
 * Configuration for parsing content as a nested tree structure.
 * Expects child nodes (sub-headings) under the current heading.
 */
export interface Tree {
  kind: "tree";
  /**
   * The definition of the child node structure.
   */
  node: Node;
}

/**
 * Union type representing the possible content structures:
 * either a flat `List` or a hierarchical `Tree`.
 */
export type Content = List | Tree;

/**
 * Represents a single node in the document hierarchy.
 * Consists of a title (the heading) and optional content (children or list).
 */
export interface Node {
  /** Configuration for the node's heading. */
  title: Title;
  /** Configuration for the node's body content (optional). */
  content?: Content;
}

/**
 * Represents a top-level section of the document.
 * Similar to `Node` but used at the root level of the parsing schema.
 */
export interface Section {
  title: Title;
  content?: Content;
}

/**
 * The root configuration object used to define the entire document parsing structure.
 * Contains a list of top-level sections to parse.
 */
export interface ParseSchema {
  sections: readonly Section[];
}

/**
 * A generic container type for the runtime result of the parsed document.
 * Keys correspond to section names, and values are the parsed data.
 */
export type ParsedDocument = Record<string, unknown>;

// ----------------------------------------------------------------------
// 3. 🌟 Type Inference System (GetParsedType)
// ----------------------------------------------------------------------

/**
 * Helper Type: Infers the object shape for a single text item based on `keys`.
 *
 * - If `keys` are present (e.g., `["role", "name"]`), infers `{ role: string; name: string }`.
 * - Otherwise, infers `string`.
 */
type ItemField<T extends Schema> = T extends {
  keys: readonly (infer K)[];
}
  ? { [P in K & string]: string }
  : string;

/**
 * Helper Type: Infers the result type for a `List` content.
 *
 * - If the schema has keys, returns an array of objects.
 * - Otherwise, returns an array of strings.
 */
type ContentListType<C extends List> = C extends {
  keys: readonly any[];
}
  ? Array<ItemField<C>>
  : string[];

/**
 * Helper Type: Recursively infers the type of a Node's content.
 *
 * - If `kind: "tree"`, returns an array of `StructuredItem<N>` (recursive).
 * - If `kind: "list"`, returns a list type via `ContentListType`.
 */
type NodeContentItems<C extends Content | undefined> = C extends {
  kind: "tree";
  node: infer N extends Node;
}
  ? Array<StructuredItem<N>>
  : C extends { kind: "list" }
  ? ContentListType<C>
  : unknown;

/**
 * Helper Type: Represents the fully resolved type of a single Node.
 *
 * Structure:
 * - `title`: The parsed title (string, object with keys, or keyed list).
 * - `content`: The parsed body content (children nodes or list items).
 *
 * This matches the runtime structure: `{ title: ..., content: [...] }`.
 */
export type StructuredItem<N extends Node> = {
  title: ItemField<N["title"]>;
  content: NodeContentItems<N["content"]>;
};

/**
 * **Main Type Inference Utility**
 *
 * Converts a static `ParseSchema` configuration type into the actual runtime result type.
 *
 * - Iterates over all sections in `ParseSchema`.
 * - Maps the section's `name` to its corresponding inferred content type.
 * - Supports both Tree (recursive) and List structures.
 *
 * @template T - The ParseSchema type (must be defined `as const` to infer literal keys).
 */
export type GetParsedType<T extends ParseSchema> = {
  [S in T["sections"][number] as S["title"]["name"] &
    string]: S["content"] extends { kind: "tree"; node: infer N extends Node }
    ? Array<StructuredItem<N>>
    : S["content"] extends { kind: "list" }
    ? ContentListType<S["content"]>
    : unknown;
};
