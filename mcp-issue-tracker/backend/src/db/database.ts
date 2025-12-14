import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveDatabasePath } from "../config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = resolveDatabasePath();

export interface Database {
  run: (sql: string, params?: any[]) => Promise<{ lastID: number; changes: number }>;
  get: (sql: string, params?: any[]) => Promise<any>;
  all: (sql: string, params?: any[]) => Promise<any[]>;
  exec: (sql: string) => Promise<void>;
  close: () => Promise<void>;
}

export class DatabaseConnection {
  public db: Database.Database;
  public run: (sql: string, params?: any[]) => Promise<{ lastID: number; changes: number }>;
  public get: (sql: string, params?: any[]) => Promise<any>;
  public all: (sql: string, params?: any[]) => Promise<any[]>;
  public close: () => Promise<void>;
  public exec: (sql: string) => Promise<void>;

  constructor(db: Database.Database) {
    this.db = db;

    this.run = async (sql: string, params?: any[]) => {
      const statement = this.db.prepare(sql);
      const result = statement.run(params ?? []);
      return {
        lastID: Number(result.lastInsertRowid),
        changes: result.changes,
      };
    };

    this.get = async (sql: string, params?: any[]) => {
      const statement = this.db.prepare(sql);
      return statement.get(params ?? []);
    };

    this.all = async (sql: string, params?: any[]) => {
      const statement = this.db.prepare(sql);
      return statement.all(params ?? []);
    };

    this.exec = async (sql: string) => {
      this.db.exec(sql);
    };

    this.close = async () => {
      this.db.close();
    };
  }
}

export async function createDatabase(): Promise<Database> {
  try {
    const db = new Database(DB_PATH);
    db.pragma("foreign_keys = ON");
    if (process.env.NODE_ENV !== "test") {
      console.log("Connected to SQLite database at:", DB_PATH);
    }
    return new DatabaseConnection(db);
  } catch (err) {
    console.error("Error opening database:", err);
    throw err;
  }
}

export async function runMigrations(): Promise<void> {
  const db = await createDatabase();

  try {
    // Enable foreign keys
    await db.run("PRAGMA foreign_keys = ON");

    const migrationsDirCandidates = [
      path.resolve(process.cwd(), "src", "db", "migrations"),
      path.join(__dirname, "migrations"),
    ];

    const migrationsDir = migrationsDirCandidates.find((candidate) =>
      fs.existsSync(candidate)
    );

    if (!migrationsDir) {
      throw new Error(
        `Migrations directory not found. Tried: ${migrationsDirCandidates.join(", ")}`
      );
    }
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (process.env.NODE_ENV !== "test") {
      console.log("Running database migrations...");
    }

      for (const file of migrationFiles) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, "utf8");

        if (process.env.NODE_ENV !== "test") {
          console.log("Running migration: " + file);
        }

        try {
          await db.exec(sql);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (
            error &&
            (message.includes("already exists") || message.includes("duplicate column name"))
          ) {
            console.log(`Skipping migration ${file} (already applied)`);
          } else {
            throw error;
          }
        }
      }

    if (process.env.NODE_ENV !== "test") {
      console.log("All migrations completed successfully!");
    }
  } catch (error) {
    console.error("Error running migrations:", error);
    throw error;
  } finally {
    await db.close();
  }
}

export async function getDatabase(): Promise<Database> {
  // Use test database if we're in test environment
  if (process.env.NODE_ENV === "test") {
    const { testDb } = await import("../tests/setup.js");
    // Enable foreign keys for test database
    await testDb.run("PRAGMA foreign_keys = ON");
    return testDb;
  }

  const db = await createDatabase();
  // Enable foreign keys for this connection
  await db.run("PRAGMA foreign_keys = ON");
  return db;
}
