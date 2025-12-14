import { createDatabase } from "../db/database.js";

export async function checkDatabaseHealth(): Promise<{
  status: "healthy" | "unhealthy";
  tables?: string[];
  error?: string;
}> {
  try {
    const db = await createDatabase();

    const tables = await db.all(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    await db.close();
    return {
      status: "healthy",
      tables: tables.map((t: any) => t.name),
    };
  } catch (error) {
    console.error("Database health check failed:", error);
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}
