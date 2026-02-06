/**
 * Type definitions for Google Docs API in Edge Runtime.
 * Can be used without the googleapis package.
 */

/**
 * Service Account credentials.
 */
export interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

/**
 * OAuth2 token response.
 */
export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Google Docs API response type.
 * Compatible with googleapis' docs_v1.Schema$Document.
 */
export interface DocsDocument {
  documentId?: string;
  title?: string;
  body?: {
    content?: Array<{
      paragraph?: {
        elements?: Array<{
          textRun?: {
            content?: string;
            textStyle?: unknown;
          };
        }>;
        paragraphStyle?: {
          namedStyleType?: string;
          [key: string]: unknown;
        };
        bullet?: {
          listId?: string;
          nestingLevel?: number;
        };
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }>;
  };
  [key: string]: unknown;
}
