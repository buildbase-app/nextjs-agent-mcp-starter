import { NextRequest, NextResponse } from 'next/server';
import { handleAppRevokeRequest } from '@buildbase/sdk';

// applicationRevokeUrl — the platform calls this (signed with the client
// secret) when a user's grant or token is revoked. Payload: { userId,
// clientId, reason }. Our agent tokens are short-lived stateless JWTs, so
// there is no store to purge; if you add a token denylist or session store,
// invalidate the user's entries in onRevoke.
export async function POST(request: NextRequest) {
  const { status, body } = await handleAppRevokeRequest({
    authorization: request.headers.get('authorization'),
    clientSecret: process.env.BUILDBASE_AGENT_CLIENT_SECRET!,
    onRevoke: async (claims) => {
      console.log('[agent] token revoked', {
        userId: claims.userId,
        reason: claims.reason,
      });
    },
  });
  return NextResponse.json(body, { status });
}
