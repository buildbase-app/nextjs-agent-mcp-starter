# BuildBase Agent MCP Starter (`nextjs-agent-mcp-starter`)

![Node.js](https://img.shields.io/badge/node-22+-brightgreen) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![MCP](https://img.shields.io/badge/MCP-2025--06--18-purple) ![License](https://img.shields.io/badge/license-MIT-green)

Next.js 16 (App Router) + [`@buildbase/sdk`](https://www.npmjs.com/package/@buildbase/sdk) ≥ 0.0.54 starter for an **agent-first app**: a live MCP server with BuildBase-powered agent OAuth and the full agent-discovery surface, all from one `createAgentStack()` config.

> **Important:** This starter requires a [BuildBase](https://buildbase.app) account with an OAuth2 agent client and Agent Readiness enabled. Without it, agents cannot authenticate.

**Agent auth only.** There is no app-side login UI — users authenticate on BuildBase's hosted login + consent screen during the agent's OAuth flow. (For human sign-in wiring, see the `nextjs-starter` reference app.)

Verified end-to-end with Claude Code as the MCP client: discovery → dynamic client registration → consent → token mint → 31 tools, including writes.

## Setup

1. Copy `.env.example` → `.env.local` and fill it in (see [Environment](#environment)).
2. In [console.buildbase.app](https://console.buildbase.app):
   - Create an **OAuth2 agent client** (Type `oauth2`, Client kind `Agent (third-party)`, PKCE on) with:
     - Application Token URL → `https://<your-public-origin>/api/agent/token`
     - Application Revoke URL → `https://<your-public-origin>/api/agent/token/revoke`
     - Application Profile URL → `https://<your-public-origin>/api/profile`
     - Redirect URLs: leave empty — agents register their own via DCR.
   - Admin → Auth → **Agent access**: enable **Agent readiness** and **Let agents register themselves**, picking the client above as the **base client**.
3. `npm install && npm run build && npm start`, then connect an agent:
   ```bash
   claude mcp add --transport http my-app https://<your-public-origin>/mcp
   ```

> **`localhost` will not work for the agent flow** — the BuildBase platform calls your token endpoints server-to-server and blocks loopback addresses. For local dev, tunnel (`ngrok http 3000`) and use the tunnel origin in the console URLs and `NEXT_PUBLIC_SITE_URL`.

## Environment

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_BUILDBASE_SERVER_URL` / `NEXT_PUBLIC_BUILDBASE_ORG_ID` | Your BuildBase org |
| `NEXT_PUBLIC_SITE_URL` | This app's public origin — appears in every discovery document and token audience |
| `BUILDBASE_AGENT_CLIENT_SECRET` | Secret of the **agent base** client — the platform signs `applicationTokenUrl`/`RevokeUrl` calls with it |
| `SYSTEM_SECRET` | App-owned token signing + session encryption (`openssl rand -hex 32`). Never leaves the app. |
| `SECURITY_CONTACT_EMAIL` | Shown in `/security.txt` |

`NEXT_PUBLIC_*` values are inlined at **build time** — rebuild after changing them.

## What's wired

| File | Purpose |
|---|---|
| `src/lib/agent.ts` | `createAgentStack()` — one config for MCP + discovery + custom tools |
| `src/lib/buildbase.ts` | Minimal `BuildBase()` factory (`withSession` for per-request sessions) |
| `src/app/mcp/route.ts` | Live MCP server (streamable HTTP, MCP 2025-06-18). Served at `/mcp` so the endpoint equals the canonical RFC 9728 resource — MCP clients reject a mismatch, so don't move it to `/api/mcp`. |
| `src/app/.well-known/[...path]/route.ts` | All `.well-known/*` discovery docs |
| `src/app/{llms.txt,auth.md,robots.txt,security.txt,sitemap.xml}/route.ts` | Root discovery docs |
| `src/app/api/agent/token/route.ts` | Platform-called token mint (`handleAppTokenRequest` + `mintAgentToken`) |
| `src/app/api/agent/token/revoke/route.ts` | Platform-called revocation webhook |
| `src/app/api/profile/route.ts` | Verifies a minted agent token, returns the user profile |

## Tools exposed (48)

- **42 BuildBase built-in tools** — the complete catalog, listed explicitly in `builtinTools.include` (grouped by category in `src/lib/agent.ts`): every read (workspaces, users, subscription, plans, invoices, quota, usage logs, credits, feature flags, permissions, settings) **and every write**, including destructive operations (`delete_workspace`, `cancel_subscription`, `remove_workspace_user`, …). Narrowing the surface is just deleting lines.
- **`app_health`** — minimal custom-tool example.
- **5 project CRUD tools** (`create/list/get/update/delete_project`) — a complete custom-tool example with zod schemas, annotations, and per-user ownership scoping via `ctx.auth.userId`.

This starter deliberately exposes the full surface to demonstrate capability. **For production, narrow it**: `builtinTools: 'readonly'` (least privilege) or `{ include: [...] }` / `{ exclude: [...] }` with exactly the operations you want agents to perform. Whatever you expose, every call runs under the granting user's session — an agent can never exceed its user's permissions.

> ⚠️ The project tools use an **in-memory demo store**: it resets on every server restart and is not shared across serverless instances. Swap `projectStore` in `src/lib/agent.ts` for your real database; the tool logic stays the same.

Every tool runs under the granting user's BuildBase session — an agent can never exceed its user's permissions.

**After adding/changing tools:** rebuild + restart, then reconnect in the client (`/mcp` → Reconnect in Claude Code) — MCP clients cache `tools/list` per connection.

## Production hardening (already wired)

- **Env fail-fast** — missing required env fails the build with a clear message instead of a silently broken discovery surface.
- **Rate limiting** — 120 req/min per user (sliding window, in-memory; back with Redis/KV or an edge limiter when scaling out).
- **Error redaction** — tools throw `ToolError` for agent-facing messages; anything else returns a generic message in production while the full error goes to `onError` logging.
- **Request-size cap** — SDK default 1 MiB (413 above it).
- **CI** — lint + build + typecheck on every push/PR (`.github/workflows/ci.yml`).

## Before going live

- Deploy behind a real domain; update `NEXT_PUBLIC_SITE_URL` + the console client URLs (Token/Revoke/Profile).
- Replace the demo project store with a database.
- Prune the `builtinTools.include` list — start by removing the "Destructive" group.
- If browser-based MCP clients must be restricted, set `allowedOrigins` in `mcp.handler`.
- Point `onError` at your real telemetry instead of `console.error`.
