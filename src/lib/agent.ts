import { createAgentStack, defineMcpTool } from '@buildbase/sdk/mcp';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Fail fast on missing configuration — a clear error at build/boot beats a
// broken discovery surface or unverifiable tokens at runtime.
// ---------------------------------------------------------------------------
const missingEnv = [
  'NEXT_PUBLIC_BUILDBASE_SERVER_URL',
  'NEXT_PUBLIC_BUILDBASE_ORG_ID',
  'NEXT_PUBLIC_SITE_URL',
  'BUILDBASE_AGENT_CLIENT_SECRET',
  'SYSTEM_SECRET',
].filter((k) => !process.env[k]);
if (missingEnv.length) {
  throw new Error(
    `Missing required env: ${missingEnv.join(', ')} — copy .env.example to .env.local and fill it in.`
  );
}

// ---------------------------------------------------------------------------
// ToolError — messages safe to show the calling agent. Anything else thrown
// by a tool is redacted to a generic message in production (see
// formatToolError below); the full error always reaches onError for logging.
// ---------------------------------------------------------------------------
export class ToolError extends Error {}

// ---------------------------------------------------------------------------
// Per-user sliding-window rate limit. In-memory: correct per instance, not
// shared across serverless instances — back with Redis/KV (or an edge
// limiter in front of /mcp) when you scale out.
// ---------------------------------------------------------------------------
const RL_WINDOW_MS = 60_000;
const RL_MAX_REQUESTS = 120;
const rlBuckets = new Map<string, number[]>();

