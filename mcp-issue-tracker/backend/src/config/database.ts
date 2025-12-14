import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = path.resolve(__dirname, "..", "..", "database.sqlite");

function ensureDirectoryExists(filePath: string) {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

export function resolveDatabasePath(): string {
  const customPath = process.env.DATABASE_PATH?.trim();
  const candidate = customPath
    ? path.isAbsolute(customPath)
      ? customPath
      : path.resolve(process.cwd(), customPath)
    : defaultDatabasePath;

  ensureDirectoryExists(candidate);
  return candidate;
}

export const DEFAULT_DATABASE_PATH = defaultDatabasePath;
