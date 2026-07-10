# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