function rateLimit(auth: { userId?: string; sessionId: string } | null) {
  const key = auth?.userId ?? auth?.sessionId ?? 'anonymous';
  const now = Date.now();
  const hits = (rlBuckets.get(key) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  if (hits.length >= RL_MAX_REQUESTS) {
    rlBuckets.set(key, hits);
    return { ok: false, retryAfter: Math.ceil((RL_WINDOW_MS - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  rlBuckets.set(key, hits);
  if (rlBuckets.size > 10_000) rlBuckets.clear(); // crude memory backstop
  return true;
}

// ---------------------------------------------------------------------------
// In-memory project store for exercising CRUD over MCP.
// This is a demo store: it lives in process memory (no DB in this starter),
// so it resets on server restart and is NOT shared across serverless
// instances. Swap `projectStore` for your real DB to make it durable.
// Stashed on globalThis so Next.js HMR reloads don't wipe it between edits.
// ---------------------------------------------------------------------------
interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  ownerId: string;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
}

const g = globalThis as unknown as { __projectStore?: Map<string, Project> };
const projectStore: Map<string, Project> = (g.__projectStore ??= new Map());

// A caller may only see/touch their own projects (scoped by acting user).
function ownerId(ctx: { auth: { userId?: string } }): string {
  const id = ctx.auth.userId;
  if (!id) throw new ToolError('Unauthenticated: no acting user on the token.');
  return id;
}

function ownedProject(id: string, owner: string): Project {
  const p = projectStore.get(id);
  if (!p || p.ownerId !== owner) throw new ToolError(`Project not found: ${id}`);
  return p;
}

// One config → MCP server + full agent-discovery surface.
// Derived: MCP endpoint, server card, RFC 9728 protected-resource metadata,
// API catalog, token verification (HS256 + encrypted sid), CORS, Link header.
export const agent = createAgentStack({
  serverUrl: process.env.NEXT_PUBLIC_BUILDBASE_SERVER_URL!,
  orgId: process.env.NEXT_PUBLIC_BUILDBASE_ORG_ID!,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  site: {
    name: 'Agent-Ready SaaS',
    description:
      'Next.js starter on @buildbase/sdk with a live MCP server and agent discovery.',
  },
  secret: process.env.SYSTEM_SECRET!,
  mcp: {
    // Serve at /mcp so the endpoint URL equals the canonical RFC 9728
    // resource (<host>/mcp) — MCP clients reject a mismatch.
    path: '/mcp',
    // The COMPLETE catalog of built-in tools (all 42), listed explicitly so
    // narrowing is just deleting lines. Every call runs under the granting
    // user's session — an agent can never exceed its user's permissions.
    // For production, prune this list to exactly what your product wants
    // agents to do (or use 'readonly' for reads only).
    builtinTools: {
      include: [
        // ── Reads: workspace & users ────────────────────────────────────
        'list_workspaces', 'get_workspace', 'list_workspace_users',
        'get_user_profile',
        // ── Reads: billing & plans ──────────────────────────────────────
        'get_subscription', 'get_plans', 'get_plan_versions',
        'get_plan_version', 'get_public_plans', 'list_invoices',
        'get_invoice',
        // ── Reads: quota & usage ────────────────────────────────────────
        'get_quota_usage', 'get_all_quota_usage', 'get_usage_logs',
        // ── Reads: credits ──────────────────────────────────────────────
        'get_credit_balance', 'list_credit_transactions',
        'get_credit_packages', 'get_credit_buckets', 'get_expiring_credits',
        'get_public_credit_packages',
        // ── Reads: features, permissions, settings ──────────────────────
        'check_feature_flag', 'check_permission', 'resolve_permissions',
        'get_settings',
        // ── Writes: workspace & members ─────────────────────────────────
        'create_workspace', 'update_workspace',
        'invite_workspace_user', 'update_workspace_user_role',
        'update_user_profile',
        // ── Writes: usage, credits, notifications ───────────────────────
        'record_usage', 'record_usage_batch', 'consume_credits',
        'purchase_credits', 'send_notification',
        // ── Writes: billing ─────────────────────────────────────────────
        'create_subscription_checkout', 'update_subscription',
        'resume_subscription', 'get_billing_portal_url',
        // ── Destructive — remove these first when narrowing ─────────────
        'delete_workspace', 'remove_workspace_user', 'cancel_subscription',
        'update_feature_flag',
      ],
    },
    // Production hardening. maxRequestBytes defaults to 1 MiB (413 above it);
    // CORS defaults to * which is safe for a Bearer-token API. Add
    // allowedOrigins: ['https://…'] if browser-based MCP clients must be
    // restricted (non-browser clients send no Origin and always pass).
    handler: {
      rateLimit: (auth) => rateLimit(auth),
      onError: (error, ctx) => {
        console.error(`[mcp] ${ctx.method}${ctx.tool ? ` tool=${ctx.tool}` : ''}:`, error);
      },
      // Agents see ToolError messages verbatim (they're written for them);
      // anything else is redacted in production — full detail goes to onError.
      formatToolError: (error) =>
        error instanceof ToolError || process.env.NODE_ENV !== 'production'
          ? error.message
          : 'Tool execution failed.',
    },
    tools: [
      defineMcpTool({
        name: 'app_health',
        description: 'Liveness check for this app. Returns status and app version.',
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
        execute: async () => ({
          status: 'ok',
          app: 'nextjs-agent-mcp-starter',
          sdk: '0.0.54',
        }),
      }),

      // ---- Project CRUD (demo in-memory store) ----------------------------

      defineMcpTool({
        name: 'create_project',
        description:
          'Create a project owned by the calling user. Returns the created project.',
        inputSchema: z.object({
          name: z.string().min(1).max(120).describe('Project name.'),
          description: z.string().max(2000).optional().describe('Optional details.'),
        }),
        annotations: { title: 'Create project' },
        execute: async (input, ctx) => {
          const now = new Date().toISOString();
          const project: Project = {
            id: randomUUID(),
            name: input.name,
            description: input.description ?? '',
            status: 'active',
            ownerId: ownerId(ctx),
            workspaceId: ctx.workspaceId,
            createdAt: now,
            updatedAt: now,
          };
          projectStore.set(project.id, project);
          return project;
        },
      }),

      defineMcpTool({
        name: 'list_projects',
        description:
          'List the calling user’s projects, newest first. Optionally filter by status.',
        inputSchema: z.object({
          status: z.enum(['active', 'archived']).optional(),
          limit: z.number().int().min(1).max(100).default(20),
        }),
        annotations: { readOnlyHint: true, title: 'List projects' },
        execute: async (input, ctx) => {
          const owner = ownerId(ctx);
          const items = [...projectStore.values()]
            .filter((p) => p.ownerId === owner)
            .filter((p) => (input.status ? p.status === input.status : true))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, input.limit);
          return { count: items.length, items };
        },
      }),

      defineMcpTool({
        name: 'get_project',
        description: 'Fetch one of the calling user’s projects by id.',
        inputSchema: z.object({ id: z.string().describe('Project id.') }),
        annotations: { readOnlyHint: true, title: 'Get project' },
        execute: async (input, ctx) => ownedProject(input.id, ownerId(ctx)),
      }),

      defineMcpTool({
        name: 'update_project',
        description:
          'Update fields on one of the calling user’s projects. Only provided fields change.',
        inputSchema: z.object({
          id: z.string().describe('Project id.'),
          name: z.string().min(1).max(120).optional(),
          description: z.string().max(2000).optional(),
          status: z.enum(['active', 'archived']).optional(),
        }),
        annotations: { idempotentHint: true, title: 'Update project' },
        execute: async (input, ctx) => {
          const project = ownedProject(input.id, ownerId(ctx));
          if (input.name !== undefined) project.name = input.name;
          if (input.description !== undefined) project.description = input.description;
          if (input.status !== undefined) project.status = input.status;
          project.updatedAt = new Date().toISOString();
          projectStore.set(project.id, project);
          return project;
        },
      }),

      defineMcpTool({
        name: 'delete_project',
        description: 'Delete one of the calling user’s projects by id.',
        inputSchema: z.object({ id: z.string().describe('Project id.') }),
        annotations: { destructiveHint: true, idempotentHint: true, title: 'Delete project' },
        execute: async (input, ctx) => {
          const owner = ownerId(ctx);
          ownedProject(input.id, owner); // 404 if missing / not owned
          projectStore.delete(input.id);
          return { deleted: true, id: input.id };
        },
      }),
    ],
  },
  discovery: {
    security: {
      contact: `mailto:${process.env.SECURITY_CONTACT_EMAIL ?? 'security@example.com'}`,
      expires: '2027-07-10T00:00:00.000Z',
    },
    sitemap: {
      urls: ['/'],
    },
    llmsTxt: [
      '# Agent-Ready SaaS',
      '',
      '> Next.js starter on @buildbase/sdk with a live MCP server and agent discovery.',
      '',
      '## App',
      '',
      '- [MCP server](/mcp): Live MCP endpoint (OAuth via /.well-known/oauth-protected-resource/mcp).',
      '',
    ].join('\n'),
  },
});
