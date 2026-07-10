import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken } from '@buildbase/sdk';
import { buildbaseAuth } from '@buildbase/sdk/mcp';
import { withSession } from '@/lib/buildbase';

// applicationProfileUrl — accepts one of our minted agent tokens and returns
// the user's profile. (The OAuth2 agent flow never calls this; it exists so
// the URL registered in the console resolves to something real.)
const agentAuth = buildbaseAuth({ secret: process.env.SYSTEM_SECRET! });

export async function GET(request: NextRequest) {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 });
  }

  const auth = await agentAuth.verify(token, {
    method: 'GET',
    headers: Object.fromEntries(request.headers),
  });
  if (!auth) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const profile = await withSession(auth.sessionId).users.getProfile();
  return NextResponse.json({ userId: auth.userId, profile });
}

export const POST = GET;
