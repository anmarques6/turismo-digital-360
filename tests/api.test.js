// Testes automáticos da API — correm sobre uma base de dados temporária.
//   TEST_DATABASE_URL=postgres://utilizador:senha@localhost:5432/postgres npm test
// Cria uma base de dados temporária nesse servidor, corre os testes e apaga-a no fim.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { criarPool } = require('../src/pg');

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = process.env.TEST_DATABASE_URL;
if (!BASE) { console.log('Defina TEST_DATABASE_URL (servidor PostgreSQL onde criar a base de dados de teste).'); process.exit(0); }
const NOME_BD = `td360_teste_${process.pid}`;
const urlTeste = (() => { const u = new globalThis.URL(BASE); u.pathname = '/' + NOME_BD; return u.toString(); })();
const adminPg = criarPool(BASE, 1);
const URL = `http://localhost:${PORT}`;
let srv;

async function req(metodo, rota, corpo, token) {
  const r = await fetch(URL + rota, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text();
  return { status: r.status, j };
}
const futuro = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

before(async () => {
  await adminPg.query(`CREATE DATABASE ${NOME_BD}`);
  srv = spawn(process.execPath, ['--require', path.join(__dirname, 'fetch-falso.js'), path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DATABASE_URL: urlTeste, GOOGLE_CLIENT_ID: 'id-teste', GOOGLE_CLIENT_SECRET: 'seg-teste', MICROSOFT_CLIENT_ID: 'id-ms', MICROSOFT_CLIENT_SECRET: 'seg-ms', FACEBOOK_APP_ID: '', LIMITE_TENTATIVAS: '200' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, falha) => { srv.stdout.on('data', d => { if (String(d).includes('a correr')) ok(); }); setTimeout(() => falha(new Error('servidor não arrancou')), 20000); });
});
after(async () => {
  srv?.kill(); await new Promise(r => setTimeout(r, 300));
  await adminPg.query(`DROP DATABASE IF EXISTS ${NOME_BD} WITH (FORCE)`); adminPg.fechar();
});

let cliente, admin;

test('catálogo público tem os dados iniciais', async () => {
  const { status, j } = await req('GET', '/api/catalogo');
  assert.equal(status, 200);
  assert.equal(j.destinos.length, 7); assert.equal(j.experiencias.length, 6); assert.equal(j.provincias.length, 21);
  assert.ok(Array.isArray(j.experiencias[0].galeria));
});

test('registo, entrada e senha errada', async () => {
  const email = `teste${Date.now()}@exemplo.ao`;
  let r = await req('POST', '/api/auth/registar', { nome: 'Teste Silva', email, senha: 'segredo1' });
  assert.equal(r.status, 200); assert.ok(r.j.token); assert.equal(r.j.utilizador.saldo, 0);
  r = await req('POST', '/api/auth/registar', { nome: 'Outro', email, senha: 'segredo1' });
  assert.equal(r.status, 409);
  r = await req('POST', '/api/auth/entrar', { email, senha: 'errada' });
  assert.equal(r.status, 401);
  r = await req('POST', '/api/auth/entrar', { email: 'visitante@turismo360.ao', senha: 'angola360' });
  assert.equal(r.status, 200); cliente = r.j.token;
  r = await req('POST', '/api/auth/entrar', { email: 'admin@turismo360.ao', senha: 'admin360' });
  assert.equal(r.status, 200); admin = r.j.token;
});

test('rotas privadas exigem sessão e admin exige papel', async () => {
  assert.equal((await req('GET', '/api/carteira')).status, 401);
  assert.equal((await req('GET', '/api/admin/resumo', null, cliente)).status, 403);
  assert.equal((await req('GET', '/api/admin/resumo', null, admin)).status, 200);
});

test('reserva com carteira debita saldo, dá pontos e o preço é calculado no servidor', async () => {
  const antes = (await req('GET', '/api/carteira', null, cliente)).j;
  const r = await req('POST', '/api/reservas', { tipo: 'experiencia', item_id: 6, quantidade: 2, data: futuro(10), metodo: 'Carteira 360', total: 1, preco_unitario: 1 }, cliente);
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal(r.j.reserva.total, 20000); assert.equal(r.j.reserva.estado, 'confirmada');
  assert.equal(r.j.utilizador.saldo, antes.saldo - 20000);
  assert.equal(r.j.utilizador.pontos, antes.pontos + 200);
});

test('saldo insuficiente é recusado sem alterar nada', async () => {
  const antes = (await req('GET', '/api/carteira', null, cliente)).j.saldo;
  const r = await req('POST', '/api/reservas', { tipo: 'experiencia', item_id: 1, quantidade: 12, data: futuro(20), metodo: 'Carteira 360' }, cliente);
  assert.equal(r.status, 402); assert.ok(r.j.falta > 0);
  assert.equal((await req('GET', '/api/carteira', null, cliente)).j.saldo, antes);
});

test('data no passado é recusada', async () => {
  const r = await req('POST', '/api/reservas', { tipo: 'experiencia', item_id: 1, quantidade: 1, data: '2020-01-01', metodo: 'Unitel Money' }, cliente);
  assert.equal(r.status, 400);
});

test('estabelecimento não parceiro não aceita reserva online', async () => {
  const r = await req('POST', '/api/reservas', { tipo: 'alojamento', item_id: 3, quantidade: 1, data: futuro(5), metodo: 'Unitel Money' }, cliente);
  assert.equal(r.status, 409);
});

test('desconto do alojamento é aplicado', async () => {
  await req('PUT', '/api/admin/catalogo/alojamentos/3', { parceiro: 1, preco_noite: 65000, oferta_pct: 30 }, admin);
  await req('PUT', '/api/admin/catalogo/restaurantes/1', { parceiro: 1, preco_medio: 8000 }, admin);
  await req('PUT', '/api/admin/catalogo/alojamentos/5', { parceiro: 1, preco_noite: 85000 }, admin);
  const r = await req('POST', '/api/reservas/cotacao', { tipo: 'alojamento', item_id: 3, quantidade: 2, data: futuro(5) });
  assert.equal(r.j.preco_unitario, 45500); assert.equal(r.j.total, 91000); assert.equal(r.j.data_fim, futuro(7));
});

test('Multicaixa fica pendente; admin confirma; cancelamento reembolsa para a carteira', async () => {
  let r = await req('POST', '/api/reservas', { tipo: 'restaurante', item_id: 1, quantidade: 2, data: futuro(3), hora: '20:00', metodo: 'Multicaixa Express' }, cliente);
  assert.equal(r.j.reserva.estado, 'pendente'); const id = r.j.reserva.id;
  assert.equal((await req('PATCH', `/api/admin/reservas/${id}`, { estado: 'confirmada' }, admin)).status, 200);
  const saldo = (await req('GET', '/api/carteira', null, cliente)).j.saldo;
  r = await req('POST', `/api/reservas/${id}/cancelar`, null, cliente);
  assert.equal(r.status, 200); assert.equal(r.j.reembolso, 16000); assert.equal(r.j.utilizador.saldo, saldo + 16000);
  assert.equal((await req('POST', `/api/reservas/${id}/cancelar`, null, cliente)).status, 400);
});

test('lotação de eventos é respeitada e bilhetes são contados', async () => {
  const novo = await req('POST', '/api/admin/catalogo/eventos', { titulo: 'Teste lotação', local: 'Luanda', data: futuro(30), hora: '20:00', categoria: 'Música', preco: 0, lotacao: 2, confianca: 'oficial', imagem: '/img/ev_jazz.webp' }, admin);
  assert.equal(novo.status, 200, JSON.stringify(novo.j)); const id = novo.j.id;
  assert.equal((await req('POST', '/api/reservas', { tipo: 'evento', item_id: id, quantidade: 2 }, cliente)).status, 200);
  assert.equal((await req('POST', '/api/reservas', { tipo: 'evento', item_id: id, quantidade: 1 }, cliente)).status, 409);
  const ev = (await req('GET', `/api/eventos/${id}`)).j; assert.equal(ev.bilhetes_vendidos, 2);
});

test('viaturas: sem unidades livres nas mesmas datas', async () => {
  await req('PUT', '/api/admin/catalogo/viaturas/3', { unidades: 1, parceiro: 1, preco_dia: 40000 }, admin);
  const b = { tipo: 'viatura', item_id: 3, data: futuro(40), data_fim: futuro(43), local: 'Luanda', metodo: 'Unitel Money' };
  const r1 = await req('POST', '/api/reservas', b, cliente); assert.equal(r1.status, 200); assert.equal(r1.j.reserva.quantidade, 3);
  assert.equal((await req('POST', '/api/reservas', { ...b, data: futuro(41) }, cliente)).status, 409);
});

test('favoritos, lembretes e notificações', async () => {
  assert.equal((await req('POST', '/api/favoritos', { tipo: 'evento', item_id: 4 }, cliente)).status, 200);
  assert.ok((await req('GET', '/api/favoritos', null, cliente)).j.some(f => f.tipo === 'evento' && f.item_id === 4));
  assert.equal((await req('DELETE', '/api/favoritos/evento/4', null, cliente)).status, 200);
  const l = await req('POST', '/api/lembretes', { tipo: 'evento', item_id: 4 }, cliente); assert.equal(l.status, 200); assert.ok(l.j.quando_txt);
  const n = await req('GET', '/api/notificacoes', null, cliente); assert.ok(n.j.lista.some(x => x.titulo === 'Lembrete criado'));
});

test('avaliação actualiza a média e só uma por pessoa', async () => {
  const antes = (await req('GET', '/api/experiencias/5')).j;
  assert.equal((await req('POST', '/api/avaliacoes', { tipo: 'experiencia', item_id: 5, nota: 1, comentario: 'Teste' }, cliente)).status, 200);
  const depois = (await req('GET', '/api/experiencias/5')).j;
  assert.equal(depois.num_avaliacoes, antes.num_avaliacoes + 1); assert.ok(depois.rating < antes.rating);
  assert.equal((await req('POST', '/api/avaliacoes', { tipo: 'experiencia', item_id: 5, nota: 5 }, cliente)).status, 409);
});

test('admin: validação, edição, apagar com reservas despublica', async () => {
  assert.equal((await req('POST', '/api/admin/catalogo/destinos', { nome: 'X', categoria: 'Inexistente', descricao: 'y', imagem: '/img/hero.webp' }, admin)).status, 400);
  const e = await req('PUT', '/api/admin/catalogo/experiencias/6', { preco: 11000 }, admin); assert.equal(e.j.preco, 11000);
  const d = await req('DELETE', '/api/admin/catalogo/experiencias/6', null, admin); assert.equal(d.j.arquivado, true);
  assert.ok(!(await req('GET', '/api/catalogo')).j.experiencias.some(x => x.id === 6));
  const csv = await req('GET', '/api/admin/exportar/reservas', null, admin); assert.ok(String(csv.j).includes('codigo'));
});

test('admin: ajuste de saldo e suspensão de conta', async () => {
  const u = (await req('GET', '/api/admin/utilizadores', null, admin)).j.find(x => x.email === 'visitante@turismo360.ao');
  const r = await req('POST', `/api/admin/utilizadores/${u.id}/ajuste`, { valor: 5000, motivo: 'Teste' }, admin);
  assert.equal(r.j.saldo, u.saldo + 5000);
  assert.equal((await req('POST', `/api/admin/utilizadores/${u.id}/ajuste`, { valor: -1e9, motivo: 'x' }, admin)).status, 400);
  await req('PATCH', `/api/admin/utilizadores/${u.id}`, { ativo: 0 }, admin);
  assert.equal((await req('GET', '/api/auth/eu', null, cliente)).status, 401);
  assert.equal((await req('POST', '/api/auth/entrar', { email: 'visitante@turismo360.ao', senha: 'angola360' })).status, 403);
});

test('reservas em simultâneo não gastam mais do que o saldo', async () => {
  const email = `paralelo${Date.now()}@exemplo.ao`;
  const r = await req('POST', '/api/auth/registar', { nome: 'Teste Paralelo', email, senha: 'segredo1' }); const tk = r.j.token;
  const adm = (await req('GET', '/api/admin/utilizadores', null, admin)).j.find(u => u.email === email);
  await req('POST', `/api/admin/utilizadores/${adm.id}/ajuste`, { valor: 25000, motivo: 'Teste' }, admin);
  const pedidos = Array.from({ length: 5 }, () => req('POST', '/api/reservas', { tipo: 'experiencia', item_id: 5, quantidade: 1, data: futuro(9), metodo: 'Carteira 360' }, tk));
  const res = await Promise.all(pedidos);
  const ok = res.filter(x => x.status === 200).length; // experiência 5 custa 12.000 Kz → só cabem 2
  assert.equal(ok, 2); assert.equal((await req('GET', '/api/carteira', null, tk)).j.saldo, 1000);
});

test('imagens carregadas ficam na base de dados e são servidas', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const up = await req('POST', '/api/admin/upload', { dados: png }, admin); assert.equal(up.status, 200);
  const r = await fetch(URL + up.j.caminho); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/png');
  assert.ok((await req('GET', '/api/admin/esquema', null, admin)).j.imagens.includes(up.j.caminho));
});

