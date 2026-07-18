// Vercel Serverless Function - NLP Assessment Data Collector
// Uses environment variables for sensitive credentials (set in Vercel dashboard)

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const BASE_TOKEN = process.env.FEISHU_BASE_TOKEN;
const TABLE_ID = process.env.FEISHU_TABLE_ID;
const FEISHU_API = 'https://open.feishu.cn/open-apis';

const FIELD_MAP = {
  nickname: '\u6635\u79f0',
  environment: '\u73af\u5883\u5c42\u5f97\u5206',
  behavior: '\u884c\u4e3a\u5c42\u5f97\u5206',
  capability: '\u80fd\u529b\u5c42\u5f97\u5206',
  belief: '\u4fe1\u5ff5\u5c42\u5f97\u5206',
  identity: '\u8eab\u4efd\u5c42\u5f97\u5206',
  vision: '\u613f\u666f\u5c42\u5f97\u5206',
  blockerLayer: '\u5361\u70b9\u5c42',
  lever: '\u64ac\u52a8\u70b9',
  obstacleType: '\u963b\u788d\u7c7b\u578b',
  slogan: '\u884c\u52a8\u53e3\u53f7'
};

let tokenCache = { token: null, expiresAt: 0 };

async function getTenantToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }
  const resp = await fetch(`${FEISHU_API}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET })
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`Token error: ${data.msg}`);
  tokenCache.token = data.tenant_access_token;
  tokenCache.expiresAt = Date.now() + data.expire * 1000;
  return tokenCache.token;
}

async function writeToBitable(body) {
  const token = await getTenantToken();
  const fields = {};
  for (const [key, fieldName] of Object.entries(FIELD_MAP)) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      fields[fieldName] = body[key];
    }
  }
  fields['\u6d4b\u8bd5\u65f6\u95f4'] = Date.now();
  const resp = await fetch(
    `${FEISHU_API}/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ fields })
    }
  );
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`Bitable write error: ${data.msg}`);
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await writeToBitable(req.body);
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
