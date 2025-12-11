import { FastifyPluginAsync } from "fastify";
import { getDatabase } from "../db/database.js";
import type { AuthenticatedRequest } from "../middleware.js";
import { combinedAuthMiddleware } from "../middleware/apiKey.js";

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

const usersRoute: FastifyPluginAsync = async function (fastify) {
  // Add auth middleware to all routes in this plugin (unless in test mode)
  if (!(fastify as any).skipAuth) {
    fastify.addHook("preHandler", combinedAuthMiddleware as any);
  } else {
    // In test mode, add a mock user
    fastify.addHook(
      "preHandler",
      async (request: AuthenticatedRequest, reply) => {
        request.user = {
          id: "test-user-1",
          email: "test@example.com",
          name: "Test User",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    );
  }

  // GET /api/users - Get all users (for assignment dropdown)
  fastify.get("/", async function (request, reply) {
    let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
    try {
      db = await getDatabase();
      if (!db) {
        throw new Error("Failed to acquire database connection");
      }

      // Get users from the BetterAuth user table
      const users = await db.all(`
        SELECT id, name, email, emailVerified, image, createdAt, updatedAt 
        FROM user 
        ORDER BY name ASC
      `);

      return {
        success: true,
        data: users,
        count: users.length,
      };
    } catch (error) {
      fastify.log.error("Error fetching users:", error);
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch users",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      if (db) {
        await db.close();
      }
    }
  });

  // GET /api/users/:id - Get specific user
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async function (request, reply) {
      let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
      try {
        const { id } = request.params;

        db = await getDatabase();
        if (!db) {
          throw new Error("Failed to acquire database connection");
        }

        const user = await db.get(
          `
        SELECT id, name, email, emailVerified, image, createdAt, updatedAt 
        FROM user 
        WHERE id = ?
      `,
          [id]
        );

        if (!user) {
          return reply.status(404).send({
            success: false,
            error: "User not found",
            message: `User with ID ${id} does not exist`,
          });
        }

        return {
          success: true,
          data: user,
        };
      } catch (error) {
        fastify.log.error("Error fetching user:", error);
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch user",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        if (db) {
          await db.close();
        }
      }
    }
  );
};

export default usersRoute;