test('tarefa agendada de lembretes responde', async () => {
  const r = await req('GET', '/api/cron/lembretes'); assert.equal(r.status, 200); assert.equal(typeof r.j.entregues, 'number');
});

// ---------- v3.2: entrada com Google/Microsoft, multilíngua ----------
async function oauth(p, codigo, semCookie) {
  let r = await fetch(`${URL}/api/auth/oauth/${p}?lang=en`, { redirect: 'manual' });
  assert.equal(r.status, 302);
  const loc = new globalThis.URL(r.headers.get('location'));
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const state = loc.searchParams.get('state');
  r = await fetch(`${URL}/api/auth/oauth/${p}/retorno?code=${codigo}&state=${encodeURIComponent(state)}`, { redirect: 'manual', headers: semCookie ? {} : { Cookie: cookie } });
  assert.equal(r.status, 302);
  const destino = decodeURIComponent(r.headers.get('location'));
  let token = null;
  if (destino.startsWith('/#codigo=')) { const t = await req('POST', '/api/auth/oauth/trocar', { codigo: destino.slice(9) }); token = t.j.token; }
  return { inicio: loc, destino, token };
}

test('só os fornecedores configurados ficam activos', async () => {
  const { j } = await req('GET', '/api/auth/provedores');
  assert.deepEqual(j.ativos.sort(), ['google', 'microsoft']);
  const r = await fetch(`${URL}/api/auth/oauth/facebook`, { redirect: 'manual' });
  assert.equal(r.status, 302); assert.match(decodeURIComponent(r.headers.get('location')), /#erro-entrada=A entrada com Facebook ainda não foi activada/);
});

test('entrar com Google cria a conta, liga-a e volta a entrar na mesma', async () => {
  const a = await oauth('google', 'codigo-bom');
  assert.equal(a.inicio.host, 'accounts.google.com');
  assert.equal(a.inicio.searchParams.get('redirect_uri'), `${URL}/api/auth/oauth/google/retorno`);
  assert.match(a.destino, /^\/#codigo=/); assert.ok(a.token);
  const token = a.token;
  assert.equal((await req('POST', '/api/auth/oauth/trocar', { codigo: a.destino.slice(9) })).status, 401); // o código só serve uma vez
  let r = await req('GET', '/api/auth/eu', null, token);
  assert.equal(r.j.utilizador.email, 'nova.google@exemplo.ao'); assert.equal(r.j.utilizador.nome, 'Ana Google');
  assert.equal(r.j.utilizador.idioma, 'en'); assert.equal(r.j.utilizador.senha_definida, 0);
  const b = await oauth('google', 'codigo-bom');
  r = await req('GET', '/api/auth/eu', null, b.token);
  assert.equal(r.j.utilizador.id, (await req('GET', '/api/auth/eu', null, token)).j.utilizador.id);
  // a conta social pode definir a primeira senha sem a actual e passar a entrar com e-mail
  r = await req('PATCH', '/api/auth/eu', { senha_nova: 'novasenha1' }, token);
  assert.equal(r.status, 200); assert.equal(r.j.utilizador.senha_definida, 1);
  r = await req('POST', '/api/auth/entrar', { email: 'nova.google@exemplo.ao', senha: 'novasenha1' });
  assert.equal(r.status, 200);
});

test('entrada social recusada: sem cookie, código inválido, e-mail não verificado de outra conta', async () => {
  assert.match((await oauth('google', 'codigo-bom', true)).destino, /#erro-entrada=O pedido de entrada expirou/);
  assert.match((await oauth('google', 'codigo-mau')).destino, /#erro-entrada=Não foi possível confirmar a conta Google/);
  assert.match((await oauth('microsoft', 'x')).destino, /#erro-entrada=Já existe uma conta com visitante@turismo360.ao/);
  const r = await fetch(`${URL}/api/auth/oauth/google/retorno?error=access_denied&state=x`, { redirect: 'manual' });
  assert.match(decodeURIComponent(r.headers.get('location')), /Entrada cancelada/);
});

test('catálogo traduzido e traduções editáveis no painel', async () => {
  let r = await req('GET', '/api/catalogo?lang=en');
  const kal = r.j.destinos.find(d => d.id === 2);
  assert.equal(kal.nome, 'Calandula Falls'); assert.equal(kal.i18n, undefined);
  assert.equal((await req('GET', '/api/catalogo?lang=es')).j.experiencias[0].titulo, 'Aventura en las cataratas de Calandula');
  assert.equal((await req('GET', '/api/catalogo?lang=xx')).j.destinos[1].nome, 'Quedas de Calandula');
  r = await req('PUT', '/api/admin/catalogo/pratos/1', { i18n: { en: { nome: 'Chicken muamba', lixo: 'x' }, de: { nome: 'Hähnchen' } } }, admin);
  assert.equal(r.status, 200); assert.deepEqual(r.j.i18n, { en: { nome: 'Chicken muamba' } });
  assert.equal((await req('GET', '/api/catalogo?lang=en')).j.pratos.find(p => p.id === 1).nome, 'Chicken muamba');
  assert.equal((await req('GET', '/api/catalogo?lang=fr')).j.pratos.find(p => p.id === 1).nome, 'Muamba de Galinha');
  r = await req('GET', '/api/admin/configuracao', null, admin);
  assert.equal(r.j.oauth.find(o => o.id === 'google').ativo, true);
  assert.equal(r.j.oauth.find(o => o.id === 'apple'), undefined);
});

test('segurança: senha forte, bloqueio após 5 falhas, fim de sessão por inactividade', async () => {
  const email = `forte${Date.now()}@exemplo.ao`;
  assert.equal((await req('POST', '/api/auth/registar', { nome: 'Fraca', email, senha: 'abcdefgh' })).status, 400);
  assert.equal((await req('POST', '/api/auth/registar', { nome: 'Forte', email, senha: 'abc12345' })).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await req('POST', '/api/auth/entrar', { email, senha: 'errada12' })).status, 401);
  let r = await req('POST', '/api/auth/entrar', { email, senha: 'abc12345' });
  assert.equal(r.status, 429); assert.match(r.j.erro, /bloqueada temporariamente/);
  // inactividade: simula 2 minutos sem pedidos
  r = await req('POST', '/api/auth/entrar', { email: 'admin@turismo360.ao', senha: 'admin360' });
  const tk = r.j.token; assert.ok(tk, JSON.stringify(r.j));
  assert.equal((await req('POST', '/api/auth/ativo', null, tk)).j.inatividade_s, 60);
  const bd = criarPool(urlTeste, 1);
  await bd.query("UPDATE sessoes SET ultimo_uso = to_char((now() AT TIME ZONE 'UTC') - interval '2 minutes', 'YYYY-MM-DD HH24:MI:SS')");
  bd.fechar();
  r = await req('GET', '/api/auth/eu', null, tk);
  assert.equal(r.status, 401); assert.equal(r.j.inatividade, true);
  assert.equal((await req('GET', '/api/auth/eu', null, tk)).status, 401);
});
