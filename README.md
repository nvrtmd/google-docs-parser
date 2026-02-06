# 📄 Google Docs Parser

<h1 align="center">
	<img width="200px" src="media/logo.png" alt="octoreport">
</h1>

![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Beta-orange)
![npm](https://img.shields.io/npm/v/@yuji-min/google-docs-parser)

**Turn your Google Docs into a Headless CMS.**

`google-docs-parser` is a TypeScript library that transforms raw Google Docs content into structured JSON data based on a user-defined schema. Stop wrestling with the raw Google Docs API structure—define your schema and get clean, **fully-typed** data instantly.

---

## 🚀 Why use this?

Parsing the raw `docs_v1.Schema$Document` JSON from the Google API is complex. It involves handling deep nesting of `structuralElements`, `paragraph`, `elements`, and `textRun`, along with varying styling attributes.

This library solves that complexity by allowing you to define a **Schema** that maps your document's visual structure (Headings, Lists, Key-Values) directly to data structures.

### ✨ Key Features

- **100% Type-Safe:** Use `GetParsedType<typeof schema>` to infer the exact return type from your schema—no manual type definitions needed.
- **Hierarchical Parsing:** Supports nested tree structures (e.g., _Heading 2_ containing _Heading 3_ children).
- **Consistent Structure:** Tree nodes always follow `{ title, content }` pattern for predictable data access.
- **Smart Text Parsing:** Built-in parsers for:
  - Key-Value pairs (e.g., `Skills: React, TypeScript`)
  - Delimited fields (e.g., `Engineer | Google | 2024`)
  - Flattened lists or grouped arrays.
- **Auth Ready:** Seamless integration with `google-auth-library` and `googleapis`.

---

## 📦 Installation

### Node.js / Traditional Environments

```bash
npm install @yuji-min/google-docs-parser googleapis google-auth-library
# or
yarn add @yuji-min/google-docs-parser googleapis google-auth-library
```

### Edge Runtime (Cloudflare Workers, Vercel Edge, etc.)

```bash
npm install @yuji-min/google-docs-parser
# or
yarn add @yuji-min/google-docs-parser
```

> **Note:** The Edge Runtime version (`/edge`) does **not** require `googleapis` or `google-auth-library` dependencies. It uses native Web APIs (Fetch, Web Crypto) instead.

---

## 🔑 Authentication & Setup

This library supports two runtime environments with different authentication approaches:

- **Node.js**: Uses `googleapis` and `google-auth-library` (traditional approach)
- **Edge Runtime**: Uses native Web APIs with JSON credentials (Cloudflare Workers, Vercel Edge, etc.)

To use this library, you need a Google Cloud Service Account with access to the Google Docs API.

### 1. Create Google Cloud Credentials

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project (or select an existing one).
3.  Enable the **Google Docs API** in the "APIs & Services" > "Library" section.
4.  Go to "IAM & Admin" > "Service Accounts" and create a new service account.
5.  Create and download a **JSON key** for this service account.

### 2. Configure Environment Variable

#### Node.js (File Path)

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

#### Edge Runtime (JSON String)

For Edge Runtime environments, set `GOOGLE_APPLICATION_CREDENTIALS` to the **JSON string** (not a file path):

**Cloudflare Workers (wrangler.toml):**

```toml
[vars]
GOOGLE_APPLICATION_CREDENTIALS = '''
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
'''
```

**Vercel Edge Functions:**

Add the JSON as an environment variable in your Vercel project settings, or use `.env.local` during development.

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
import {
  getParsedDocument,
  ParseSchema,
  GetParsedType,
} from "@yuji-min/google-docs-parser";

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
          // Parse the heading text with delimiter & keys!
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
} as const satisfies ParseSchema; // 'as const' is CRITICAL for type inference

// 2. Infer the return type from schema (optional but recommended)
type ResumeData = GetParsedType<typeof resumeSchema>;

