const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwt2QTMPuSym_Lh57Mi1IDQBTY3AgVU1Vl2CgIiSlGw2PUVgTyokWs_HBA1iOPFy7oD/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers.authorization?.replace('Bearer ', '') || '';

  try {
    let response;

    if (req.method === 'GET') {
      const params = new URLSearchParams({ ...req.query, token });
      const url = APPS_SCRIPT_URL + '?' + params.toString();
      response = await fetch(url, { redirect: 'follow' });

    } else if (req.method === 'POST') {
      const body = { ...req.body, token };
      response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
