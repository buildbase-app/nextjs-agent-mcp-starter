# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- `@buildbase/sdk` `^1.9.0` (from `^0.0.54`, which matched 0.0.54 alone). The
  MCP server now speaks protocol 2026-07-28 next to 2025-11-25 and negotiates
  older clients down, as the SDK does; the `app_health` tool reports the
  installed SDK version instead of a hard-coded `0.0.54`.
- Behaviour change: the protected-resource metadata now lists the write
  scopes the exposed built-in writes need (`workspaces:write`,
  `profile:write`, `usage:write`, `credits:write`, `billing:write`,
  `notifications:write`, `features:write`), derived from the new
  `BUILTIN_TOOLS` list in `src/lib/agent.ts`, so an agent asks for them and
  the user approves them on the consent screen. Since SDK 1.2.0 each built-in
  write needs its area's scope. An agent connected before this change holds a
  token without them: its writes keep working for 30 days from the first
  call the server sees, with a deprecation notice on each result, and are
  then refused until the agent reconnects. Reads and the project tools are
  unaffected.
- Behaviour change (from the SDK): `invite_workspace_user`,
  `update_workspace_user_role` and `send_notification` are now marked
  destructive, so clients ask before running them. The A2A card's interfaces
  use the A2A 1.0 shape, and `/auth.md` opens with `# Agent-Ready SaaS auth.md`.
- The README states 42 of the SDK's 82 built-in tools instead of "the
  complete catalog"; the ones left out are the person's own plan, add-ons,
  credit holds and commerce.

### Fixed

- The SEP-2127 server card at `/mcp/server-card`, which SDK 1.x advertises in
  the AI Catalog, the API catalog and the `Link` header, answered 404. The
  MCP route moved to `src/app/mcp/[[...card]]/route.ts` (an optional
  catch-all), so the one route serves `/mcp` and the card. The older card at
  `/.well-known/mcp/server-card.json` is still served.

## [0.1.0] - 2026-07-10

### Added

- Initial release: agent-first Next.js starter on `@buildbase/sdk` ≥ 0.0.54.
- Live MCP server at `/mcp` (streamable HTTP, MCP 2025-06-18) with the complete
  42-tool BuildBase catalog (explicit `include` list), `app_health`, and a
  5-tool project CRUD example backed by an in-memory store.
- Full agent-discovery surface: `llms.txt`, `auth.md`, `robots.txt`,
  `security.txt`, `sitemap.xml`, and all `.well-known/*` documents
  (MCP server card, discovery manifest, A2A agent card, RFC 9728
  protected-resource metadata, API catalog).
- OAuth app-bridge routes: token mint (`/api/agent/token`), revocation
  (`/api/agent/token/revoke`), profile (`/api/profile`).
- Self-documenting landing page rendering the live tool list.
- Production hardening: env fail-fast, per-user rate limiting (120/min),
  `ToolError`-based error redaction, request-size cap, CI (lint + build + typecheck).
