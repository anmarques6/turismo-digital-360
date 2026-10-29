// API REST do Angola 365º (PostgreSQL)
const crypto = require('node:crypto');
const { get, all, run, tx, hashSenha, verificaSenha, parseJSON } = require('./db');
const { RECURSOS, TABELA_DO_TIPO, LINGUAS_TRAD } = require('./recursos');
const { criarRouter, lerCorpo, erro } = require('./http');
const IMAGENS_BASE = require('./imagens.json');
const OA = require('./oauth');

const api = criarRouter();
const UTC_OFFSET_H = Number(process.env.UTC_OFFSET_H ?? 1); // Angola: UTC+1

// ---------- utilitários ----------
const agoraSQL = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const hoje = () => new Date(Date.now() + UTC_OFFSET_H * 36e5).toISOString().slice(0, 10);
const kz = v => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Kz';
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const str = (v, max = 2000) => (v == null ? '' : String(v)).trim().slice(0, max);
const dataValida = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !isNaN(new Date(d + 'T12:00:00Z'));
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
const somaDias = (d, n) => new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const camposJSON = tabela => Object.entries(RECURSOS[tabela].campos).filter(([, c]) => c.t === 'list' || c.t === 'images').map(([k]) => k);
const camposObj = tabela => Object.entries(RECURSOS[tabela].campos).filter(([, c]) => c.t === 'i18n').map(([k]) => k);
const CATEGORIA_TX = { experiencia: 'Experiências', alojamento: 'Alojamentos', evento: 'Eventos', restaurante: 'Gastronomia', viatura: 'Transportes', tradutor: 'Tradutores' };
const METODOS = ['Carteira 360', 'Unitel Money', 'Multicaixa Express', 'Cartão •••• 4587'];
const novoCodigo = () => 'TD-' + Array.from(crypto.randomBytes(6), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

function serializar(tabela, linha) {
  if (!linha) return linha;
  const o = { ...linha };
  for (const k of camposJSON(tabela)) o[k] = parseJSON(o[k], []);
  for (const k of camposObj(tabela)) o[k] = parseJSON(o[k], {}) || {};
  return o;
}
// Sobrepõe os campos traduzidos (se existirem) à versão portuguesa
function traduzir(o, lang) {
  if (!o || !lang || lang === 'pt') return o;
  const t = o.i18n?.[lang]; if (!t) return o;
  const out = { ...o };
  for (const [k, v] of Object.entries(t)) if (Array.isArray(v) ? v.length : String(v ?? '').trim()) out[k] = v;
  return out;
}
const publicoUser = u => u && ({ id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, papel: u.papel, saldo: u.saldo, pontos: u.pontos, criado_em: u.criado_em, idioma: u.idioma, senha_definida: u.senha_definida });
const utilizador = (id, d = { get }) => d.get('SELECT * FROM utilizadores WHERE id = ?', id);
const notificar = (d, uid, titulo, corpo, icone = 'bell', destino = null) =>
  d.run('INSERT INTO notificacoes (utilizador_id, titulo, corpo, icone, destino) VALUES (?,?,?,?,?)', uid, titulo, corpo, icone, destino);
const DB = { get, all, run };

// ---------- autenticação ----------
// Sessões: terminam após INATIVIDADE_S segundos sem pedidos (por omissão 60 s) e, no máximo, ao fim de SESSAO_HORAS.
const INATIVIDADE_S = Math.max(10, Number(process.env.SESSAO_INATIVIDADE_S || 60));
const SESSAO_HORAS = 12;
const MAX_FALHAS = 5, BLOQUEIO_MIN = 15;
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const sqlParaMs = s => Date.parse(String(s).replace(' ', 'T') + 'Z');
const msParaSQL = ms => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
async function criarSessao(uid, agente) {
  const token = crypto.randomBytes(32).toString('base64url');
  await run('DELETE FROM sessoes WHERE utilizador_id = ? AND (expira_em <= ? OR ultimo_uso <= ?)', uid, agoraSQL(), msParaSQL(Date.now() - (INATIVIDADE_S + 30) * 1000));
  await run('INSERT INTO sessoes (token_hash, utilizador_id, expira_em, agente, ultimo_uso) VALUES (?,?,?,?,?)', sha(token), uid, msParaSQL(Date.now() + SESSAO_HORAS * 36e5), str(agente, 200), agoraSQL());
  await run('UPDATE utilizadores SET ultimo_acesso = ?, falhas_entrada = 0, bloqueado_ate = NULL WHERE id = ?', agoraSQL(), uid);
  return token;
}
async function auth(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (token && token.length < 200) {
    req.tokenHash = sha(token);
    const r = await get(`SELECT u.*, s.ultimo_uso AS _uso FROM sessoes s JOIN utilizadores u ON u.id = s.utilizador_id WHERE s.token_hash = ? AND s.expira_em > ? AND u.ativo = 1`, req.tokenHash, agoraSQL());
    if (r) {
      // margem de 30 s para o sinal de actividade enviado pelo site (que termina a sessão aos INATIVIDADE_S)
      if (Date.now() - sqlParaMs(r._uso) > (INATIVIDADE_S + 30) * 1000) {
        await run('DELETE FROM sessoes WHERE token_hash = ?', req.tokenHash);
        erro(401, 'A sessão terminou por inactividade. Entre novamente.', { inatividade: true });
      }
      await run('UPDATE sessoes SET ultimo_uso = ? WHERE token_hash = ?', agoraSQL(), req.tokenHash);
      delete r._uso; req.user = r;
    }
  }
  if (!req.user) erro(401, 'Sessão expirada. Entre novamente.');
}
// Regras da senha: pelo menos 8 caracteres, com letras e números
const senhaFraca = s => String(s).length < 8 || !/[A-Za-zÀ-ÿ]/.test(s) || !/\d/.test(s);
const admin = async req => { await auth(req); if (req.user.papel !== 'admin') erro(403, 'Acesso reservado a administradores.'); };
const corpo = async req => { req.dados = await lerCorpo(req); };

// Limite simples de tentativas de entrada por IP (10 em 10 minutos, por instância)
const tentativas = new Map();
function limitarTentativas(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim(); const agora = Date.now();
  const l = (tentativas.get(ip) || []).filter(t => agora - t < 10 * 6e4);
  if (l.length >= Number(process.env.LIMITE_TENTATIVAS || 10)) erro(429, 'Demasiadas tentativas. Aguarde alguns minutos.');
  l.push(agora); tentativas.set(ip, l);
}

api.get('/api/saude', async () => ({ ok: true, hora: new Date().toISOString(), bd: (await get('SELECT version() AS v')).v.split(' on ')[0] }));

api.post('/api/auth/registar', corpo, async req => {
  limitarTentativas(req);
  const b = req.dados;
  const nome = str(b.nome, 120), email = str(b.email, 160).toLowerCase(), senha = String(b.senha || ''), telefone = str(b.telefone, 30) || null;
  if (nome.length < 2) erro(400, 'Indique o seu nome.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erro(400, 'Indique um e-mail válido.');
  if (senhaFraca(senha)) erro(400, 'A senha precisa de pelo menos 8 caracteres, com letras e números.');
  if (await get('SELECT 1 AS x FROM utilizadores WHERE email = ?', email)) erro(409, 'Já existe uma conta com este e-mail.');
  const uid = await tx(d => novaConta(d, { nome, email, telefone, hash: hashSenha(senha), idioma: lingua(b.idioma) }));
  return { token: await criarSessao(uid, req.headers['user-agent']), utilizador: publicoUser(await utilizador(uid)) };
});
const LINGUAS = ['pt', 'en', 'fr', 'es'];
const lingua = l => LINGUAS.includes(String(l || '').slice(0, 2)) ? String(l).slice(0, 2) : 'pt';
async function novaConta(d, { nome, email, telefone = null, hash, idioma = 'pt', semSenha = 0 }) {
  const id = (await d.run('INSERT INTO utilizadores (nome, email, telefone, senha_hash, idioma, senha_definida) VALUES (?,?,?,?,?,?) RETURNING id', nome, email, telefone, hash, idioma, semSenha ? 0 : 1)).id;
  await notificar(d, id, 'Bem-vindo(a) ao Angola 365º', 'Eu sou a ENDA. Toque no meu ícone para pedir sugestões, roteiros ou convites.', 'star');
  await notificar(d, id, 'ENDA sugere', 'O Luanda Jazz Festival está a chegar. Quer convidar alguém?', 'music', 'eventos');
  return id;
}

api.post('/api/auth/entrar', corpo, async req => {
  limitarTentativas(req);
  const email = str(req.dados.email, 160).toLowerCase(), senha = String(req.dados.senha || '');
  if (!email || !senha) erro(400, 'Indique o e-mail e a senha.');
  const u = await get('SELECT * FROM utilizadores WHERE email = ? OR telefone = ?', email, email);
  // Bloqueio temporário da conta após várias senhas erradas seguidas
  if (u?.bloqueado_ate && sqlParaMs(u.bloqueado_ate) > Date.now()) erro(429, `Conta bloqueada temporariamente por tentativas falhadas. Tente daqui a ${Math.ceil((sqlParaMs(u.bloqueado_ate) - Date.now()) / 6e4)} min.`);
  if (!u || !verificaSenha(senha, u.senha_hash)) {
    if (u) {
      const f = (u.falhas_entrada || 0) + 1;
      if (f >= MAX_FALHAS) await run('UPDATE utilizadores SET falhas_entrada = 0, bloqueado_ate = ? WHERE id = ?', msParaSQL(Date.now() + BLOQUEIO_MIN * 6e4), u.id);
      else await run('UPDATE utilizadores SET falhas_entrada = ? WHERE id = ?', f, u.id);
    }
    erro(401, 'E-mail ou senha incorrectos.');
  }
  if (!u.ativo) erro(403, 'Esta conta está suspensa. Contacte o suporte.');
  return { token: await criarSessao(u.id, req.headers['user-agent']), utilizador: publicoUser(u) };
});

// Mantém a sessão viva enquanto o utilizador está activo no ecrã (o site chama isto a cada ~25 s de actividade)
api.post('/api/auth/ativo', async req => { await auth(req); return { ok: true, inatividade_s: INATIVIDADE_S }; });
api.post('/api/auth/sair', async req => { await auth(req); await run('DELETE FROM sessoes WHERE token_hash = ?', req.tokenHash); });
api.get('/api/auth/eu', async req => { await auth(req); return { utilizador: publicoUser(req.user) }; });
api.patch('/api/auth/eu', corpo, async req => {
  await auth(req); const b = req.dados, u = req.user;
  const nome = b.nome !== undefined ? str(b.nome, 120) : u.nome;
  const tel = b.telefone !== undefined ? (str(b.telefone, 30) || null) : u.telefone;
  if (nome.length < 2) erro(400, 'Indique o seu nome.');
  let hash = u.senha_hash, definida = u.senha_definida;
  const idioma = b.idioma !== undefined ? lingua(b.idioma) : u.idioma;
  if (b.senha_nova) {
    // Contas criadas com Google/Facebook/Microsoft podem definir a primeira senha sem a actual
    if (u.senha_definida !== 0 && !verificaSenha(String(b.senha_atual || ''), u.senha_hash)) erro(400, 'A senha actual está incorrecta.');
    if (senhaFraca(b.senha_nova)) erro(400, 'A nova senha precisa de pelo menos 8 caracteres, com letras e números.');
    hash = hashSenha(String(b.senha_nova)); definida = 1;
    await run('DELETE FROM sessoes WHERE utilizador_id = ? AND token_hash <> ?', u.id, req.tokenHash);
  }
  await run('UPDATE utilizadores SET nome = ?, telefone = ?, senha_hash = ?, senha_definida = ?, idioma = ? WHERE id = ?', nome, tel, hash, definida, idioma, u.id);
  return { utilizador: publicoUser(await utilizador(u.id)) };
});

// ---------- entrada com Google, Facebook e Microsoft ----------
api.get('/api/auth/provedores', async () => ({ ativos: OA.ativos(), inatividade_s: INATIVIDADE_S }));
api.get('/api/auth/oauth/:p', async (req, res) => {
  const p = req.params.p;
  if (!OA.FORNECEDORES[p]) erro(404, 'Fornecedor desconhecido.');
  if (!OA.ativo(p)) return redirecionar(res, '/#erro-entrada=' + encodeURIComponent(`A entrada com ${OA.FORNECEDORES[p].nome} ainda não foi activada.`));
  const { state, nonce } = OA.criarState(p, lingua(req.query.get('lang')));
  res.setHeader('Set-Cookie', OA.cookieNonce(req, nonce, 900));
  redirecionar(res, OA.FORNECEDORES[p].url(OA.redirectURI(req, p), state));
});
const retornoOAuth = async (req, res) => {
  const p = req.params.p, F = OA.FORNECEDORES[p];
  if (!F || !OA.ativo(p)) erro(404, 'Fornecedor desconhecido.');
  const q = Object.fromEntries(req.query);
  const falhar = m => { res.setHeader('Set-Cookie', OA.cookieNonce(req, '', 0)); redirecionar(res, '/#erro-entrada=' + encodeURIComponent(m)); };
  if (q.error) return falhar(q.error === 'access_denied' ? 'Entrada cancelada.' : `O ${F.nome} recusou a entrada (${q.error}).`);
  const st = OA.lerState(q.state, p, OA.cookie(req, 'td360_oauth'));
  if (!st || !q.code) return falhar('O pedido de entrada expirou. Tente de novo.');
  let perfil;
  try { perfil = await F.perfil(String(q.code), OA.redirectURI(req, p), q); }
  catch (e) { console.error('OAuth', p, e.message); return falhar(`Não foi possível confirmar a conta ${F.nome}. Tente de novo.`); }
  const email = str(perfil.email, 160).toLowerCase();
  if (!perfil.sub) return falhar(`O ${F.nome} não devolveu a identificação da conta.`);
  const uid = await tx(async d => {
    const ligada = await d.get('SELECT utilizador_id FROM contas_externas WHERE provedor = ? AND sub = ?', p, String(perfil.sub));
    if (ligada) return ligada.utilizador_id;
    if (!email) erro(400, `A sua conta ${F.nome} não partilhou o e-mail. Autorize o e-mail ou crie conta com e-mail e senha.`);
    const existente = await d.get('SELECT id FROM utilizadores WHERE email = ?', email);
    let id;
    if (existente) {
      if (!perfil.verificado) erro(409, `Já existe uma conta com ${email}. Entre com a senha e depois poderá usar o ${F.nome}.`);
      id = existente.id;
    } else {
      const nome = str(perfil.nome, 120) || email.split('@')[0];
      id = await novaConta(d, { nome, email, hash: hashSenha(crypto.randomBytes(24).toString('hex')), idioma: st.l, semSenha: 1 });
    }
    await d.run('INSERT INTO contas_externas (provedor, sub, utilizador_id, email) VALUES (?,?,?,?) ON CONFLICT (provedor, sub) DO NOTHING', p, String(perfil.sub), id, email || null);
    return id;
  }).catch(e => { if (e.status) { falhar(e.message); return null; } throw e; });
  if (!uid) return;
  const u = await utilizador(uid);
  if (!u.ativo) return falhar('Esta conta está suspensa. Contacte o suporte.');
  // O token não vai no endereço: vai um código de uso único, válido 60 s, trocado pelo site via POST
  const codigo = crypto.randomBytes(32).toString('base64url');
  await run('DELETE FROM codigos_entrada WHERE expira_em <= ?', agoraSQL());
  await run('INSERT INTO codigos_entrada (codigo_hash, utilizador_id, expira_em) VALUES (?,?,?)', sha(codigo), uid, msParaSQL(Date.now() + 60e3));
  res.setHeader('Set-Cookie', OA.cookieNonce(req, '', 0));
  redirecionar(res, '/#codigo=' + codigo);
};
api.post('/api/auth/oauth/trocar', corpo, async req => {
  limitarTentativas(req);
  const c = str(req.dados.codigo, 100);
  const r = c && await get('DELETE FROM codigos_entrada WHERE codigo_hash = ? RETURNING utilizador_id, expira_em', sha(c));
  if (!r || sqlParaMs(r.expira_em) < Date.now()) erro(401, 'O pedido de entrada expirou. Tente de novo.');
  const u = await utilizador(r.utilizador_id);
  if (!u?.ativo) erro(403, 'Esta conta está suspensa. Contacte o suporte.');
  return { token: await criarSessao(u.id, req.headers['user-agent']), utilizador: publicoUser(u) };
});
api.get('/api/auth/oauth/:p/retorno', retornoOAuth);
function redirecionar(res, url) { res.writeHead(302, { Location: url, 'Cache-Control': 'no-store' }); res.end(); }

// ---------- catálogo público ----------
async function listarPublico(tabela, lang) {
  const r = RECURSOS[tabela];
  const temProv = 'provincia_id' in r.campos;
  let sql = temProv ? `SELECT t.*, p.nome AS provincia FROM ${tabela} t LEFT JOIN provincias p ON p.id = t.provincia_id WHERE t.ativo = 1` : `SELECT t.* FROM ${tabela} t WHERE t.ativo = 1`;
  const params = [];
  if (tabela === 'eventos') { sql += ` AND COALESCE(t.data_fim, t.data) >= ? AND t.estado <> 'passado' ORDER BY t.data, t.hora`; params.push(hoje()); }
  else sql += ' ORDER BY t.id';
  return (await all(sql, ...params)).map(l => { const o = traduzir(serializar(tabela, l), lang); delete o.i18n; return o; });
}
const linguaPedido = req => lingua(req.query.get('lang'));
const TABELAS_PUBLICAS = Object.keys(RECURSOS).filter(t => !RECURSOS[t].semPublico);

api.get('/api/catalogo', async req => {
  const lang = linguaPedido(req);
  const listas = await Promise.all(TABELAS_PUBLICAS.map(t => listarPublico(t, lang)));
  const out = { hoje: hoje() };
  TABELAS_PUBLICAS.forEach((t, i) => { out[t] = listas[i]; });
  out.provincias = await all('SELECT * FROM provincias ORDER BY nome');
  out.pratos_restaurantes = await all('SELECT prato_id, restaurante_id, fonte, verificado_em FROM pratos_restaurantes');
  return out;
});
for (const t of TABELAS_PUBLICAS) {
  api.get(`/api/${t}`, async req => {
    let l = await listarPublico(t, linguaPedido(req)); const q = norm(req.query.get('q')), cat = req.query.get('categoria');
    if (cat) l = l.filter(i => i.categoria === cat || i.tipo === cat);
    if (q) l = l.filter(i => norm(Object.values(i).join(' ')).includes(q));
    return l;
  });
  api.get(`/api/${t}/:id`, async req => {
    const i = (await listarPublico(t, linguaPedido(req))).find(x => x.id === Number(req.params.id));
    if (!i) erro(404, 'Não encontrado.');
    return { ...i, avaliacoes: await all('SELECT autor_nome, autor_cidade, nota, comentario, criado_em FROM avaliacoes WHERE tipo = ? AND item_id = ? AND aprovada = 1 ORDER BY criado_em DESC LIMIT 20', RECURSOS[t].tipo, i.id) };
  });
}

api.get('/api/pesquisa', async req => {
  const q = norm(req.query.get('q')); if (!q) return [];
  const out = [];
  const listas = await Promise.all(TABELAS_PUBLICAS.map(t => listarPublico(t, linguaPedido(req))));
  TABELAS_PUBLICAS.forEach((t, k) => { for (const i of listas[k]) {
    const nome = i[RECURSOS[t].campoNome];
    const txt = norm([nome, i.provincia, i.local, i.categoria, i.tipo, i.descricao, i.especialidade, i.palavras_chave, Array.isArray(i.idiomas) ? i.idiomas.join(' ') : i.idiomas].join(' '));
    if (txt.includes(q)) out.push({ tipo: RECURSOS[t].tipo, tabela: t, id: i.id, nome, imagem: i.imagem, subtitulo: RECURSOS[t].singular + (i.provincia ? ' · ' + i.provincia : i.local ? ' · ' + i.local : ''), preco: i.preco ?? i.preco_noite ?? i.preco_medio ?? i.preco_dia ?? i.preco_hora ?? null, data: i.data || null });
  } });
  return out;
});

// Imagens carregadas no painel (guardadas na base de dados)
api.get('/api/imagens/:id', async (req, res) => {
  const im = await get('SELECT mime, dados FROM imagens WHERE id = ?', Number(req.params.id));
  if (!im) erro(404, 'Imagem não encontrada.');
  res.writeHead(200, { 'Content-Type': im.mime, 'Content-Length': im.dados.length, 'Cache-Control': 'public, max-age=31536000, immutable' });
  res.end(im.dados);
});

api.get('/api/avaliacoes/:tipo/:id', req => all('SELECT autor_nome, autor_cidade, nota, comentario, criado_em FROM avaliacoes WHERE tipo = ? AND item_id = ? AND aprovada = 1 ORDER BY criado_em DESC LIMIT 30', req.params.tipo, Number(req.params.id)));
api.post('/api/avaliacoes', corpo, async req => {
  await auth(req); const b = req.dados;
  const tipo = str(b.tipo, 30), id = Number(b.item_id), nota = Number(b.nota), com = str(b.comentario, 800);
  const tabela = TABELA_DO_TIPO[tipo]; if (!tabela || RECURSOS[tabela].semPublico) erro(400, 'Tipo inválido.');
  if (!(await get(`SELECT 1 AS x FROM ${tabela} WHERE id = ?`, id))) erro(404, 'Item não encontrado.');
  if (!(nota >= 1 && nota <= 5) || !Number.isInteger(nota)) erro(400, 'Escolha uma nota de 1 a 5.');
  if (await get('SELECT 1 AS x FROM avaliacoes WHERE utilizador_id = ? AND tipo = ? AND item_id = ?', req.user.id, tipo, id)) erro(409, 'Já avaliou este item. Obrigado!');
  const partes = req.user.nome.trim().split(/\s+/);
  const autor = partes.length > 1 ? `${partes[0]} ${partes.at(-1)[0]}.` : partes[0];
  await run('INSERT INTO avaliacoes (utilizador_id, autor_nome, autor_cidade, tipo, item_id, nota, comentario) VALUES (?,?,?,?,?,?,?)', req.user.id, autor, str(b.cidade, 60) || null, tipo, id, nota, com || null);
});

// ---------- favoritos ----------
api.get('/api/favoritos', async req => { await auth(req); return all('SELECT tipo, item_id, criado_em FROM favoritos WHERE utilizador_id = ? ORDER BY criado_em DESC', req.user.id); });
api.post('/api/favoritos', corpo, async req => {
  await auth(req);
  const tipo = str(req.dados.tipo, 30), id = Number(req.dados.item_id), tabela = TABELA_DO_TIPO[tipo];
  if (!tabela || RECURSOS[tabela].semPublico || !(await get(`SELECT 1 AS x FROM ${tabela} WHERE id = ?`, id))) erro(404, 'Item não encontrado.');
  await run('INSERT INTO favoritos (utilizador_id, tipo, item_id) VALUES (?,?,?) ON CONFLICT DO NOTHING', req.user.id, tipo, id);
});
api.delete('/api/favoritos/:tipo/:id', async req => { await auth(req); await run('DELETE FROM favoritos WHERE utilizador_id = ? AND tipo = ? AND item_id = ?', req.user.id, req.params.tipo, Number(req.params.id)); });

// ---------- reservas ----------
// Calcula preço e dados da reserva do lado do servidor (o cliente nunca define o preço)
async function cotar(b, d = DB) {
  const tipo = str(b.tipo, 30), id = Number(b.item_id), tabela = TABELA_DO_TIPO[tipo];
  if (!CATEGORIA_TX[tipo]) erro(400, 'Este item não pode ser reservado.');
  const it = await d.get(`SELECT * FROM ${tabela} WHERE id = ? AND ativo = 1${d === DB ? '' : ' FOR UPDATE'}`, id);
  if (!it) erro(404, 'Este item já não está disponível.');
  if (it.parceiro === 0) erro(409, 'Este estabelecimento ainda não aceita reservas online. Use «Pedir reserva» e a nossa equipa trata do contacto.');
  let q = Math.floor(Number(b.quantidade) || 1);
  if (q < 1 || q > 60) erro(400, 'Quantidade inválida.');
  const H = hoje();
  let data = str(b.data, 10), fim = null, unidade, pu, nome = it.nome || it.titulo, local = it.local || null, notas = null;
  const exigeData = () => { if (!dataValida(data)) erro(400, 'Escolha uma data válida.'); if (data < H) erro(400, 'A data não pode ser no passado.'); };
  switch (tipo) {
    case 'experiencia':
      exigeData(); unidade = 'pessoa'; pu = it.preco;
      if (q > it.grupo_max) erro(400, `Esta experiência aceita no máximo ${it.grupo_max} pessoas por reserva.`);
      break;
    case 'alojamento':
      exigeData(); unidade = 'noite'; pu = Math.round(it.preco_noite * (100 - it.oferta_pct) / 100); fim = somaDias(data, q);
      if (q > 30) erro(400, 'Máximo de 30 noites por reserva.');
      break;
    case 'evento': {
      data = it.data; unidade = 'bilhete'; pu = it.preco;
      if (['rumor', 'notícia', 'por confirmar'].includes(it.confianca)) erro(409, 'Este evento ainda não está confirmado pela organização, por isso não se vendem bilhetes aqui.');
      if (it.bilhetes_url) erro(409, 'Os bilhetes deste evento vendem-se no canal oficial indicado no cartão.');
      if (['cancelado', 'passado'].includes(it.estado)) erro(409, it.estado === 'cancelado' ? 'Este evento foi cancelado.' : 'Este evento já aconteceu.');
      if (it.data < H) erro(400, 'Este evento já aconteceu.');
      const livres = it.lotacao - it.bilhetes_vendidos;
      if (q > livres) erro(409, livres > 0 ? `Só restam ${livres} lugares.` : 'Evento esgotado.');
      if (q > 10) erro(400, 'Máximo de 10 bilhetes por compra.');
      notas = it.hora; break;
    }
    case 'restaurante':
      exigeData(); unidade = 'pessoa'; pu = it.preco_medio; notas = str(b.hora, 5) || null;
      if (q > 20) erro(400, 'Para grupos com mais de 20 pessoas contacte o restaurante.');
      break;
    case 'viatura': {
      exigeData(); fim = str(b.data_fim, 10);
      if (!dataValida(fim) || fim <= data) erro(400, 'A data de devolução tem de ser depois do levantamento.');
      q = diasEntre(data, fim); if (q > 60) erro(400, 'Máximo de 60 dias de aluguer.');
      unidade = 'dia'; pu = it.preco_promo || it.preco_dia; local = str(b.local, 60) || 'Luanda'; nome = `${it.nome} · ${local}`;
      const ocup = (await d.get(`SELECT COUNT(*) AS n FROM reservas WHERE tipo = 'viatura' AND item_id = ? AND estado IN ('pendente','confirmada') AND data_inicio < ? AND data_fim > ?`, id, fim, data)).n;
      if (ocup >= it.unidades) erro(409, 'Não há unidades deste modelo livres nessas datas. Experimente outras datas ou outro modelo.');
      break;
    }
    case 'tradutor':
      exigeData(); unidade = 'hora'; pu = it.preco_hora; nome = 'Tradutor ' + it.nome;
      if (q > 12) erro(400, 'Máximo de 12 horas por reserva.');
      break;
  }
  return { tipo, item_id: id, nome, imagem: it.imagem, unidade, preco_unitario: pu, quantidade: q, total: pu * q, data_inicio: data, data_fim: fim, local, notas };
}

api.post('/api/reservas/cotacao', corpo, req => cotar(req.dados));

api.post('/api/reservas', corpo, async req => {
  await auth(req);
  const reserva = await tx(async d => {
    const c = await cotar(req.dados, d); // bloqueia o item (FOR UPDATE) até ao fim da transacção
    const gratis = c.total === 0;
    const metodo = gratis ? 'Gratuito' : str(req.dados.metodo, 40);
    if (!gratis && !METODOS.includes(metodo)) erro(400, 'Escolha uma forma de pagamento.');
    const pendente = metodo === 'Multicaixa Express';
    const pontos = pendente ? 0 : Math.floor(c.total / 100);
    const codigo = novoCodigo();
    if (metodo === 'Carteira 360') {
      const ok = await d.get('UPDATE utilizadores SET saldo = saldo - ? WHERE id = ? AND saldo >= ? RETURNING saldo', c.total, req.user.id, c.total);
      if (!ok) { const s = (await utilizador(req.user.id, d)).saldo; erro(402, `Saldo insuficiente: faltam ${kz(c.total - s)}. Carregue a carteira ou escolha outro método.`, { falta: c.total - s }); }
    }
    if (pontos) await d.run('UPDATE utilizadores SET pontos = pontos + ? WHERE id = ?', pontos, req.user.id);
    if (c.tipo === 'evento') await d.run('UPDATE eventos SET bilhetes_vendidos = bilhetes_vendidos + ? WHERE id = ?', c.quantidade, c.item_id);
    const rid = (await d.run(`INSERT INTO reservas (codigo, utilizador_id, tipo, item_id, item_nome, imagem, data_inicio, data_fim, local, quantidade, unidade, preco_unitario, total, metodo_pagamento, estado, pontos_ganhos, notas) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
      codigo, req.user.id, c.tipo, c.item_id, c.nome, c.imagem, c.data_inicio, c.data_fim, c.local, c.quantidade, c.unidade, c.preco_unitario, c.total, metodo, pendente ? 'pendente' : 'confirmada', pontos, c.notas)).id;
    if (!gratis) await d.run(`INSERT INTO transacoes (utilizador_id, reserva_id, tipo, categoria, descricao, imagem, valor, metodo, estado) VALUES (?,?, 'pagamento',?,?,?,?,?,?)`,
      req.user.id, rid, CATEGORIA_TX[c.tipo], c.nome + (c.quantidade > 1 ? ` (×${c.quantidade})` : ''), c.imagem, c.total, metodo, pendente ? 'pendente' : 'pago');
    await notificar(d, req.user.id, gratis ? 'Inscrição confirmada' : pendente ? 'Reserva a aguardar pagamento' : 'Reserva confirmada',
      `${c.nome}${c.quantidade > 1 ? ` (×${c.quantidade})` : ''} · ${gratis ? 'entrada gratuita' : kz(c.total) + ' · ' + metodo}${pendente ? ` · Referência ${codigo.slice(3)}` : ''} · Código ${codigo}`, pendente ? 'clock' : 'check', 'reservas');
    return d.get('SELECT * FROM reservas WHERE id = ?', rid);
  });
  return { reserva, utilizador: publicoUser(await utilizador(req.user.id)) };
});

api.get('/api/reservas', async req => { await auth(req); return all('SELECT * FROM reservas WHERE utilizador_id = ? ORDER BY criado_em DESC, id DESC', req.user.id); });

async function cancelarReserva(id, filtroUid, motivo, porAdmin) {
  return tx(async d => {
    const r = await d.get(`SELECT * FROM reservas WHERE id = ?${filtroUid ? ' AND utilizador_id = ?' : ''} FOR UPDATE`, ...(filtroUid ? [id, filtroUid] : [id]));
    if (!r) erro(404, 'Reserva não encontrada.');
    if (!['pendente', 'confirmada'].includes(r.estado)) erro(400, 'Esta reserva já não pode ser cancelada.');
    if (!porAdmin && r.data_inicio && r.data_inicio <= hoje()) erro(400, 'Só é possível cancelar antes da data da reserva.');
    const t = await d.get(`SELECT * FROM transacoes WHERE reserva_id = ? AND tipo = 'pagamento'`, r.id);
    let reembolso = 0;
    if (t && t.estado === 'pago') {
      reembolso = t.valor;
      await d.run('UPDATE utilizadores SET saldo = saldo + ? WHERE id = ?', reembolso, r.utilizador_id);
      await d.run(`INSERT INTO transacoes (utilizador_id, reserva_id, tipo, categoria, descricao, imagem, valor, metodo, estado) VALUES (?,?, 'reembolso',?,?,?,?, 'Carteira 360', 'concluido')`, r.utilizador_id, r.id, t.categoria, 'Reembolso · ' + r.item_nome, r.imagem, reembolso);
      await d.run(`UPDATE transacoes SET estado = 'reembolsado' WHERE id = ?`, t.id);
    } else if (t) await d.run(`UPDATE transacoes SET estado = 'falhado' WHERE id = ?`, t.id);
    await d.run('UPDATE utilizadores SET pontos = GREATEST(0, pontos - ?) WHERE id = ?', r.pontos_ganhos, r.utilizador_id);
    if (r.tipo === 'evento') await d.run('UPDATE eventos SET bilhetes_vendidos = GREATEST(0, bilhetes_vendidos - ?) WHERE id = ?', r.quantidade, r.item_id);
    await d.run(`UPDATE reservas SET estado = 'cancelada', atualizado_em = ?, notas = COALESCE(notas || ' · ', '') || ? WHERE id = ?`, agoraSQL(), motivo, r.id);
    await notificar(d, r.utilizador_id, 'Reserva cancelada', `${r.item_nome} · ${reembolso ? kz(reembolso) + ' devolvidos à Carteira 360' : 'sem valores a devolver'}`, 'x', 'reservas');
    return reembolso;
  });
}
api.post('/api/reservas/:id/cancelar', async req => {
  await auth(req);
  const reembolso = await cancelarReserva(Number(req.params.id), req.user.id, 'Cancelada pelo cliente', false);
  return { reembolso, utilizador: publicoUser(await utilizador(req.user.id)) };
});

// ---------- carteira ----------
api.get('/api/carteira', async req => {
  await auth(req);
  return { saldo: req.user.saldo, pontos: req.user.pontos, transacoes: await all('SELECT * FROM transacoes WHERE utilizador_id = ? ORDER BY criado_em DESC, id DESC LIMIT 200', req.user.id) };
});
api.post('/api/carteira/carregar', corpo, async req => {
  await auth(req);
  const v = Math.floor(Number(req.dados.valor)), metodo = str(req.dados.metodo, 40);
  if (!(v >= 1000 && v <= 2000000)) erro(400, 'O carregamento deve ser entre 1.000 Kz e 2.000.000 Kz.');
  if (!['Unitel Money', 'Multicaixa Express', 'Transferência bancária', 'Cartão •••• 4587'].includes(metodo)) erro(400, 'Método de carregamento inválido.');
  // Ponto de integração com o gateway de pagamento real (EMIS / Multicaixa Express, Unitel Money, banco).
  await tx(async d => {
    await d.run('UPDATE utilizadores SET saldo = saldo + ? WHERE id = ?', v, req.user.id);
    await d.run(`INSERT INTO transacoes (utilizador_id, tipo, categoria, descricao, imagem, valor, metodo, estado) VALUES (?, 'carregamento', 'Carregamento', 'Carregamento da carteira', '/img/hero.jpg', ?, ?, 'concluido')`, req.user.id, v, metodo);
  });
  return { utilizador: publicoUser(await utilizador(req.user.id)) };
});

// ---------- notificações e lembretes ----------
// Na Vercel não há processos permanentes: os lembretes vencidos são entregues sempre que o
// utilizador abre a app (e pela tarefa agendada /api/cron/lembretes, se configurada).
async function processarLembretes(uid) {
  const devidos = uid
    ? await all('SELECT * FROM lembretes WHERE enviado = 0 AND quando <= ? AND utilizador_id = ?', new Date().toISOString(), uid)
    : await all('SELECT * FROM lembretes WHERE enviado = 0 AND quando <= ? LIMIT 500', new Date().toISOString());
  for (const l of devidos) await tx(async d => {
    const ok = await d.run('UPDATE lembretes SET enviado = 1 WHERE id = ? AND enviado = 0', l.id);
    if (ok.changes) await notificar(d, l.utilizador_id, 'Lembrete da ENDA', `«${l.item_nome}» é já amanhã! Toque para ver os detalhes.`, 'cal', l.tipo === 'evento' ? 'eventos' : 'reservas');
  });
  return devidos.length;
}
if (!process.env.VERCEL) setInterval(() => processarLembretes().catch(e => console.error('Lembretes:', e.message)), 60000).unref();
api.get('/api/cron/lembretes', async req => {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) erro(401, 'Não autorizado.');
  return { entregues: await processarLembretes() };
});

api.get('/api/notificacoes', async req => {
  await auth(req); await processarLembretes(req.user.id);
  return { nao_lidas: (await get('SELECT COUNT(*) AS n FROM notificacoes WHERE utilizador_id = ? AND lida = 0', req.user.id)).n, lista: await all('SELECT * FROM notificacoes WHERE utilizador_id = ? ORDER BY criado_em DESC, id DESC LIMIT 40', req.user.id) };
});
api.post('/api/notificacoes', corpo, async req => {
  await auth(req);
  const t = str(req.dados.titulo, 120), c = str(req.dados.corpo, 500);
  if (!t || !c) erro(400, 'Notificação incompleta.');
  await notificar(DB, req.user.id, t, c, str(req.dados.icone, 20) || 'bell', str(req.dados.destino, 30) || null);
});
api.post('/api/notificacoes/lidas', async req => { await auth(req); await run('UPDATE notificacoes SET lida = 1 WHERE utilizador_id = ?', req.user.id); });

api.get('/api/lembretes', async req => { await auth(req); return all('SELECT * FROM lembretes WHERE utilizador_id = ? ORDER BY quando', req.user.id); });
api.post('/api/lembretes', corpo, async req => {
  await auth(req);
  const tipo = str(req.dados.tipo, 30), id = Number(req.dados.item_id), tabela = TABELA_DO_TIPO[tipo];
  if (!tabela || RECURSOS[tabela].semPublico) erro(400, 'Tipo inválido.');
  const it = await get(`SELECT * FROM ${tabela} WHERE id = ?`, id); if (!it) erro(404, 'Item não encontrado.');
  const nome = it.nome || it.titulo;
  let quando;
  if (tipo === 'evento') quando = new Date(new Date(`${it.data}T${it.hora || '10:00'}:00Z`).getTime() - UTC_OFFSET_H * 36e5 - 864e5);
  else quando = new Date(Date.now() + 864e5);
  if (quando < new Date()) quando = new Date(Date.now() + 60e3);
  const existente = await get('SELECT id FROM lembretes WHERE utilizador_id = ? AND tipo = ? AND item_id = ? AND enviado = 0', req.user.id, tipo, id);
  if (!existente) await run('INSERT INTO lembretes (utilizador_id, tipo, item_id, item_nome, quando) VALUES (?,?,?,?,?)', req.user.id, tipo, id, nome, quando.toISOString());
  const local = new Date(quando.getTime() + UTC_OFFSET_H * 36e5).toISOString();
  const quandoTxt = `${local.slice(8, 10)}/${local.slice(5, 7)}/${local.slice(0, 4)} às ${local.slice(11, 16)}`;
  await notificar(DB, req.user.id, 'Lembrete criado', `Vou avisá-lo de «${nome}» em ${quandoTxt}.`, 'cal');
  return { quando: quando.toISOString(), quando_txt: quandoTxt, nome, repetido: !!existente };
});
api.delete('/api/lembretes/:id', async req => { await auth(req); await run('DELETE FROM lembretes WHERE id = ? AND utilizador_id = ?', Number(req.params.id), req.user.id); });

api.post('/api/suporte', corpo, async req => {
  await auth(req);
  const a = str(req.dados.assunto, 140), m = str(req.dados.mensagem, 3000);
  if (!a || m.length < 5) erro(400, 'Escreva o assunto e a mensagem.');
  await run('INSERT INTO pedidos_suporte (utilizador_id, assunto, mensagem) VALUES (?,?,?)', req.user.id, a, m);
  await notificar(DB, req.user.id, 'Pedido de suporte recebido', `«${a}» — a nossa equipa responde em até 24 horas.`, 'headset');
});

// =====================================================================
//  ADMINISTRAÇÃO
// =====================================================================
api.get('/api/admin/esquema', async req => {
  await admin(req);
  const carregadas = (await all('SELECT id FROM imagens ORDER BY id DESC')).map(i => '/api/imagens/' + i.id);
  return { recursos: RECURSOS, metodos: METODOS, imagens: [...carregadas, ...IMAGENS_BASE] };
});

// Estado da entrada com redes sociais (para o painel mostrar o que falta configurar)
api.get('/api/admin/configuracao', async req => {
  await admin(req);
  const contas = await all('SELECT provedor, COUNT(*)::int AS n FROM contas_externas GROUP BY provedor');
  return { origem: OA.origem(req), oauth: Object.entries(OA.FORNECEDORES).map(([p, F]) => ({ id: p, nome: F.nome, ativo: OA.ativo(p), variaveis: F.vars.map(v => ({ nome: v, definida: !!(process.env[v] || '').trim() })), redirect: OA.redirectURI(req, p), contas: contas.find(c => c.provedor === p)?.n || 0 })) };
});

api.get('/api/admin/resumo', async req => {
  await admin(req);
  const desde = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const porDia = await all(`SELECT substr(criado_em,1,10) AS dia, COUNT(*) AS reservas, SUM(CASE WHEN estado IN ('confirmada','concluida') THEN total ELSE 0 END) AS receita FROM reservas WHERE substr(criado_em,1,10) >= ? GROUP BY dia ORDER BY dia`, desde);
  const mapa = Object.fromEntries(porDia.map(d => [d.dia, d]));
  const serie = Array.from({ length: 30 }, (_, i) => { const d = somaDias(desde, i); return { dia: d, reservas: mapa[d]?.reservas || 0, receita: mapa[d]?.receita || 0 }; });
  const n = async (sql, ...p) => (await get(sql, ...p)).n;
  const [clientes, novos, reservas, receita, pendentes, saldo, suporte, por_tipo, top_itens, eventos, ultimas] = await Promise.all([
    n(`SELECT COUNT(*) AS n FROM utilizadores WHERE papel = 'cliente'`),
    n(`SELECT COUNT(*) AS n FROM utilizadores WHERE papel = 'cliente' AND substr(criado_em,1,10) >= ?`, desde),
    n('SELECT COUNT(*) AS n FROM reservas'),
    n(`SELECT COALESCE(SUM(total),0) AS n FROM reservas WHERE estado IN ('confirmada','concluida')`),
    n(`SELECT COUNT(*) AS n FROM reservas WHERE estado = 'pendente'`),
    n(`SELECT COALESCE(SUM(saldo),0) AS n FROM utilizadores`),
    n(`SELECT COUNT(*) AS n FROM pedidos_suporte WHERE estado <> 'resolvido'`),
    all(`SELECT tipo, COUNT(*) AS reservas, SUM(total) AS receita FROM reservas WHERE estado IN ('confirmada','concluida') GROUP BY tipo ORDER BY receita DESC`),
    all(`SELECT tipo, item_id, MAX(item_nome) AS item_nome, MAX(imagem) AS imagem, COUNT(*) AS reservas, SUM(total) AS receita FROM reservas WHERE estado IN ('confirmada','concluida') GROUP BY tipo, item_id ORDER BY receita DESC LIMIT 6`),
    all(`SELECT id, titulo, data, lotacao, bilhetes_vendidos, imagem FROM eventos WHERE ativo = 1 AND data >= ? ORDER BY data LIMIT 6`, hoje()),
    all('SELECT * FROM v_reservas_detalhe ORDER BY criado_em DESC, id DESC LIMIT 8'),
  ]);
  return { clientes, novos_clientes_30d: novos, reservas, reservas_30d: serie.reduce((s, d) => s + d.reservas, 0), receita, receita_30d: serie.reduce((s, d) => s + d.receita, 0), pendentes, saldo_carteiras: saldo, suporte_abertos: suporte, serie, por_tipo, top_itens, eventos, ultimas };
});

// Validação genérica a partir da definição do recurso
async function validar(tabela, b, criar) {
  const out = {};
  for (const [k, c] of Object.entries(RECURSOS[tabela].campos)) {
    if (c.ro && !criar) continue;
    let v = b[k];
    if (v === undefined) { if (criar) { if (c.req) erro(400, `Campo obrigatório: ${c.label}.`); if (c.def !== undefined) out[k] = c.def; } continue; }
    if (v === '' || v === null) { if (c.req) erro(400, `Campo obrigatório: ${c.label}.`); out[k] = c.t === 'bool' ? 0 : (c.t === 'list' || c.t === 'images') ? '[]' : null; continue; }
    switch (c.t) {
      case 'int': case 'num': {
        const n = c.t === 'int' ? Math.round(Number(v)) : Number(v);
        if (!Number.isFinite(n)) erro(400, `${c.label}: número inválido.`);
        if (c.min !== undefined && n < c.min) erro(400, `${c.label}: mínimo ${c.min}.`);
        if (c.max !== undefined && n > c.max) erro(400, `${c.label}: máximo ${c.max}.`);
        v = n; break;
      }
      case 'bool': v = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0; break;
      case 'select': if (!c.opts.includes(v)) erro(400, `${c.label}: opção inválida.`); break;
      case 'ref': v = Number(v); if (!(await get(`SELECT 1 AS x FROM ${c.ref} WHERE id = ?`, v))) erro(400, `${c.label}: valor inválido.`); break;
      case 'date': if (!dataValida(v)) erro(400, `${c.label}: data inválida.`); break;
      case 'time': if (!/^\d{2}:\d{2}$/.test(v)) erro(400, `${c.label}: hora inválida (HH:MM).`); break;
      case 'image': v = str(v, 300); if (!/^(\/img\/|\/api\/imagens\/|\/uploads\/|https:\/\/)/.test(v)) erro(400, `${c.label}: caminho de imagem inválido.`); break;
      case 'list': case 'images': {
        const arr = (Array.isArray(v) ? v : String(v).split('\n')).map(x => str(x, 300)).filter(Boolean);
        if (c.req && !arr.length) erro(400, `Campo obrigatório: ${c.label}.`);
        v = JSON.stringify(arr); break;
      }
      case 'i18n': {
        const o = typeof v === 'string' ? parseJSON(v, {}) : v; const lim = {};
        for (const l of LINGUAS_TRAD) {
          const src = o?.[l]; if (!src || typeof src !== 'object') continue; const dst = {};
          for (const f of c.campos) { const x = src[f]; if (Array.isArray(x)) { const a = x.map(y => str(y, 300)).filter(Boolean); if (a.length) dst[f] = a; } else if (x != null && str(x)) dst[f] = str(x, 5000); }
          if (Object.keys(dst).length) lim[l] = dst;
        }
        v = JSON.stringify(lim); break;
      }
      default: v = str(v, c.t === 'textarea' ? 5000 : 300); if (c.req && !v) erro(400, `Campo obrigatório: ${c.label}.`);
    }
    out[k] = v;
  }
  // As coordenadas têm de obedecer ao mapa oficial de municípios: município e província passam a ser os do mapa
  if ('latitude' in c0(tabela) && out.latitude != null && out.longitude != null) {
    const l = require('./geo').localizar(Number(out.latitude), Number(out.longitude));
    if (!l) erro(400, 'As coordenadas ficam fora do mapa oficial de municípios de Angola. Confirme a latitude e a longitude.');
    if (!out.municipio) out.municipio = l.municipio;
    if ('provincia_id' in c0(tabela)) { const p = await get('SELECT id FROM provincias WHERE nome = ?', l.provincia); if (p) out.provincia_id = p.id; }
  }
  return out;
}
const c0 = t => RECURSOS[t].campos;

const tabelaAdmin = req => { const t = req.params.tabela; if (!RECURSOS[t]) erro(404, 'Recurso desconhecido.'); return t; };
api.get('/api/admin/catalogo/:tabela', async req => {
  await admin(req); const t = tabelaAdmin(req);
  const temProv = 'provincia_id' in RECURSOS[t].campos;
  return (await all(temProv ? `SELECT t.*, p.nome AS provincia FROM ${t} t LEFT JOIN provincias p ON p.id = t.provincia_id ORDER BY t.id DESC` : `SELECT * FROM ${t} ORDER BY id DESC`)).map(l => serializar(t, l));
});
api.post('/api/admin/catalogo/:tabela', corpo, async req => {
  await admin(req); const t = tabelaAdmin(req); const d = await validar(t, req.dados, true);
  const ks = Object.keys(d);
  const novo = await get(`INSERT INTO ${t} (${ks.join(',')}) VALUES (${ks.map(() => '?').join(',')}) RETURNING *`, ...ks.map(k => d[k]));
  await auditar(req, 'criar', t, novo.id, novo[RECURSOS[t].campoNome]);
  return serializar(t, novo);
});
// Registo das operações administrativas
const auditar = (req, acao, tabela, id, detalhe) => run('INSERT INTO auditoria (utilizador_id, email, acao, tabela, registo_id, detalhe) VALUES (?,?,?,?,?,?)', req.user?.id ?? null, req.user?.email ?? null, acao, tabela, id ?? null, detalhe == null ? null : str(detalhe, 1000)).catch(() => {});
api.put('/api/admin/catalogo/:tabela/:id', corpo, async req => {
  await admin(req); const t = tabelaAdmin(req); const id = Number(req.params.id);
  if (!(await get(`SELECT 1 AS x FROM ${t} WHERE id = ?`, id))) erro(404, 'Registo não encontrado.');
  const d = await validar(t, req.dados, false); const ks = Object.keys(d);
  const antes = await get(`SELECT * FROM ${t} WHERE id = ?`, id);
  if (ks.length) await run(`UPDATE ${t} SET ${ks.map(k => k + ' = ?').join(', ')} WHERE id = ?`, ...ks.map(k => d[k]), id);
  // histórico dos campos alterados (para eventos, jogos e dados oficiais)
  const mudou = ks.filter(k => String(antes[k] ?? '') !== String(d[k] ?? ''));
  for (const k of mudou.filter(k => k !== 'i18n')) await run('INSERT INTO historico_alteracoes (tabela, registo_id, campo, antes, depois, origem) VALUES (?,?,?,?,?,?)', t, id, k, antes[k] == null ? null : str(antes[k], 2000), d[k] == null ? null : str(d[k], 2000), 'admin:' + req.user.email);
  if (mudou.length) await auditar(req, 'editar', t, id, mudou.join(', '));
  return serializar(t, await get(`SELECT * FROM ${t} WHERE id = ?`, id));
});
api.delete('/api/admin/catalogo/:tabela/:id', async req => {
  await admin(req); const t = tabelaAdmin(req); const id = Number(req.params.id); const tipo = RECURSOS[t].tipo;
  if (t !== 'provincias' && await get('SELECT 1 AS x FROM reservas WHERE tipo = ? AND item_id = ? LIMIT 1', tipo, id)) {
    await run(`UPDATE ${t} SET ativo = 0 WHERE id = ?`, id); await auditar(req, 'despublicar', t, id);
    return { arquivado: true, mensagem: 'Este registo tem reservas associadas, por isso foi despublicado em vez de apagado.' };
  }
  await tx(async d => {
    await d.run(`DELETE FROM ${t} WHERE id = ?`, id);
    await d.run('DELETE FROM favoritos WHERE tipo = ? AND item_id = ?', tipo, id);
    await d.run('DELETE FROM avaliacoes WHERE tipo = ? AND item_id = ?', tipo, id);
  });
  await auditar(req, 'apagar', t, id);
  return { apagado: true };
});

// Carregamento de imagens: guardadas na base de dados (a Vercel não tem disco persistente)
api.post('/api/admin/upload', async req => {
  await admin(req);
  const b = await lerCorpo(req, 6 * 1024 * 1024);
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/.exec(String(b.dados || ''));
  if (!m) erro(400, 'Envie uma imagem PNG, JPG ou WEBP.');
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 3 * 1024 * 1024) erro(413, 'A imagem não pode ter mais de 3 MB.');
  const id = (await run('INSERT INTO imagens (mime, dados) VALUES (?, ?) RETURNING id', m[1].replace('jpg', 'jpeg'), buf)).id;
  return { caminho: '/api/imagens/' + id };
});

api.get('/api/admin/reservas', async req => {
  await admin(req);
  const est = req.query.get('estado'), tipo = req.query.get('tipo'), q = norm(req.query.get('q'));
  let l = await all('SELECT * FROM v_reservas_detalhe ORDER BY criado_em DESC, id DESC LIMIT 1000');
  if (est) l = l.filter(r => r.estado === est);
  if (tipo) l = l.filter(r => r.tipo === tipo);
  if (q) l = l.filter(r => norm([r.codigo, r.item_nome, r.cliente_nome, r.cliente_email].join(' ')).includes(q));
  return l;
});
api.patch('/api/admin/reservas/:id', corpo, async req => {
  await admin(req);
  const id = Number(req.params.id);
  const r = await get('SELECT * FROM reservas WHERE id = ?', id); if (!r) erro(404, 'Reserva não encontrada.');
  const novo = str(req.dados.estado, 20);
  if (novo === 'cancelada') return { reembolso: await cancelarReserva(id, null, 'Cancelada pela administração', true) };
  if (novo === 'confirmada' && r.estado === 'pendente') {
    await tx(async d => {
      const ok = await d.run(`UPDATE reservas SET estado = 'confirmada', pontos_ganhos = ?, atualizado_em = ? WHERE id = ? AND estado = 'pendente'`, Math.floor(r.total / 100), agoraSQL(), id);
      if (!ok.changes) erro(409, 'A reserva mudou entretanto. Actualize a página.');
      await d.run(`UPDATE transacoes SET estado = 'pago' WHERE reserva_id = ? AND tipo = 'pagamento'`, id);
      await d.run('UPDATE utilizadores SET pontos = pontos + ? WHERE id = ?', Math.floor(r.total / 100), r.utilizador_id);
      await notificar(d, r.utilizador_id, 'Pagamento recebido', `${r.item_nome} · reserva ${r.codigo} confirmada.`, 'check', 'reservas');
    });
    return { ok: true };
  }
  if (novo === 'concluida' && r.estado === 'confirmada') { await run(`UPDATE reservas SET estado = 'concluida', atualizado_em = ? WHERE id = ?`, agoraSQL(), id); return { ok: true }; }
  erro(400, `Não é possível passar de «${r.estado}» para «${novo}».`);
});

api.get('/api/admin/utilizadores', async req => {
  await admin(req);
  return all(`SELECT u.id, u.nome, u.email, u.telefone, u.papel, u.saldo, u.pontos, u.ativo, u.criado_em, u.ultimo_acesso,
    (SELECT COUNT(*) FROM reservas r WHERE r.utilizador_id = u.id) AS reservas,
    (SELECT COALESCE(SUM(total),0) FROM reservas r WHERE r.utilizador_id = u.id AND r.estado IN ('confirmada','concluida')) AS gasto
    FROM utilizadores u ORDER BY u.criado_em DESC, u.id DESC`);
});
api.patch('/api/admin/utilizadores/:id', corpo, async req => {
  await admin(req); const id = Number(req.params.id);
  const u = await utilizador(id); if (!u) erro(404, 'Utilizador não encontrado.');
  const papel = req.dados.papel ?? u.papel, ativo = req.dados.ativo === undefined ? u.ativo : (req.dados.ativo ? 1 : 0);
  if (!['cliente', 'parceiro', 'admin'].includes(papel)) erro(400, 'Papel inválido.');
  if (id === req.user.id && (papel !== 'admin' || !ativo)) erro(400, 'Não pode retirar o seu próprio acesso de administrador.');
  await run('UPDATE utilizadores SET papel = ?, ativo = ? WHERE id = ?', papel, ativo, id);
  if (!ativo) await run('DELETE FROM sessoes WHERE utilizador_id = ?', id);
});
api.post('/api/admin/utilizadores/:id/ajuste', corpo, async req => {
  await admin(req); const id = Number(req.params.id);
  const v = Math.round(Number(req.dados.valor)), motivo = str(req.dados.motivo, 140);
  if (!(await utilizador(id))) erro(404, 'Utilizador não encontrado.');
  if (!v) erro(400, 'Indique o valor do ajuste.');
  if (!motivo) erro(400, 'Indique o motivo do ajuste.');
  const saldo = await tx(async d => {
    const r = await d.get('UPDATE utilizadores SET saldo = saldo + ? WHERE id = ? AND saldo + ? >= 0 RETURNING saldo', v, id, v);
    if (!r) erro(400, 'O saldo não pode ficar negativo.');
    await d.run(`INSERT INTO transacoes (utilizador_id, tipo, categoria, descricao, valor, metodo, estado) VALUES (?, 'ajuste', 'Ajuste', ?, ?, 'Administração', 'concluido')`, id, `${v > 0 ? 'Crédito' : 'Débito'}: ${motivo}`, Math.abs(v));
    await notificar(d, id, 'Saldo actualizado', `${v > 0 ? '+' : '−'}${kz(Math.abs(v))} · ${motivo}`, 'wallet', 'pagamentos');
    return r.saldo;
  });
  return { saldo };
});

api.get('/api/admin/avaliacoes', async req => { await admin(req); return all('SELECT * FROM avaliacoes ORDER BY criado_em DESC, id DESC LIMIT 500'); });
api.patch('/api/admin/avaliacoes/:id', corpo, async req => { await admin(req); await run('UPDATE avaliacoes SET aprovada = ? WHERE id = ?', req.dados.aprovada ? 1 : 0, Number(req.params.id)); });
api.delete('/api/admin/avaliacoes/:id', async req => { await admin(req); await run('DELETE FROM avaliacoes WHERE id = ?', Number(req.params.id)); });

api.get('/api/admin/suporte', async req => { await admin(req); return all('SELECT p.*, u.nome AS cliente_nome, u.email AS cliente_email FROM pedidos_suporte p LEFT JOIN utilizadores u ON u.id = p.utilizador_id ORDER BY p.criado_em DESC'); });
api.patch('/api/admin/suporte/:id', corpo, async req => {
  await admin(req); const e = str(req.dados.estado, 20); if (!['aberto', 'em curso', 'resolvido'].includes(e)) erro(400, 'Estado inválido.');
  const p = await get('SELECT * FROM pedidos_suporte WHERE id = ?', Number(req.params.id)); if (!p) erro(404, 'Pedido não encontrado.');
  await run('UPDATE pedidos_suporte SET estado = ? WHERE id = ?', e, p.id);
  if (e === 'resolvido' && p.utilizador_id) await notificar(DB, p.utilizador_id, 'Pedido de suporte resolvido', `«${p.assunto}» foi marcado como resolvido.`, 'headset');
});

// Exportação CSV (abre no Excel)
const EXPORTAVEIS = { reservas: 'SELECT * FROM v_reservas_detalhe ORDER BY criado_em DESC', transacoes: 'SELECT t.*, u.nome AS cliente_nome, u.email AS cliente_email FROM transacoes t JOIN utilizadores u ON u.id = t.utilizador_id ORDER BY t.criado_em DESC', utilizadores: 'SELECT id, nome, email, telefone, papel, saldo, pontos, ativo, criado_em, ultimo_acesso FROM utilizadores ORDER BY id' };
api.get('/api/admin/exportar/:tabela', async (req, res) => {
  await admin(req); const t = req.params.tabela.replace(/\.csv$/, '');
  const sql = EXPORTAVEIS[t] || (RECURSOS[t] && `SELECT * FROM ${t} ORDER BY id`); if (!sql) erro(404, 'Tabela desconhecida.');
  const linhas = await all(sql); const cols = linhas.length ? Object.keys(linhas[0]) : [];
  const esc = v => v == null ? '' : /[";\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const csv = '﻿' + [cols.join(';'), ...linhas.map(l => cols.map(c => esc(l[c])).join(';'))].join('\r\n');
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="turismo360-${t}-${hoje()}.csv"` });
  res.end(csv);
});

// Angola 365º (v3.4): geolocalização, futebol, eventos e sincronização, roteiros, ENDA AI e qualidade dos dados
require('./turismo').registar({ api, auth, admin, corpo, auditar, limitarTentativas, listarPublico, lingua, hoje, TABELAS_PUBLICAS });

module.exports = { api };
