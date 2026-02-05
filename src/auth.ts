import { google, docs_v1 } from "googleapis";
import { GoogleAuth } from "google-auth-library";

/**
 * Creates and configures a Google Docs API client instance.
 *
 * This function handles authentication using `GoogleAuth` with the read-only scope
 * and initializes the `googleapis` Docs service with version 'v1'.
 *
 * The function automatically detects the credential format from GOOGLE_APPLICATION_CREDENTIALS:
 * - If it's a JSON string (starts with '{'): Parses and uses it directly
 * - If it's a file path: Lets GoogleAuth handle it automatically by passing undefined
 *
 * @returns An initialized `docs_v1.Docs` client ready for API calls.
 * @throws {Error} If client initialization fails (e.g., missing credentials or configuration errors).
 */
export function createDocsClient(): docs_v1.Docs {
  try {
    const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let credentials;

    if (credentialsEnv?.trim().startsWith("{")) {
      credentials = JSON.parse(credentialsEnv);
    }

    const auth = new GoogleAuth({
      credentials,
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
