const apiUrl = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:8081';

async function check(path) {
  const response = await fetch(`${apiUrl}${path}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${path} retornou HTTP ${response.status}: ${text.slice(0, 160)}`);
  }

  return text;
}

async function main() {
  console.log(`Validando API Rastroom em ${apiUrl}`);
  await check('/health');
  console.log('✓ /health OK');
  await check('/health/ready');
  console.log('✓ /health/ready OK');
  await check('/docs');
  console.log('✓ /docs OK');
  console.log('Smoke check de staging concluído.');
}

main().catch((error) => {
  console.error('Smoke check falhou:');
  console.error(error.message);
  process.exit(1);
});
