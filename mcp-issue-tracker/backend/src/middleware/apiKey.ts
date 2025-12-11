import { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "../auth.js";
import crypto from "crypto";
import { getDatabase } from "../db/database.js";

export interface ApiKeyRequest extends FastifyRequest {
  apiKeyId?: string;
  userId?: string;
}

/**
 * API Key validation middleware
 * Validates the x-api-key header and extracts user information
 */
export async function apiKeyMiddleware(
  request: ApiKeyRequest,
  reply: FastifyReply
) {
  try {
    const apiKeyHeader = request.headers["x-api-key"];
    const apiKey = typeof apiKeyHeader === "string" ? apiKeyHeader.trim() : Array.isArray(apiKeyHeader) ? apiKeyHeader[0]?.trim() : undefined;

    if (!apiKey) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "API key required (x-api-key header)",
        code: "MISSING_API_KEY",
      });
    }

    let db;
    try {
      db = await getDatabase();
      
      // Hash the provided key to compare with stored hash
      const keyHash = crypto.createHash("sha256").update(apiKey).digest("base64url");
      
      const storedKey = await db.get(
        "SELECT id, userId, enabled FROM apikey WHERE key = ?",
        [keyHash]
      );

      if (!storedKey) {
        return reply.status(401).send({
          error: "Unauthorized",
          message: "Invalid API key",
          code: "INVALID_API_KEY",
        });
      }

      if (!storedKey.enabled) {
        return reply.status(401).send({
          error: "Unauthorized",
          message: "API key is disabled",
          code: "API_KEY_DISABLED",
        });
      }

      // Store the API key metadata on the request
      request.apiKeyId = storedKey.id;
      request.userId = storedKey.userId;
      
      // Also set up a user object for compatibility with routes
      // This allows API key auth to work alongside session auth
      (request as any).user = {
        id: storedKey.userId,
        email: "api-key-user",
        name: "API Key User",
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (dbError) {
      console.error("API key validation database error:", dbError);
      if (db) await db.close().catch(() => {});
      return reply.status(500).send({
        error: "Internal Server Error",
        message: "Failed to validate API key",
        code: "VALIDATION_ERROR",
      });
    } finally {
      if (db) await db.close().catch(() => {});
    }
  } catch (error) {
    console.error("API key middleware error:", error);
    return reply.status(500).send({
      error: "Internal Server Error",
      message: "API key validation failed",
      code: "MIDDLEWARE_ERROR",
    });
  }
}

/**
 * Combined auth middleware - accepts either session cookies or API key
 * Tries session first, then falls back to API key if no session
 */
export async function combinedAuthMiddleware(
  request: ApiKeyRequest,
  reply: FastifyReply
) {
  const apiKeyHeader = request.headers["x-api-key"];
  const apiKey =
    typeof apiKeyHeader === "string"
      ? apiKeyHeader.trim()
      : Array.isArray(apiKeyHeader)
      ? apiKeyHeader[0]?.trim()
      : undefined;

  // If API key is provided, use API key auth
  if (apiKey) {
    return apiKeyMiddleware(request, reply);
  }

  // Otherwise, try session auth
  try {
    const headers = new Headers();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (value) {
        const headerValue = Array.isArray(value) ? value[0] : value;
        if (typeof headerValue === "string") {
          headers.append(key, headerValue);
        }
      }
    });

    const session = await auth.api.getSession({
      headers: headers,
    });

    if (!session?.user) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Authentication required (session or API key)",
      });
    }

    // Attach user to request
    (request as any).user = {
      ...session.user,
      image: session.user.image ?? null,
    };
  } catch (error) {
    console.error("Combined auth middleware error:", error);
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Invalid authentication",
    });
  }
}

