import { agent } from '@/lib/agent';

// An optional catch-all, so this one route answers both /mcp (the MCP
// endpoint) and /mcp/server-card (the SEP-2127 server card that the AI
// Catalog, the API catalog and the Link header point at).
export const { GET, POST, DELETE, OPTIONS } = agent.routes;
