const apiUrl = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:8081';
const email = process.env.DEMO_EMAIL || 'admin@rastroom.local';
const password = process.env.DEMO_PASSWORD || 'Rastroom@123';

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    throw new Error(`${path} retornou HTTP ${response.status}: ${typeof body === 'string' ? body.slice(0, 220) : JSON.stringify(body).slice(0, 220)}`);
  }
  return body;
}

function getAccessToken(loginBody) {
  return loginBody?.access_token || loginBody?.accessToken || loginBody?.token;
}

async function main() {
  console.log(`Homologando API Rastroom em ${apiUrl}`);
  await request('/health');
  console.log('✓ /health');
  await request('/health/ready');
  console.log('✓ /health/ready');

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  const token = getAccessToken(login);
  if (!token) throw new Error('Login não retornou access_token.');
  console.log(`✓ login demo (${email})`);

  const auth = { Authorization: `Bearer ${token}` };
  const me = await request('/auth/me', { headers: auth });
  if (!me?.email) throw new Error('/auth/me não retornou usuário válido.');
  console.log(`✓ /auth/me (${me.email})`);

  const checks = [
    ['/dashboard/management', 'dashboard gerencial'],
    ['/parts/production-board', 'quadro de produção'],
    ['/parts?limit=200', 'listagem de peças'],
    ['/orders?limit=200', 'listagem de pedidos'],
    ['/platform/documents', 'central de documentos'],
    ['/platform/access-policy', 'política de acesso']
  ];

  for (const [path, label] of checks) {
    await request(path, { headers: auth });
    console.log(`✓ ${label} (${path})`);
  }

  console.log('Homologação técnica concluída com sucesso.');
}

main().catch((error) => {
  console.error('Homologação falhou:');
  console.error(error.message);
  process.exit(1);
});
