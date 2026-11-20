import "server-only";
import { LocalQuery, LocalRpc } from "./query";
import { executeQuery } from "./database";
import { createUser, deleteUser, getUser, listUsers, tokenFor, updateUser, userFromToken } from "./auth";

const execute = (request: Parameters<typeof executeQuery>[0]) => executeQuery(request, { admin: true });

export function createLocalAdminClient() {
  return {
    from: (table: string) => new LocalQuery(execute, table),
    rpc: (name: string, args: Record<string, unknown> = {}) => new LocalRpc(execute, name, args),
    auth: {
      getUser: async (token: string) => ({ data: { user: await userFromToken(token) }, error: null }),
      admin: {
        createUser: ({ email, password, user_metadata }: { email: string; password: string; email_confirm?: boolean; user_metadata?: Record<string, unknown> }) => createUser({ email, password, user_metadata }),
        deleteUser,
        updateUserById: (id: string, input: { password?: string; user_metadata?: Record<string, unknown> }) => updateUser(id, input),
        getUserById: async (id: string) => ({ data: { user: await getUser(id) }, error: null }),
        listUsers: async ({ page = 1, perPage = 50 }: { page?: number; perPage?: number } = {}) => {
          const users = await listUsers();
          return { data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null };
        },
        generateLink: async ({ email, options }: { type: string; email: string; options?: { redirectTo?: string } }) => {
          const users = await listUsers();
          const user = users.find((item) => item.email.toLowerCase() === email.toLowerCase());
          if (!user) return { data: { properties: null }, error: { message: "User not found." } };
          const token = await tokenFor(user, "magic", "10m");
          const origin = options?.redirectTo ? new URL(options.redirectTo).origin : "";
          const next = options?.redirectTo ?? "/";
          return { data: { properties: { action_link: `${origin}/api/local/auth/magic?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}` } }, error: null };
        },
      },
    },
  };
}