// 3. Fetch and Parse
async function main() {
  const docId = "YOUR_GOOGLE_DOC_ID";

  try {
    // 'data' is fully typed as ResumeData!
    const data = await getParsedDocument(docId, resumeSchema);
    console.log(JSON.stringify(data, null, 2));

    // ✅ Full type inference - no manual types needed
    console.log(data.Profile); // string: "Senior Software Engineer..."
    const firstJob = data.Experience[0];
    console.log(firstJob.title.company); // "Tech Corp"
    console.log(firstJob.title.role); // "Backend Lead"
    console.log(firstJob.content); // ["Designed microservices...", "Managed..."]
  } catch (error) {
    console.error(error);
  }
}

main();
```

### 3. The Result

Tree nodes always have a consistent `{ title, content }` structure:

```json
{
  "Profile": "Senior Software Engineer based in Seoul.",
  "Experience": [
    {
      "title": { "company": "Tech Corp", "role": "Backend Lead" },
      "content": ["Designed microservices architecture", "Managed a team of 5"]
    },
    {
      "title": { "company": "Startup Inc", "role": "Full Stack" },
      "content": ["Built MVP in 3 months"]
    }
  ]
}
```

---

## ☁️ Edge Runtime Usage

The `/edge` export is specifically designed for Edge Runtime environments like Cloudflare Workers and Vercel Edge Functions.

### Cloudflare Workers Example

```typescript
import { getParsedDocument } from "@yuji-min/google-docs-parser/edge";
import type { ParseSchema } from "@yuji-min/google-docs-parser/edge";

const schema = {
  sections: [
    { title: { name: "Profile", namedStyleType: "HEADING_1" } },
    {
      title: { name: "Experience", namedStyleType: "HEADING_1" },
      content: {
        kind: "tree",
        node: {
          title: {
            namedStyleType: "HEADING_2",
            keys: ["company", "role"],
            delimiter: "|",
          },
          content: { kind: "list" },
        },
      },
    },
  ],
} as const satisfies ParseSchema;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Set credentials from environment variable
    process.env.GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_CREDENTIALS;

    const docId = "YOUR_GOOGLE_DOC_ID";

    try {
      const data = await getParsedDocument(docId, schema);
      return Response.json(data);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  },
};
```

### Vercel Edge Functions Example

```typescript
// app/api/docs/route.ts
import { getParsedDocument } from "@yuji-min/google-docs-parser/edge";
import type { ParseSchema } from "@yuji-min/google-docs-parser/edge";

export const runtime = "edge";

const schema = {
  /* your schema */
} as const satisfies ParseSchema;

