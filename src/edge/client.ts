import type { DocsDocument } from "./types";
import { createAuthenticatedClient } from "./auth";

/**
 * Fetches a document from the Google Docs API.
 */
export async function fetchDocument(
  documentId: string,
  accessToken: string
): Promise<DocsDocument> {
  const url = `https://docs.googleapis.com/v1/documents/${documentId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Docs API request failed: ${response.status} ${errorText}`
    );
  }

  const data = (await response.json()) as DocsDocument;

  if (!data.body) {
    throw new Error("Empty document response from Google Docs API.");
  }

  return data;
}

/**
 * Fetches a document with authentication (combined function).
 */
export async function getDocument(documentId: string): Promise<DocsDocument> {
  const accessToken = await createAuthenticatedClient();
  return fetchDocument(documentId, accessToken);
}
