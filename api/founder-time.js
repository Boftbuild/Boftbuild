export const config = { runtime: 'edge' };

const APPS_SCRIPT_URL = process.env.FOUNDER_TIME_SCRIPT_URL || '';
const SHARED_SECRET = process.env.FOUNDER_TIME_SECRET || '';

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
