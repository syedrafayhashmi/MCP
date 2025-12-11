import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, "..", "database.sqlite");

const db = new Database(dbPath);

const rows = db.prepare(`SELECT id, userId, key, enabled, createdAt FROM apikey`).all();
console.log(rows);

db.close();
