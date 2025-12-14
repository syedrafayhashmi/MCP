import { z } from "zod";
import {
  makeRequest,
  listIssues,
  createIssue,
  getIssue,
  updateIssue,
  deleteIssue,
  listTags,
  createTag,
  deleteTag,
  listUsers,
  verifyApiKey,
  getHealthStatus,
  getHealthReady,
  getHealthLive,
} from "../src/lib/apiClient.js";

export default function apiBasedTools(server) {

  // Issues Tools

  server.registerTool(
    "issues-list",
    {
      title: "List Issues",
      description: "Get a list of issues with optional filtering",
      inputSchema: {
        status: z
          .enum(["not_started", "in_progress", "done"])
          .optional()
          .describe("Filter by status"),
        assigned_user_id: z
          .string()
          .optional()
          .describe("Filter by assigned user ID"),
        tag_id: z
          .union([z.number(), z.string()])
          .optional()
          .describe("Filter by tag ID"),
        search: z
          .string()
          .optional()
          .describe("Search in title and description"),
        page: z.number().optional().describe("Page number (default: 1)"),
        limit: z
          .number()
          .optional()
          .describe("Items per page (default: 10, max: 100)"),
        priority: z
          .enum(["low", "medium", "high", "urgent"])
          .optional()
          .describe("Filter by priority"),
        created_by_user_id: z
          .string()
          .optional()
          .describe("Filter by creator user ID"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async (params) => {
      const { apiKey, ...queryParams } = params;

      const result = await listIssues(queryParams, apiKey);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "issues-create",
    {
      title: "Create Issue",
      description: "Create a new issue",
      inputSchema: {
        title: z.string().describe("Issue title"),
        description: z.string().optional().describe("Issue description"),
        status: z
          .enum(["not_started", "in_progress", "done"])
          .optional()
          .describe("Issue status"),
        priority: z
          .enum(["low", "medium", "high", "urgent"])
          .optional()
          .describe("Issue priority"),
        assigned_user_id: z.string().optional().describe("Assigned user ID"),
        tag_ids: z.array(z.number()).optional().describe("Array of tag IDs"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async (params) => {
      const { apiKey, ...issueData } = params;

      const result = await createIssue(issueData, apiKey);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "issues-get",
    {
      title: "Get Issue by ID",
      description: "Get a specific issue by its ID",
      inputSchema: {
        id: z.number().describe("Issue ID"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async ({ id, apiKey }) => {
      const result = await getIssue(id, apiKey);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "issues-update",
    {
      title: "Update Issue",
      description: "Update an existing issue",
      inputSchema: {
        id: z.number().describe("Issue ID"),
        title: z.string().optional().describe("Issue title"),
        description: z.string().optional().describe("Issue description"),
        status: z
          .enum(["not_started", "in_progress", "done"])
          .optional()
          .describe("Issue status"),
        priority: z
          .enum(["low", "medium", "high", "urgent"])
          .optional()
          .describe("Issue priority"),
        assigned_user_id: z.string().optional().describe("Assigned user ID"),
        tag_ids: z.array(z.number()).optional().describe("Array of tag IDs"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async (params) => {
      const { id, apiKey, ...updateData } = params;

      const result = await updateIssue(id, updateData, apiKey);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "issues-delete",
    {
      title: "Delete Issue",
      description: "Delete an issue by ID",
      inputSchema: {
        id: z.number().describe("Issue ID"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async ({ id, apiKey }) => {
      const result = await deleteIssue(id, apiKey);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Tags Tools

  server.registerTool(
    "tags-list",
    {
      title: "List Tags",
      description: "Get all available tags",
      inputSchema: {
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async ({ apiKey }) => {
      const result = await listTags(apiKey);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "tags-create",
    {
      title: "Create Tag",
      description: "Create a new tag",
      inputSchema: {
        name: z.string().describe("Tag name"),
        color: z.string().describe("Tag color (hex format)"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async (params) => {
      const { apiKey, ...tagData } = params;

      const result = await createTag(tagData, apiKey);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "tags-delete",
    {
      title: "Delete Tag",
      description: "Delete a tag by ID",
      inputSchema: {
        id: z.number().describe("Tag ID"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async ({ id, apiKey }) => {
      const result = await deleteTag(id, apiKey);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Users Tools

  server.registerTool(
    "users-list",
    {
      title: "List Users",
      description: "Get all users",
      inputSchema: {
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async ({ apiKey }) => {
      const result = await listUsers(apiKey);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // API Key Tools

  server.registerTool(
    "api-key-verify",
    {
      title: "Verify API Key",
      description: "Verify if an API key is valid",
      inputSchema: {
        apiKey: z.string().describe("API key to verify"),
      },
    },
    async ({ apiKey }) => {
      const result = await verifyApiKey(apiKey);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Health Check Tools

  server.registerTool(
    "health-status",
    {
      title: "Health Status",
      description: "Get the health status of the API",
    },
    async () => {
      const result = await getHealthStatus();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "health-ready",
    {
      title: "Readiness Probe",
      description: "Check if the API is ready to serve requests",
    },
    async () => {
      const result = await getHealthReady();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "health-live",
    {
      title: "Liveness Probe",
      description: "Check if the API is alive",
    },
    async () => {
      const result = await getHealthLive();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
