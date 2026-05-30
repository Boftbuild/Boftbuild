const APPS_SCRIPT_URL = 'https://script.google.com/a/macros/boftbuild.com/s/AKfycbwSdp9oLK0aUb41qbxEia8m5ThAy8fdbsCt20E0KdsEBUXt3Dm4vppcE5MM3WoSv3dP/exec';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.boftbuild.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token || '';

  try {
    let response;

    if (req.method === 'GET') {
      const params = new URLSearchParams({ ...req.query });
      params.delete('token');

      const url = APPS_SCRIPT_URL + '?' + params.toString();
      response = await fetch(url, {
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        redirect: 'follow'
      });

    } else if (req.method === 'POST') {
      response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(req.body),
        redirect: 'follow'
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
