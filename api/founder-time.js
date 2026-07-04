export const config = { runtime: 'edge' };

const APPS_SCRIPT_URL = process.env.FOUNDER_TIME_SCRIPT_URL || '';
const SHARED_SECRET = process.env.FOUNDER_TIME_SECRET || '';
const ALLOWED_EMAIL = (process.env.FOUNDER_TIME_ALLOWED_EMAIL || 'martinc@boftbuild.com').toLowerCase();

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (!APPS_SCRIPT_URL || !SHARED_SECRET) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Founder Time API is not configured. Add FOUNDER_TIME_SCRIPT_URL and FOUNDER_TIME_SECRET in Vercel.',
      }),
      { status: 503, headers }
    );
  }

  try {
    await assertAuthorizedUser(req);

    let response;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      url.searchParams.set('secret', SHARED_SECRET);
      response = await fetch(`${APPS_SCRIPT_URL}?${url.searchParams.toString()}`, {
        redirect: 'follow',
      });
    } else if (req.method === 'POST') {
      const body = await req.json();
      body.secret = SHARED_SECRET;
      response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'follow',
      });
    } else {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers,
      });
    }

    const data = await response.text();
    return new Response(data, { status: response.status, headers });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers,
    });
  }
}

async function assertAuthorizedUser(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) {
    throw new Error('Missing Google authorization token.');
  }

  const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!userResponse.ok) {
    throw new Error('Invalid Google authorization token.');
  }

  const user = await userResponse.json();
  const email = String(user.email || '').toLowerCase();

  if (email !== ALLOWED_EMAIL) {
    throw new Error('Unauthorized founder time user.');
  }
}
