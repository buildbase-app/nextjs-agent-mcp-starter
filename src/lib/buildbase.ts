import BuildBase from '@buildbase/sdk';

// Agent-only app: no cookie session. Per-request sessions come from the
// verified agent token (see /api/profile) via withSession(sessionId).
export const { withSession, client } = BuildBase({
  serverUrl: process.env.NEXT_PUBLIC_BUILDBASE_SERVER_URL!,
  orgId: process.env.NEXT_PUBLIC_BUILDBASE_ORG_ID!,
});
