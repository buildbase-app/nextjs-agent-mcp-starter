import { NextRequest, NextResponse } from 'next/server';
import { handleAppTokenRequest, mintAgentToken } from '@buildbase/sdk';

// applicationTokenUrl — the BuildBase platform calls this (authenticated with
// the client secret) after a user grants an agent access. We mint OUR token:
// HS256 with SYSTEM_SECRET, aud bound to the granted resource (RFC 8707),
// per-user BuildBase session embedded as an encrypted `sid` claim.
// buildbaseAuth() inside the MCP handler verifies + decrypts it on every call.
export async function POST(request: NextRequest) {
  const { status, body } = await handleAppTokenRequest({
    authorization: request.headers.get('authorization'),
    // Secret of the OAuth2 BASE client ("MCP") — self-registered agent
    // clients inherit its signing, so all mint requests verify against it.
    clientSecret: process.env.BUILDBASE_AGENT_CLIENT_SECRET!,
    mintToken: (claims) =>
      mintAgentToken({ claims, secret: process.env.SYSTEM_SECRET! }),
  });
  return NextResponse.json(body, { status });
}
