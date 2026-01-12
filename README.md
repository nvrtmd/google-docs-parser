# 📄 Google Docs Parser

<h1 align="center">
	<img width="500px" src="media/logo.png" alt="octoreport">
</h1>

![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Beta-orange)
![npm](https://img.shields.io/npm/v/@yuji-min/google-docs-parser)

**Turn your Google Docs into a Headless CMS.**

`@yuji-min/google-docs-parser` is a TypeScript library that transforms raw Google Docs content into structured JSON data based on a user-defined schema. Stop wrestling with the raw Google Docs API structure—define your schema and get clean data instantly.

---

## 🚀 Why use this?

Parsing the raw `docs_v1.Schema$Document` JSON from the Google API is complex. It involves handling deep nesting of `structuralElements`, `paragraph`, `elements`, and `textRun`, along with varying styling attributes.

This library solves that complexity by allowing you to define a **Schema** that maps your document's visual structure (Headings, Lists, Key-Values) directly to data structures.

### ✨ Key Features

- **Type-Safe:** The return type is automatically inferred from your schema configuration using TypeScript generics.
- **Hierarchical Parsing:** Supports nested tree structures (e.g., _Heading 2_ containing _Heading 3_ children).
- **Smart Text Parsing:** Built-in parsers for:
  - Key-Value pairs (e.g., `Role: Engineer`)
  - Delimited fields (e.g., `2024 | Senior Dev | Google`)
  - Flattened lists or grouped arrays.
- **Auth Ready:** Seamless integration with `google-auth-library` and `googleapis`.

---

## 📦 Installation

```bash
npm install @yuji-min/google-docs-parser googleapis google-auth-library
# or
yarn add @yuji-min/google-docs-parser googleapis google-auth-library
```

---

## 🔑 Authentication & Setup

To use this library, you need a Google Cloud Service Account with access to the Google Docs API.

### 1. Create Google Cloud Credentials

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project (or select an existing one).
3.  Enable the **Google Docs API** in the "APIs & Services" > "Library" section.
4.  Go to "IAM & Admin" > "Service Accounts" and create a new service account.
5.  Create and download a **JSON key** for this service account.

### 2. Configure Environment Variable

Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the path of your downloaded JSON key file.

**Mac/Linux:**

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
```

**Windows (PowerShell):**

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your\service-account-key.json"
```

> **Note:** The library uses `google-auth-library` internally, which automatically looks for credentials at the path defined in this environment variable.

### 3. Share the Document (Important!)

Google Docs are private by default. You must share the target document with your Service Account's email address (found in your JSON key, e.g., my-bot@my-project.iam.gserviceaccount.com) with Viewer permission.

**If you don't do this, the parser will throw a permission error.**

---

## 🛠️ Getting Started

### 1. Prepare your Google Doc

Imagine a Google Doc structured like a resume or project list:

> **Profile** (Heading 1)
>
> Senior Software Engineer based in Seoul.
>
> **Experience** (Heading 1)
>
> **Tech Corp | Backend Lead** (Heading 2)
>
> - Designed microservices architecture
> - Managed a team of 5
>
> **Startup Inc | Full Stack** (Heading 2)
>
> - Built MVP in 3 months

### 2. Define Schema & Parse

Create a schema object that mirrors the visual hierarchy of your document.

```typescript
import { getParsedDocument, ParseSchema } from "@yuji-min/google-docs-parser";

// 1. Define the schema
const resumeSchema = {
  sections: [
    {
      // Matches a "Heading 1" named 'Profile'
      title: { name: "Profile", namedStyleType: "HEADING_1" },
      // content is undefined -> defaults to simple text block
    },
    {
      // Matches a "Heading 1" named 'Experience'
      title: { name: "Experience", namedStyleType: "HEADING_1" },
      content: {
        kind: "tree", // This section is a hierarchical tree
        node: {
          // The tree nodes start with "Heading 2"
          // We can also parse the heading text itself!
          title: {
            namedStyleType: "HEADING_2",
            keys: ["company", "role"],
            delimiter: "|",
          },
          // Under each H2, treat the content as a list
          content: { kind: "list" },
        },
      },
    },
  ],
} as const; // 'as const' is CRITICAL for type inference

// 2. Fetch and Parse
async function main() {
  const docId = "YOUR_GOOGLE_DOC_ID";

  try {
    // 'data' is fully typed based on resumeSchema!
    const data = await getParsedDocument(docId, resumeSchema);
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(error);
  }
}

main();
```

### 3. The Result

```json
{
  "Profile": "Senior Software Engineer based in Seoul.",
  "Experience": [
    {
      "company": "Tech Corp",
      "role": "Backend Lead",
      "content": ["Designed microservices architecture", "Managed a team of 5"]
    },
    {
      "company": "Startup Inc",
      "role": "Full Stack",
      "content": ["Built MVP in 3 months"]
    }
  ]
}
```

---

## 📚 Parsing Schema Guide

The `ParseSchema` object controls how the parser reads your document.

### Section Configuration

| Property               | Type     | Description                                                                                    |
| :--------------------- | :------- | :--------------------------------------------------------------------------------------------- |
| `title.name`           | `string` | The text of the heading to find (case-insensitive). This becomes the key in the result object. |
| `title.namedStyleType` | `string` | The Google Docs style to match (e.g., `HEADING_1`, `TITLE`).                                   |
| `content`              | `Object` | (Optional) Defines the content structure. If omitted, parses as a text block.                  |

### Content Kinds

#### 1. Text Block (Default)

If `content` is undefined, the parser collects all paragraphs following the header until the next section starts, joining them into a single string.

#### 2. List (`kind: "list"`)

Parses paragraphs as an array. Useful for bullet points or simple lists.

- **`isFlatten`**: (boolean) If true, merges multiple lines into a single flat array.
- **`keyDelimiter`**: (string) Parses "Key: Value" lines into `{ key: "...", value: [...] }` objects.
- **`delimiter`**: (string) Splits a line by a character (e.g., comma) into an array.

#### 3. Tree (`kind: "tree"`)

Parses hierarchical structures. Ideal for nested sections like "H2 -> H3 -> Content".

- **`node`**: Defines the schema for the child nodes.
- **Strict Nesting**: The parser automatically stops collecting children when it encounters a heading of the same or higher level (e.g., an H2 stops an open H2 block).

---

## 🧪 Testing

We use **Vitest** for testing. The repository includes a comprehensive test suite covering parsers, cursors, and authentication logic.

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

---

## 🤝 Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue.

1.  Fork the repository
2.  Create your feature branch (`git checkout -b feature/amazing-feature`)
3.  Commit your changes (`git commit -m 'Add some amazing feature'`)
4.  Push to the branch (`git push origin feature/amazing-feature`)
5.  Open a Pull Request

---

## 📃 License

This project is licensed under the MIT License. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.
