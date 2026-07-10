import { agent } from "@/lib/agent";

// Self-documenting landing page: the tool list is read from the live MCP
// handler at render time, so this page never drifts from what's exposed.
export default function Home() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const tools = agent.mcp.listTools();
  const reads = tools.filter((t) => t.annotations?.readOnlyHint);
  const writes = tools.filter((t) => !t.annotations?.readOnlyHint);

  const discovery = [
    ["/llms.txt", "App overview for LLMs"],
    ["/auth.md", "How agents authenticate (OAuth 2.0 + PKCE)"],
    ["/.well-known/mcp/server-card.json", "MCP server card"],
    ["/.well-known/oauth-protected-resource/mcp", "Protected-resource metadata (RFC 9728)"],
    ["/.well-known/agent-card.json", "A2A agent card"],
    ["/security.txt", "Security contact"],
  ] as const;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">Agent-Ready SaaS</h1>
        <p className="text-sm opacity-80 leading-relaxed">
          This app is built for AI agents. It exposes a live{" "}
          <a className="underline underline-offset-4" href="https://modelcontextprotocol.io">
            MCP
          </a>{" "}
          server backed by BuildBase. There is no sign-up form here — connect
          an agent below and you&apos;ll be asked to sign in and approve access
          during the connection flow.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Connect your agent</h2>
        <p className="text-sm opacity-80">Claude Code:</p>
        <pre className="rounded-lg bg-black/5 dark:bg-white/10 px-4 py-3 text-xs overflow-x-auto">
          {`claude mcp add --transport http agent-ready-saas ${site}/mcp`}
        </pre>
        <p className="text-sm opacity-80">
          Claude Desktop, Cursor, ChatGPT, or any MCP client: add a remote
          (streamable HTTP) server with the URL{" "}
          <code className="text-xs bg-black/5 dark:bg-white/10 rounded px-1.5 py-0.5">{site}/mcp</code>
          . No client ID or secret needed — your agent registers itself.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">How access works</h2>
        <ol className="text-sm opacity-80 leading-relaxed list-decimal pl-5 space-y-1">
          <li>Your agent discovers this server and self-registers an OAuth client (RFC 7591).</li>
          <li>A browser window opens: you sign in on BuildBase&apos;s hosted login.</li>
          <li>You review and approve what the agent may access on a consent screen.</li>
          <li>
            The agent receives a short-lived token scoped to <em>your</em> account —
            it can never see or do more than you can, and you can revoke it any time.
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          Available tools <span className="opacity-60 font-normal">({tools.length})</span>
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium mb-2">Read ({reads.length})</h3>
            <ul className="text-xs opacity-80 space-y-1">
              {reads.map((t) => (
                <li key={t.name}>
                  <code>{t.name}</code>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Write ({writes.length})</h3>
            <ul className="text-xs opacity-80 space-y-1">
              {writes.map((t) => (
                <li key={t.name}>
                  <code>{t.name}</code>
                  {t.annotations?.destructiveHint ? (
                    <span className="ml-1.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 px-1 py-0.5 text-[10px]">
                      destructive
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Machine-readable docs</h2>
        <ul className="text-sm space-y-1">
          {discovery.map(([href, label]) => (
            <li key={href}>
              <a className="underline underline-offset-4" href={href}>
                <code className="text-xs">{href}</code>
              </a>{" "}
              <span className="opacity-60 text-xs">— {label}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-xs opacity-60 leading-relaxed border-t border-black/10 dark:border-white/10 pt-6">
        Built with{" "}
        <a className="underline" href="https://www.npmjs.com/package/@buildbase/sdk">
          @buildbase/sdk
        </a>
        . Agent access is user-scoped and consent-gated: every tool call runs
        under the session of the user who approved it.
      </footer>
    </main>
  );
}
