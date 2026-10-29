// Entrada com contas externas (OAuth 2.0 / OpenID Connect): Google, Facebook e Microsoft.
// (A Apple foi retirada: exige uma conta Apple Developer paga.)
// Cada fornecedor só fica activo quando as suas variáveis de ambiente estão definidas na Vercel.
// Fluxo: /api/auth/oauth/:p  →  fornecedor  →  /api/auth/oauth/:p/retorno  →  /#entrar=<token>
const crypto = require('node:crypto');

const env = k => (process.env[k] || '').trim();
const b64u = b => Buffer.from(b).toString('base64url');

async function pedirJSON(url, op = {}) {
  const r = await fetch(url, op);
  const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = { erro_bruto: txt.slice(0, 300) }; }
  if (!r.ok) { const e = new Error(`${new URL(url).hostname} respondeu ${r.status}: ${j.error_description || j.error?.message || j.error || j.erro_bruto || ''}`); e.fornecedor = true; throw e; }
  return j;
}
const form = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== ''));

const FORNECEDORES = {
  google: {
    nome: 'Google', vars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    url: (ru, st) => 'https://accounts.google.com/o/oauth2/v2/auth?' + form({ client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: ru, response_type: 'code', scope: 'openid email profile', state: st, prompt: 'select_account' }),
    async perfil(code, ru) {
      const t = await pedirJSON('https://oauth2.googleapis.com/token', { method: 'POST', body: form({ code, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), redirect_uri: ru, grant_type: 'authorization_code' }) });
      const u = await pedirJSON('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + t.access_token } });
      return { sub: u.sub, email: u.email, verificado: u.email_verified === true, nome: u.name };
    },
  },
  facebook: {
    nome: 'Facebook', vars: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
    url: (ru, st) => 'https://www.facebook.com/v21.0/dialog/oauth?' + form({ client_id: env('FACEBOOK_APP_ID'), redirect_uri: ru, response_type: 'code', scope: 'email,public_profile', state: st }),
    async perfil(code, ru) {
      const t = await pedirJSON('https://graph.facebook.com/v21.0/oauth/access_token?' + form({ client_id: env('FACEBOOK_APP_ID'), client_secret: env('FACEBOOK_APP_SECRET'), redirect_uri: ru, code }));
      const prova = crypto.createHmac('sha256', env('FACEBOOK_APP_SECRET')).update(t.access_token).digest('hex');
      const u = await pedirJSON('https://graph.facebook.com/v21.0/me?' + form({ fields: 'id,name,email', access_token: t.access_token, appsecret_proof: prova }));
      return { sub: u.id, email: u.email, verificado: !!u.email, nome: u.name };
    },
  },
  microsoft: {
    nome: 'Microsoft', vars: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
    url: (ru, st) => 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + form({ client_id: env('MICROSOFT_CLIENT_ID'), redirect_uri: ru, response_type: 'code', scope: 'openid email profile User.Read', state: st, prompt: 'select_account' }),
    async perfil(code, ru) {
      const t = await pedirJSON('https://login.microsoftonline.com/common/oauth2/v2.0/token', { method: 'POST', body: form({ code, client_id: env('MICROSOFT_CLIENT_ID'), client_secret: env('MICROSOFT_CLIENT_SECRET'), redirect_uri: ru, grant_type: 'authorization_code', scope: 'openid email profile User.Read' }) });
      const u = await pedirJSON('https://graph.microsoft.com/oidc/userinfo', { headers: { Authorization: 'Bearer ' + t.access_token } });
      // A Microsoft não garante que o e-mail foi verificado: nunca liga a uma conta já existente por e-mail.
      return { sub: u.sub, email: u.email, verificado: false, nome: u.name || [u.given_name, u.family_name].filter(Boolean).join(' ') };
    },
  },
};

const ativo = p => FORNECEDORES[p] && FORNECEDORES[p].vars.every(v => env(v));
const ativos = () => Object.keys(FORNECEDORES).filter(ativo);

// Endereço público do site (para o redirect_uri registado em cada fornecedor)
function origem(req) {
  if (env('PUBLIC_URL')) return env('PUBLIC_URL').replace(/\/$/, '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
  const proto = String(req.headers['x-forwarded-proto'] || (/^(localhost|127\.)/.test(host) ? 'http' : 'https')).split(',')[0].trim();
  return `${proto}://${host}`;
}
const redirectURI = (req, p) => `${origem(req)}/api/auth/oauth/${p}/retorno`;

// "state" assinado (HMAC) + cookie com o mesmo nonce: impede que alguém inicie sessão na conta de outra pessoa
const segredo = () => env('AUTH_SECRET') || crypto.createHash('sha256').update('td360:' + (env('DATABASE_URL') || env('POSTGRES_URL') || 'local')).digest('hex');
const assinar = s => crypto.createHmac('sha256', segredo()).update(s).digest('base64url');
function criarState(p, lang) {
  const nonce = crypto.randomBytes(16).toString('base64url');
  const dados = b64u(JSON.stringify({ p, n: nonce, t: Date.now(), l: lang }));
  return { state: `${dados}.${assinar(dados)}`, nonce };
}
function lerState(state, p, nonceCookie) {
  const [dados, ass] = String(state || '').split('.');
  if (!dados || !ass || ass.length !== assinar(dados).length || !crypto.timingSafeEqual(Buffer.from(ass), Buffer.from(assinar(dados)))) return null;
  const o = JSON.parse(Buffer.from(dados, 'base64url').toString('utf8'));
  if (o.p !== p || Date.now() - o.t > 15 * 60e3 || !nonceCookie || o.n !== nonceCookie) return null;
  return o;
}
const cookie = (req, nome) => (String(req.headers.cookie || '').split(';').map(c => c.trim().split('=')).find(([k]) => k === nome) || [])[1];
function cookieNonce(req, valor, maxAge) {
  const seguro = origem(req).startsWith('https://');
  return `td360_oauth=${valor}; Path=/api/auth/oauth; HttpOnly; Max-Age=${maxAge}; SameSite=Lax${seguro ? '; Secure' : ''}`;
}

module.exports = { FORNECEDORES, ativo, ativos, origem, redirectURI, criarState, lerState, cookie, cookieNonce };
