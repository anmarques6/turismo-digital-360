// Manipulador HTTP da API — usado pelo servidor local (server.js) e pela função da Vercel (api/index.js)
const { api } = require('./api');
const { enviarJSON, ErroHttp } = require('./http');
const { garantirBD } = require('./db');

async function tratarAPI(req, res) {
  const url = new URL(req.url, 'http://localhost');
  req.pathname = url.pathname; req.query = url.searchParams;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  try {
    await garantirBD(); // cria tabelas e dados iniciais na primeira utilização
    if (!(await api.handle(req, res))) enviarJSON(res, 404, { erro: 'Rota não encontrada.' });
  } catch (e) {
    if (res.headersSent) { try { res.end(); } catch {} return; }
    if (e instanceof ErroHttp) return enviarJSON(res, e.status, { erro: e.message, ...(e.extra || {}) });
    if (e.status === 503) return enviarJSON(res, 503, { erro: e.message });
    if (e.code === '23505') return enviarJSON(res, 409, { erro: 'Este registo já existe.' });
    if (e.code && /^23/.test(e.code)) return enviarJSON(res, 400, { erro: 'Os dados não respeitam as regras da base de dados.', detalhe: e.message });
    console.error(e);
    enviarJSON(res, 500, { erro: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|password authentication/i.test(e.message) ? 'Não foi possível ligar à base de dados. Verifique a variável DATABASE_URL.' : 'Erro interno do servidor.' });
  }
}
module.exports = { tratarAPI };