export async function GET(request: Request) {
  // Credentials are automatically loaded from process.env.GOOGLE_APPLICATION_CREDENTIALS
  const docId = "YOUR_GOOGLE_DOC_ID";

  try {
    const data = await getParsedDocument(docId, schema);
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

### Key Differences: Node.js vs Edge Runtime

| Feature                    | Node.js (`/`)                       | Edge Runtime (`/edge`)              |
| :------------------------- | :---------------------------------- | :---------------------------------- |
| **Import Path**            | `@yuji-min/google-docs-parser`      | `@yuji-min/google-docs-parser/edge` |
| **Dependencies**           | Requires `googleapis` + auth lib    | No external dependencies            |
| **Credentials Format**     | File path or JSON string            | JSON string only                    |
| **Authentication**         | `google-auth-library`               | Native Web Crypto API               |
| **HTTP Client**            | `googleapis` client                 | Native `fetch`                      |
| **Bundle Size**            | Larger (~400KB+)                    | Smaller (~16KB)                     |
| **Supported Environments** | Node.js 18+                         | Cloudflare, Vercel Edge, Deno, etc. |

---

## 📚 Parsing Schema Guide

The `ParseSchema` object controls how the parser reads your document. Use `GetParsedType<typeof schema>` to infer the exact TypeScript type from your schema.

### Section Configuration

| Property               | Type     | Description                                                                                    |
| :--------------------- | :------- | :--------------------------------------------------------------------------------------------- |
| `title.name`           | `string` | The text of the heading to find (case-insensitive). This becomes the key in the result object. |
| `title.namedStyleType` | `string` | The Google Docs style to match (e.g., `HEADING_1`, `TITLE`).                                   |
| `content`              | `Object` | (Optional) Defines the content structure. If omitted, parses as a text block.                  |

### Content Kinds

#### 1. Text Block (Default)

If `content` is undefined, the parser collects all paragraphs following the header until the next section starts, joining them into a single string.

```typescript
// Schema
{ title: { name: "About", namedStyleType: "HEADING_1" } }

// Inferred Type → string
// Result → "Hello, I am a developer."
```

#### 2. List (`kind: "list"`)

Parses paragraphs as an array. Useful for bullet points or simple lists.

| Option         | Type       | Description                                              |
| :------------- | :--------- | :------------------------------------------------------- |
| `isFlatten`    | `boolean`  | If true, merges multiple lines into a single flat array. |
| `keyDelimiter` | `string`   | Parses `Key: Value` lines into `{ key, value }` objects. |
| `keys`         | `string[]` | Maps delimited values to named fields.                   |
| `delimiter`    | `string`   | Splits a line by a character (default: `,`).             |

```typescript
// Schema: Simple list
{ content: { kind: "list" } }
// Inferred Type → string[]
// Result → ["Item 1", "Item 2", "Item 3"]

// Schema: Keyed list (Key: Value format)
{ content: { kind: "list", keyDelimiter: ":", delimiter: "," } }
// Inferred Type → { key: string; value: string[] }[]
// Result → [{ key: "Skills", value: ["React", "TypeScript"] }]

// Schema: Mapped fields
{ content: { kind: "list", keys: ["school", "degree"], delimiter: "|" } }
// Inferred Type → { school: string; degree: string }[]
// Result → [{ school: "MIT", degree: "B.S. Computer Science" }]
```

#### 3. Tree (`kind: "tree"`)

Parses hierarchical structures. Ideal for nested sections like "H2 → H3 → Content".

- **`node`**: Defines the schema for the child nodes.
- **Strict Nesting**: The parser automatically stops collecting children when it encounters a heading of the same or higher level.

**Tree nodes always have a consistent `{ title, content }` structure:**

```typescript
// Schema
{
  content: {
    kind: "tree",
    node: {
      title: {
        namedStyleType: "HEADING_2",
        keys: ["role", "company"],
        delimiter: "|"
      },
      content: { kind: "list" }
    }
  }
}

// Inferred Type
// {
//   title: { role: string; company: string };
//   content: string[];
// }[]

// Result
[
  {
    "title": { "role": "Engineer", "company": "Google" },
    "content": ["Built APIs", "Led team"]
  }
]
```

### Title Parsing Options

The `title` field in tree nodes can be parsed in three ways:

| Configuration        | Title Type                         | Access Pattern                       |
| :------------------- | :--------------------------------- | :----------------------------------- |
| No options           | `string`                           | `node.title`                         |
| `keys` + `delimiter` | `{ [key]: string }`                | `node.title.role`                    |
| `keyDelimiter`       | `{ key: string; value: string[] }` | `node.title.key`, `node.title.value` |

---

## 🔮 Type Inference with `GetParsedType`

The library provides `GetParsedType<T>` utility type that infers the exact return type from your schema:

```typescript
import type { ParseSchema, GetParsedType } from "@yuji-min/google-docs-parser";

const schema = {
  sections: [
    { title: { name: "Bio", namedStyleType: "HEADING_1" } },
    {
      title: { name: "Skills", namedStyleType: "HEADING_1" },
      content: { kind: "list", keyDelimiter: ":", delimiter: "," },
    },
    {
      title: { name: "Career", namedStyleType: "HEADING_1" },
      content: {
        kind: "tree",
        node: {
          title: {
            namedStyleType: "HEADING_2",
            keys: ["role", "company", "period"],
            delimiter: "|",
          },
          content: { kind: "list" },
        },
      },
    },
  ],
} as const satisfies ParseSchema;

// ✅ Fully inferred type - no manual interfaces needed!
type MyData = GetParsedType<typeof schema>;

// Equivalent to:
// {
//   Bio: string;
//   Skills: { key: string; value: string[] }[];
//   Career: {
//     title: { role: string; company: string; period: string };
//     content: string[];
//   }[];
// }
```

> **Note:** Always use `as const satisfies ParseSchema` for accurate type inference.

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
