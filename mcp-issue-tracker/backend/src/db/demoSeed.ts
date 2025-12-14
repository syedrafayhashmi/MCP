import { getDatabase } from "./database.js";

const DEMO_USERS = [
  { id: "john123", email: "john@example.com", name: "John Doe" },
  { id: "jane456", email: "jane@example.com", name: "Jane Smith" },
  { id: "admin789", email: "admin@example.com", name: "Admin User" },
  { id: "dev101", email: "dev@example.com", name: "Developer" },
] as const;

const DEMO_TAGS = [
  { name: "frontend", color: "#3b82f6" },
  { name: "backend", color: "#10b981" },
  { name: "bug", color: "#ef4444" },
  { name: "feature", color: "#8b5cf6" },
  { name: "enhancement", color: "#f59e0b" },
  { name: "documentation", color: "#6b7280" },
] as const;

const DEMO_ISSUES = [
  {
    title: "Set up project structure",
    description:
      "Initialize the project with proper directory structure and configuration files.",
    status: "done",
    priority: "medium",
    assignedUserId: "john123",
    createdByUserId: "admin789",
    tags: ["backend"],
  },
  {
    title: "Design user authentication flow",
    description:
      "Create wireframes and user flows for the authentication system including sign up, sign in, and password reset.",
    status: "in_progress",
    priority: "high",
    assignedUserId: "jane456",
    createdByUserId: "admin789",
    tags: ["frontend", "feature"],
  },
  {
    title: "Fix issue list filtering",
    description:
      'The issue list filter by status is not working correctly. When selecting "in progress", it shows all issues.',
    status: "not_started",
    priority: "urgent",
    assignedUserId: "john123",
    createdByUserId: "jane456",
    tags: ["frontend", "bug"],
  },
  {
    title: "Add dark mode support",
    description:
      "Implement dark mode toggle functionality with proper theme switching and persistence.",
    status: "not_started",
    priority: "medium",
    assignedUserId: null,
    createdByUserId: "dev101",
    tags: ["frontend", "enhancement"],
  },
  {
    title: "API documentation",
    description:
      "Create comprehensive API documentation with examples for all endpoints.",
    status: "not_started",
    priority: "low",
    assignedUserId: "dev101",
    createdByUserId: "admin789",
    tags: ["documentation"],
  },
  {
    title: "Database performance optimization",
    description:
      "Review and optimize database queries for better performance, especially for the issues list with filtering.",
    status: "not_started",
    priority: "high",
    assignedUserId: null,
    createdByUserId: "admin789",
    tags: ["backend", "enhancement"],
  },
] as const;

export async function seedDemoDataIfEmpty(): Promise<{
  seeded: boolean;
  reason?: string;
}> {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;

  try {
    db = await getDatabase();

    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('issues','tags','issue_tags','user')"
    );
    const tableNames = new Set(tables.map((row: any) => row?.name).filter(Boolean));

    if (!tableNames.has("issues") || !tableNames.has("tags") || !tableNames.has("issue_tags") || !tableNames.has("user")) {
      return { seeded: false, reason: "Required tables missing (run migrations first)" };
    }

    const existingIssue = await db.get("SELECT id FROM issues LIMIT 1");
    if (existingIssue?.id) {
      return { seeded: false, reason: "Issues already exist" };
    }

    const now = new Date().toISOString();

    for (const user of DEMO_USERS) {
      await db.run(
        "INSERT OR IGNORE INTO user (id, email, name, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [user.id, user.email, user.name, 0, now, now]
      );
    }

    for (const tag of DEMO_TAGS) {
      await db.run(
        "INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)",
        [tag.name, tag.color]
      );
    }

    const tagRows = await db.all("SELECT id, name FROM tags");
    const tagIdByName = new Map<string, number>();
    for (const row of tagRows) {
      if (typeof row?.name === "string" && typeof row?.id === "number") {
        tagIdByName.set(row.name, row.id);
      }
    }

    for (const issue of DEMO_ISSUES) {
      const result = await db.run(
        "INSERT INTO issues (title, description, status, priority, assigned_user_id, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)",
        [
          issue.title,
          issue.description,
          issue.status,
          issue.priority,
          issue.assignedUserId,
          issue.createdByUserId,
        ]
      );

      const issueId = result.lastID as number;
      for (const tagName of issue.tags) {
        const tagId = tagIdByName.get(tagName);
        if (!tagId) continue;
        await db.run(
          "INSERT OR IGNORE INTO issue_tags (issue_id, tag_id) VALUES (?, ?)",
          [issueId, tagId]
        );
      }
    }

    return { seeded: true };
  } finally {
    if (db) {
      await db.close().catch(() => {});
    }
  }
}
