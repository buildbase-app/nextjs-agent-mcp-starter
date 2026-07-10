# Contributing Guide

Thanks for your interest in contributing!

## Development setup

1. Fork and clone the repo, then `npm install` (Node 22 — see `.nvmrc`).
2. Copy `.env.example` → `.env.local` and fill in your BuildBase org credentials (see the README's Setup section — you'll need an OAuth2 agent client and Agent Readiness enabled in [console.buildbase.app](https://console.buildbase.app)).
3. `npm run dev` for local work. For the full agent OAuth flow you need a public origin (`ngrok http 3000`) — see the README's localhost caveat.

## Before opening a PR

- `npm run lint` and `npx tsc --noEmit` pass.
- `npm run build` succeeds.
- If you changed the tool surface (`src/lib/agent.ts`), verify the landing page tool list still renders correctly and update the README's tool counts.
- If you changed the MCP endpoint or discovery config, re-run the verification sweep from the README (server card, protected-resource metadata, 401 challenge).

## Guidelines

- Keep this starter **minimal** — every file should serve the MCP/agent-readiness example. Feature ideas that don't serve that goal belong in your own fork.
- The demo project store is deliberately in-memory; PRs adding a database dependency will not be accepted.
- Follow the existing code style (2-space indent, TypeScript strict).

## Reporting issues

Use the issue templates. For security vulnerabilities, **do not open a public issue** — see [SECURITY.md](./SECURITY.md).
