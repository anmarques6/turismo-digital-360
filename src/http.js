// Micro-framework HTTP sem dependências: rotas, JSON, ficheiros estáticos.
const fs = require('node:fs');
const path = require('node:path');

class ErroHttp extends Error {
  constructor(status, mensagem, extra) { super(mensagem); this.status = status; this.extra = extra; }
}
const erro = (status, msg, extra) => { throw new ErroHttp(status, msg, extra); };

function criarRouter() {
  const rotas = [];
  const add = (metodo, padrao, ...handlers) => {
    const nomes = [];
    const re = new RegExp('^' + padrao.replace(/\/:([a-z_]+)/gi, (_, n) => { nomes.push(n); return '/([^/]+)'; }) + '/?$');
    rotas.push({ metodo, re, nomes, handlers });
  };
  const r = {
    get: (p, ...h) => add('GET', p, ...h), post: (p, ...h) => add('POST', p, ...h),
    put: (p, ...h) => add('PUT', p, ...h), patch: (p, ...h) => add('PATCH', p, ...h),
    delete: (p, ...h) => add('DELETE', p, ...h),
    async handle(req, res) {
      for (const rt of rotas) {
        if (rt.metodo !== req.method) continue;
        const m = rt.re.exec(req.pathname); if (!m) continue;
        req.params = Object.fromEntries(rt.nomes.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
        let out;
        for (const h of rt.handlers) { out = await h(req, res); if (res.writableEnded) return true; }
        if (!res.writableEnded) enviarJSON(res, 200, out === undefined ? { ok: true } : out);
        return true;
      }
      return false;
    },
  };
  return r;
}

function enviarJSON(res, status, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(corpo) });
  res.end(corpo);
}

function lerCorpo(req, limite = 8 * 1024 * 1024) {
  // Na Vercel o corpo já vem lido em req.body (o próprio runtime limita a 4,5 MB)
  if (process.env.VERCEL && req.body !== undefined) {
    const b = req.body;
    if (b == null || b === '') return Promise.resolve({});
    if (Buffer.isBuffer(b) || typeof b === 'string') { try { return Promise.resolve(JSON.parse(String(b))); } catch { return Promise.reject(new ErroHttp(400, 'JSON inválido.')); } }
    return Promise.resolve(b);
  }
  return new Promise((resolve, reject) => {
    let tam = 0; const partes = [];
    req.on('data', c => { tam += c.length; if (tam > limite) { reject(new ErroHttp(413, 'Pedido demasiado grande.')); req.destroy(); } else partes.push(c); });
    req.on('end', () => {
      if (!partes.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(partes).toString('utf8'))); }
      catch { reject(new ErroHttp(400, 'JSON inválido.')); }
    });
    req.on('error', reject);
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };

function servirEstatico(raiz, req, res) {
  let rel = decodeURIComponent(req.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const ficheiro = path.normalize(path.join(raiz, rel));
  if (!ficheiro.startsWith(raiz)) return false;
  let st; try { st = fs.statSync(ficheiro); } catch { return false; }
  if (st.isDirectory()) { if (!req.pathname.endsWith('/')) { res.writeHead(301, { Location: req.pathname + '/' }); res.end(); return true; } return false; }
  const ext = path.extname(ficheiro).toLowerCase();
  const longa = ['.webp', '.png', '.jpg', '.jpeg', '.svg'].includes(ext);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': longa ? 'public, max-age=604800' : 'no-cache' });
  if (req.method === 'HEAD') return res.end(), true;
  fs.createReadStream(ficheiro).pipe(res);
  return true;
}

module.exports = { criarRouter, enviarJSON, lerCorpo, servirEstatico, ErroHttp, erro };
