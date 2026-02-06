import type { ServiceAccountCredentials, TokenResponse } from "./types";

/**
 * Encodes data in Base64 URL format (JWT standard).
 */
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Converts a string to Uint8Array.
 */
function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Converts a PEM-formatted private key to CryptoKey.
 */
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  // Remove PEM header/footer and decode Base64
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
}

/**
 * Creates and signs a JWT.
 */
async function createSignedJWT(
  credentials: ServiceAccountCredentials,
  scope: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // Expires in 1 hour

  // JWT Header
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  // JWT Payload
  const payload = {
    iss: credentials.client_email,
    scope,
    aud: credentials.token_uri,
    exp: expiry,
    iat: now,
  };

  // Base64 URL encode Header and Payload
  const encodedHeader = base64UrlEncode(
    stringToUint8Array(JSON.stringify(header))
  );
  const encodedPayload = base64UrlEncode(
    stringToUint8Array(JSON.stringify(payload))
  );

  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Sign with Private Key
  const privateKey = await importPrivateKey(credentials.private_key);
  const dataToSign = stringToUint8Array(unsignedToken);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    dataToSign as BufferSource
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `${unsignedToken}.${encodedSignature}`;
}

/**
 * Obtains a Google OAuth2 access token.
 */
async function getAccessToken(
  credentials: ServiceAccountCredentials
): Promise<string> {
  const scope = "https://www.googleapis.com/auth/documents.readonly";
  const jwt = await createSignedJWT(credentials, scope);

  const response = await fetch(credentials.token_uri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get access token: ${response.status} ${errorText}`
    );
  }

  const data = (await response.json()) as TokenResponse;
  return data.access_token;
}

/**
 * Loads Service Account credentials from environment variables.
 */
export function loadCredentials(): ServiceAccountCredentials {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credentialsEnv) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS environment variable is not set"
    );
  }

  try {
    // If it's a JSON string, parse it
    if (credentialsEnv.trim().startsWith("{")) {
      return JSON.parse(credentialsEnv) as ServiceAccountCredentials;
    }

    // File path not supported in Edge Runtime
    throw new Error(
      "File path credentials are not supported in Edge Runtime. Use JSON string instead."
    );
  } catch (error) {
    throw new Error(
      `Failed to parse credentials: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Creates an authenticated Google Docs API client.
 */
export async function createAuthenticatedClient(): Promise<string> {
  const credentials = loadCredentials();
  return getAccessToken(credentials);
}
