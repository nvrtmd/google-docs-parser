import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDocsClient } from "../src/auth";
import { GoogleAuth } from "google-auth-library";
import { google } from "googleapis";

// ======================================================================
// Global Mocks
// ======================================================================
vi.mock("google-auth-library", () => {
  return {
    GoogleAuth: vi.fn().mockImplementation(function () {}),
  };
});

vi.mock("googleapis", () => {
  return {
    google: {
      docs: vi.fn(),
    },
  };
});

// ======================================================================
// 1. Core Function: createDocsClient
// ======================================================================
/**
 * Verifies that the Google Docs client is correctly instantiated with the
 * appropriate authentication scopes and API version.
 */
describe("createDocsClient", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("Initialization & Configuration", () => {
    it("should initialize GoogleAuth with the 'documents.readonly' scope", () => {
      // Arrange
      const mockAuthInstance = {};
      (GoogleAuth as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        function () {
          return mockAuthInstance;
        }
      );

      // Act
      createDocsClient();

      // Assert
      expect(GoogleAuth).toHaveBeenCalledWith({
        scopes: ["https://www.googleapis.com/auth/documents.readonly"],
      });
    });

    it("should create the Docs client using version 'v1' and the authenticated instance", () => {
      // Arrange
      const mockAuthInstance = { client: "mock-client" };
      const mockDocsClient = { context: "docs-v1-client" };

      (GoogleAuth as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        function () {
          return mockAuthInstance;
        }
      );
      (google.docs as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
        mockDocsClient
      );

      // Act
      const result = createDocsClient();

      // Assert
      expect(google.docs).toHaveBeenCalledWith({
        version: "v1",
        auth: mockAuthInstance,
      });
      expect(result).toBe(mockDocsClient);
    });
  });

  describe("Error Handling", () => {
    it("should throw a wrapped error if GoogleAuth initialization fails", () => {
      // Arrange
      const originalError = new Error("Missing credentials file");
      (GoogleAuth as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        function () {
          throw originalError;
        }
      );

      // Act & Assert
      expect(() => createDocsClient()).toThrow(
        "Failed to initialize Google Docs client. Check setup and credentials."
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error initializing Google Docs client:",
        originalError
      );
    });

    it("should throw a wrapped error if the google.docs factory function fails", () => {
      // Arrange
      const originalError = new Error("Invalid API options");

      (GoogleAuth as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        function () {
          return {};
        }
      );

      (google.docs as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw originalError;
        }
      );

      // Act & Assert
      expect(() => createDocsClient()).toThrow(
        "Failed to initialize Google Docs client. Check setup and credentials."
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error initializing Google Docs client:",
        originalError
      );
    });
  });
});
