export const config = { runtime: 'edge' };

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz_Hoq7HfBNLwW9rw07bWqn8roUAPPhavxokjQ_j_YrlPvoedzlTZufYsJ2tHv-kX9R/exec';

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

  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const url = new URL(req.url);
  const params = url.searchParams;

  try {
    let response;

    if (req.method === 'GET') {
      params.append('token', token);
      const targetUrl = APPS_SCRIPT_URL + '?' + params.toString();
      response = await fetch(targetUrl, { redirect: 'follow' });

    } else if (req.method === 'POST') {
      const body = await req.json();
      body.token = token;
      response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'follow'
      });
    }

    const data = await response.text();
    return new Response(data, { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
