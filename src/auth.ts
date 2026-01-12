import { google, docs_v1 } from "googleapis";
import { GoogleAuth } from "google-auth-library";

/**
 * Creates and configures a Google Docs API client instance.
 *
 * This function handles authentication using `GoogleAuth` with the read-only scope
 * and initializes the `googleapis` Docs service with version 'v1'.
 *
 * @returns An initialized `docs_v1.Docs` client ready for API calls.
 * @throws {Error} If client initialization fails (e.g., missing credentials or configuration errors).
 */
export function createDocsClient(): docs_v1.Docs {
  try {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/documents.readonly"],
    });

    return google.docs({
      version: "v1",
      auth,
    });
  } catch (error) {
    console.error("Error initializing Google Docs client:", error);
    throw new Error(
      "Failed to initialize Google Docs client. Check setup and credentials."
    );
  }
}
