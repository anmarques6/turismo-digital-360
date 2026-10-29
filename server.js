// Angola 365º — servidor local (para desenvolvimento ou alojamento próprio).
// Na Vercel não é usado: lá a API corre em api/index.js e o site é servido a partir de public/.
//   DATABASE_URL=postgres://... npm start   → http://localhost:3000  e  /admin/
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

// Carrega variáveis de um ficheiro .env, se existir (ex.: DATABASE_URL copiado da Vercel)
for (const f of ['.env.local', '.env']) try { for (const l of fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}

const { tratarAPI } = require('./src/app');
const { servirEstatico } = require('./src/http');
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);

// Os mesmos cabeçalhos de segurança que a Vercel aplica (vercel.json → headers)
const CABECALHOS = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8')).headers[0].headers.filter(h => !['Strict-Transport-Security'].includes(h.key)); } catch { return []; } })();

http.createServer(async (req, res) => {
  for (const h of CABECALHOS) res.setHeader(h.key, h.key === 'Content-Security-Policy' ? h.value.replace('; upgrade-insecure-requests', '') : h.value);
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return tratarAPI(req, res);
  req.pathname = url.pathname;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if ((req.method === 'GET' || req.method === 'HEAD') && servirEstatico(PUBLIC, req, res)) return;
  if (req.method === 'GET') { req.pathname = req.pathname.startsWith('/admin') ? '/admin/index.html' : '/index.html'; if (servirEstatico(PUBLIC, req, res)) return; }
  res.writeHead(404); res.end('Não encontrado');
}).listen(PORT, () => {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) console.warn('\n⚠  Falta a variável DATABASE_URL (ligação ao PostgreSQL / Neon). Crie um ficheiro .env — ver .env.example.');
  console.log(`\nAngola 365º a correr em http://localhost:${PORT}`);
  console.log(`Painel de administração:      http://localhost:${PORT}/admin/\n`);
});
