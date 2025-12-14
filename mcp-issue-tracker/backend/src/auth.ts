import { betterAuth } from "better-auth";
import { apiKey } from "better-auth/plugins";
import Database from "better-sqlite3";
import { resolveDatabasePath } from "./config/database.js";

// Create the database connection with correct path
const dbPath = resolveDatabasePath();
const db = new Database(dbPath);

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5174";
const backendPort = process.env.PORT ?? "4000";
const backendHost = process.env.HOST ?? "localhost";
const betterAuthBaseUrl =
  process.env.BETTER_AUTH_BASE_URL ?? `http://${backendHost}:${backendPort}/api/auth`;
const backendOrigin = new URL(betterAuthBaseUrl).origin;

const authConfig = {
  database: db,
  baseURL: betterAuthBaseUrl,
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [frontendUrl, backendOrigin],
  plugins: [
    apiKey({
      defaultPrefix: "issues_",
      enableMetadata: true,
    }),
  ],
};

// Create auth instance
const authInstance = betterAuth(authConfig);

// Add event handlers after creating the instance
// Note: In Better Auth 1.3.x, events might need to be handled differently
// For now, we'll use a hook-based approach in the sign-up endpoint

export const auth = {
  handler: authInstance.handler,
  api: authInstance.api,
};
