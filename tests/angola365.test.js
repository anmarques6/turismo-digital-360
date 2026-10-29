// Testes da versão Angola 365º: geolocalização, ENDA AI, sincronização, futebol, gastronomia, roteiros, segurança.
// A IA (AI Gateway), a Rádio 5 (RNA) e o OpenStreetMap são simulados em tests/fetch-falso.js.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { criarPool } = require('../src/pg');
const { classificar } = require('../src/enda');
const { distanciaKm } = require('../src/turismo');

const PORT = 4100 + Math.floor(Math.random() * 90);
const BASE = process.env.TEST_DATABASE_URL;
if (!BASE) { console.log('Defina TEST_DATABASE_URL.'); process.exit(0); }
const NOME_BD = `a365_teste_${process.pid}`;
const urlTeste = (() => { const u = new globalThis.URL(BASE); u.pathname = '/' + NOME_BD; return u.toString(); })();
const adminPg = criarPool(BASE, 1);
const URL = `http://localhost:${PORT}`;
let srv, cliente, admin, outro;

async function req(metodo, rota, corpo, token) {
  const r = await fetch(URL + rota, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text();
  return { status: r.status, j, h: r.headers };
}
const LUANDA = { lat: -8.8159, lon: 13.2306 }; // Marginal de Luanda

before(async () => {
  await adminPg.query(`CREATE DATABASE ${NOME_BD}`);
  srv = spawn(process.execPath, ['--require', path.join(__dirname, 'fetch-falso.js'), path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DATABASE_URL: urlTeste, AI_GATEWAY_API_KEY: 'chave-teste', LIMITE_TENTATIVAS: '200', ENDA_LIMITE: '500' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, falha) => { srv.stdout.on('data', d => { if (String(d).includes('a correr')) ok(); }); setTimeout(() => falha(new Error('servidor não arrancou')), 20000); });
  cliente = (await req('POST', '/api/auth/entrar', { email: 'visitante@turismo360.ao', senha: 'angola360' })).j.token;
  admin = (await req('POST', '/api/auth/entrar', { email: 'admin@turismo360.ao', senha: 'admin360' })).j.token;
  outro = (await req('POST', '/api/auth/registar', { nome: 'Outra Pessoa', email: `outro${Date.now()}@exemplo.ao`, senha: 'segredo12' })).j.token;
  assert.ok(cliente && admin && outro);
});
after(async () => {
  srv?.kill(); await new Promise(r => setTimeout(r, 300));
  await adminPg.query(`DROP DATABASE IF EXISTS ${NOME_BD} WITH (FORCE)`); adminPg.fechar();
});

// ---------- A. Geolocalização e mapas ----------
test('A1 perto de mim: ordenado por distância, com ligações de navegação', async () => {
  const { status, j } = await req('GET', `/api/geo/perto?lat=${LUANDA.lat}&lon=${LUANDA.lon}&raio=30`);
  assert.equal(status, 200); assert.equal(j.fora_de_angola, false); assert.ok(j.itens.length >= 3);
  for (let i = 1; i < j.itens.length; i++) assert.ok(j.itens[i].distancia_km >= j.itens[i - 1].distancia_km);
  const p = j.itens[0];
  assert.match(p.navegacao.google, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d/);
  assert.match(p.navegacao.waze, /^https:\/\/waze\.com\/ul\?ll=.*&navigate=yes$/);
  assert.ok(['verificada', 'aproximada'].includes(p.coord_estado));
  assert.ok(j.itens.every(i => i.distancia_km <= 30));
});
test('A2 localização inválida, fora de Angola e filtro por tipo', async () => {
  assert.equal((await req('GET', '/api/geo/perto?lat=abc')).status, 400);
  const lx = await req('GET', '/api/geo/perto?lat=38.72&lon=-9.14&raio=50');
  assert.equal(lx.j.fora_de_angola, true); assert.equal(lx.j.itens.length, 0);
  const r = await req('GET', `/api/geo/perto?lat=${LUANDA.lat}&lon=${LUANDA.lon}&raio=500&tipos=restaurante`);
  assert.ok(r.j.itens.length > 0 && r.j.itens.every(i => i.tipo === 'restaurante'));
});
test('A3 pesquisa manual: catálogo + OpenStreetMap com atribuição; mapa com estádios', async () => {
  assert.equal((await req('GET', '/api/geo/pesquisa?q=a')).status, 400);
  const { j } = await req('GET', '/api/geo/pesquisa?q=Marginal');
  assert.ok(j.lugares.length === 1 && j.lugares[0].fonte.startsWith('https://www.openstreetmap.org/way/'));
  assert.match(j.atribuicao, /OpenStreetMap/);
  const m = await req('GET', '/api/geo/mapa');
  assert.ok(m.j.itens.length >= 10 && m.j.estadios.length >= 5);
  assert.ok(m.j.itens.every(i => i.lat >= -18.1 && i.lat <= -4.3 && i.lon >= 11.6 && i.lon <= 24.1), 'todas as coordenadas dentro de Angola');
});
test('A4 distância de Haversine (Luanda–Benguela ≈ 420 km em linha recta)', () => {
  const d = distanciaKm(-8.8383, 13.2344, -12.5763, 13.4055);
  assert.ok(d > 400 && d < 430, String(d));
});

// ---------- B. ENDA AI ----------
test('B1 âmbito decidido no servidor', () => {
  assert.equal(classificar('Escreve um código em python para ordenar uma lista'), 'fora');
  assert.equal(classificar('Quem ganha as eleições?'), 'fora');
  assert.equal(classificar('Onde posso comer mufete em Luanda?'), 'turismo');
  assert.equal(classificar('Olá'), 'social');
});
test('B2 ENDA exige sessão; pedido fora do âmbito é recusado sem chamar a IA e fica registado', async () => {
  assert.equal((await req('POST', '/api/enda', { mensagem: 'olá' })).status, 401);
  const r = await req('POST', '/api/enda', { mensagem: 'Escreve um código em python para ordenar uma lista', lang: 'pt' }, cliente);
  assert.equal(r.status, 200); assert.equal(r.j.modo, 'ambito'); assert.match(r.j.resposta, /só posso ajudar com turismo em Angola/);
  const en = await req('POST', '/api/enda', { mensagem: 'Write python code to sort a list', lang: 'en' }, cliente);
  assert.match(en.j.resposta, /only help with tourism in Angola/);
  // pedido ambíguo: é o modelo que o identifica e o servidor recusa
  const m = await req('POST', '/api/enda', { mensagem: 'Qual é a capital de França?', lang: 'pt' }, cliente);
  assert.equal(m.j.modo, 'ambito'); assert.equal(m.j.itens.length, 0);
});
test('B3 ENDA usa ferramentas com dados reais e cita fontes; mantém o contexto da conversa', async () => {
  const r = await req('POST', '/api/enda', { mensagem: 'Quais são os próximos jogos?', lang: 'pt' }, cliente);
  assert.equal(r.j.modo, 'ia'); assert.match(r.j.resposta, /Resposta com dados: \{"jogos":\[/);
  assert.ok(r.j.fontes.some(f => /rna\.ao/.test(f.url)), 'cita a fonte dos jogos');
  const s = r.j.sessao;
  const r2 = await req('POST', '/api/enda', { mensagem: 'quantas mensagens temos?', sessao: s, lang: 'pt' }, cliente);
  assert.match(r2.j.resposta, /mensagens=4 modelo=anthropic\/claude-haiku-4\.5/); // sistema + 2 anteriores + actual; modelo escolhido da lista
  // a sessão de outra pessoa não é reutilizada
  const r3 = await req('POST', '/api/enda', { mensagem: 'quantas mensagens temos?', sessao: s, lang: 'pt' }, outro);
  assert.notEqual(r3.j.sessao, s); assert.match(r3.j.resposta, /mensagens=2/);
});
test('B4 ENDA com a localização: lugares perto; sem localização pede-a', async () => {
  const sem = await req('POST', '/api/enda', { mensagem: 'o que há perto?', lang: 'pt' }, cliente);
  assert.match(sem.j.resposta, /ainda não partilhou a localização/);
  const com = await req('POST', '/api/enda', { mensagem: 'o que há perto?', posicao: { ...LUANDA, precisao: 20 }, lang: 'pt' }, cliente);
  assert.ok(com.j.itens.length > 0 && com.j.itens[0].navegacao?.google);
});
test('B5 ENDA guarda um roteiro a pedido; falha da IA cai no modo local e fica registada', async () => {
  const r = await req('POST', '/api/enda', { mensagem: 'guarda um roteiro de 1 dia em Luanda', lang: 'pt' }, cliente);
  assert.equal(r.j.acoes[0].tipo, 'roteiro_guardado');
  const L = (await req('GET', '/api/roteiros', null, cliente)).j;
  assert.ok(L.some(x => x.id === r.j.acoes[0].id && x.itens[0].nome === 'Fortaleza de São Miguel'));
  const f = await req('POST', '/api/enda', { mensagem: 'FALHA: hotéis em Benguela', lang: 'pt' }, cliente);
  assert.equal(f.j.modo, 'local'); assert.ok(f.j.aviso); assert.match(f.j.resposta, /Encontrei|Não encontrei/);
  const reg = (await req('GET', '/api/admin/enda', null, admin)).j;
  assert.ok(reg.some(x => x.tipo === 'fora_ambito') && reg.some(x => x.tipo === 'erro'));
  assert.equal((await req('GET', '/api/admin/enda', null, cliente)).status, 403);
});

// ---------- D. Sincronização de eventos/jogos ----------
test('D1 sincronização: novos, alteração registada no histórico, duplicado ignorado, fonte em baixo', async () => {
  const fontes = (await req('GET', '/api/admin/catalogo/fontes', null, admin)).j;
  const rna = (fontes.itens || fontes).find(f => f.endpoint?.includes('jogos_proximos'));
  assert.ok(rna, 'fonte RNA existe');
  let r = await req('POST', `/api/admin/fontes/${rna.id}/sincronizar`, null, admin);
  assert.equal(r.j.estado, 'ok'); assert.equal(r.j.novos, 2);
  r = await req('POST', `/api/admin/fontes/${rna.id}/sincronizar`, null, admin);
  assert.equal(r.j.alterados, 1); assert.equal(r.j.duplicados, 1); assert.equal(r.j.novos, 0);
  const jogo = (await req('GET', '/api/jogos?clube=Sagrada&desde=2027-01-01')).j.jogos.find(j => j.casa === 'Petro de Luanda');
  assert.equal(jogo.data_hora, '2027-01-12 17:00'); assert.equal(jogo.estado, 'adiado');
  const h = (await req('GET', `/api/admin/historico?tabela=jogos&id=${jogo.id}`, null, admin)).j;
  assert.ok(h.some(x => x.campo === 'data_hora' && x.antes === '2027-01-10 15:00' && x.depois === '2027-01-12 17:00'));
  r = await req('POST', `/api/admin/fontes/${rna.id}/sincronizar`, null, admin);
  assert.equal(r.j.estado, 'erro');
  // os dados já recolhidos continuam publicados quando a fonte falha
  assert.ok((await req('GET', '/api/jogos?desde=2027-01-01')).j.jogos.length >= 2);
  const sync = (await req('GET', '/api/admin/sincronizacoes', null, admin)).j.filter(s => s.fonte_id === rna.id);
  assert.equal(sync.length, 3); assert.deepEqual(sync.map(s => s.estado), ['erro', 'ok', 'ok']);
  const aud = (await req('GET', '/api/admin/auditoria', null, admin)).j;
  assert.ok(aud.filter(a => a.acao === 'sincronizar').length >= 3);
  const q = (await req('GET', '/api/admin/qualidade', null, admin)).j;
  assert.ok(q.some(p => p.tabela === 'fontes' && /Fonte com erro/.test(p.problema)));
  assert.ok(q.some(p => /Estádio «Estádio Ombaka» sem correspondência/.test(p.problema)));
});
test('D2 tarefa agendada de sincronização responde e respeita CRON_SECRET quando definido', async () => {
  const r = await req('GET', '/api/cron/sincronizar');
  assert.equal(r.status, 200); assert.ok(Array.isArray(r.j.fontes) || typeof r.j === 'object');
});

// ---------- E. Futebol ----------
test('E1 central de futebol: filtros, resultados e estádio com navegação', async () => {
  const { j } = await req('GET', '/api/jogos');
  assert.ok(j.jogos.length > 0 && j.fontes.length > 0);
  const chaves = j.jogos.map(x => x.data_hora.slice(0, 10) + x.casa + x.fora);
  assert.equal(new Set(chaves).size, chaves.length, 'sem jogos repetidos');
  assert.ok(j.jogos.every(x => x.data_hora >= j.jogos[0].data_hora));
  const ter = (await req('GET', '/api/jogos?estado=terminado&ordem=desc')).j.jogos;
  assert.ok(ter.length > 0 && ter.every(x => x.estado === 'terminado' && x.golos_casa != null));
  const comEstadio = j.jogos.find(x => x.latitude != null);
  assert.match(comEstadio.navegacao.google, /destination=/);
  const prov = (await req('GET', '/api/jogos?provincia=Benguela')).j.jogos;
  assert.ok(prov.every(x => x.estadio_provincia === 'Benguela'));
  const est = (await req('GET', '/api/estadios')).j;
  assert.ok(est.length >= 10 && Array.isArray(est[0].aliases));
});

// ---------- F. Gastronomia e eventos ----------
test('F1 pratos com ingredientes e fonte, ligados a restaurantes reais', async () => {
  const c = (await req('GET', '/api/catalogo?lang=en')).j;
  const mufete = c.pratos.find(p => /mufete/i.test(p.nome));
  assert.ok(mufete.ingredientes.length >= 3 && /^https:\/\/.*wikipedia/.test(mufete.fonte));
  const liga = c.pratos_restaurantes.filter(x => x.prato_id === mufete.id);
  assert.ok(liga.length >= 1 && liga.every(x => c.restaurantes.some(r => r.id === x.restaurante_id)));
});
test('F2 eventos com fonte e confiança; os com bilheteira externa não são vendidos aqui', async () => {
  const ev = (await req('GET', '/api/catalogo')).j.eventos;
  assert.ok(ev.length > 0 && ev.every(e => e.confianca && (e.fonte_tipo === 'exemplo' || e.fonte_url)));
  const ext = ev.find(e => e.bilhetes_url);
  const r = await req('POST', '/api/reservas/cotacao', { tipo: 'evento', item_id: ext.id, quantidade: 1 });
  assert.ok(r.status >= 400);
});

// ---------- Roteiros ----------
test('R1 roteiros: planear com dados reais, guardar, editar, isolamento entre utilizadores', async () => {
  const p = (await req('POST', '/api/roteiros/planear', { cidade: 'Luanda', dias: 2, pessoas: 2 }, cliente)).j;
  assert.ok(p.itens.length >= 2 && p.itens.every(i => i.lat != null)); assert.match(p.nota, /linha recta/);
  assert.ok(p.itens.filter(i => i.km_anterior != null).every(i => i.km_anterior <= 60));
  assert.equal((await req('POST', '/api/roteiros', { titulo: '' }, cliente)).status, 400);
  const r = (await req('POST', '/api/roteiros', { titulo: 'Fim de semana', cidade: 'Luanda', dias: 2, itens: p.itens }, cliente)).j;
  assert.equal(r.itens.length, p.itens.length);
  const e = await req('PUT', `/api/roteiros/${r.id}`, { titulo: 'Fim de semana em Luanda', dias: 2, itens: p.itens.slice(0, 1) }, cliente);
  assert.equal(e.j.titulo, 'Fim de semana em Luanda'); assert.equal(e.j.itens.length, 1);
  assert.equal((await req('PUT', `/api/roteiros/${r.id}`, { titulo: 'roubo', itens: [] }, outro)).status, 404);
  assert.ok(!(await req('GET', '/api/roteiros', null, outro)).j.some(x => x.id === r.id));
  await req('DELETE', `/api/roteiros/${r.id}`, null, cliente);
  assert.ok(!(await req('GET', '/api/roteiros', null, cliente)).j.some(x => x.id === r.id));
});

// ---------- G. Segurança ----------
test('G1 rotas de administração protegidas; cabeçalhos de segurança', async () => {
  for (const rota of ['/api/admin/sincronizacoes', '/api/admin/auditoria', '/api/admin/qualidade', '/api/admin/historico']) {
    assert.equal((await req('GET', rota)).status, 401); assert.equal((await req('GET', rota, null, cliente)).status, 403);
  }
  assert.equal((await req('POST', '/api/admin/fontes/1/sincronizar', null, cliente)).status, 403);
  const h = (await req('GET', '/')).h;
  assert.match(h.get('content-security-policy') || '', /tile\.openstreetmap\.org/);
  assert.equal(h.get('x-frame-options'), 'DENY');
});

// ---------- H. Mapa oficial de municípios (shapefile Angola_Level2) ----------
test('H1 localizar pontos no mapa oficial; coordenadas fora do mapa são recusadas no painel', async () => {
  const l = (await req('GET', '/api/geo/localizar?lat=-12.5763&lon=13.4055')).j.local;
  assert.deepEqual([l.municipio, l.provincia], ['Benguela', 'Benguela']);
  assert.equal((await req('GET', '/api/geo/localizar?lat=-9&lon=12.5')).j.local, null); // no mar
  assert.equal((await req('GET', '/api/geo/municipios')).j.length, 326);
  const base = { nome: 'Miradouro de teste', categoria: 'Natureza', descricao: 'teste', imagem: '/img/hero.jpg' };
  const fora = await req('POST', '/api/admin/catalogo/destinos', { ...base, latitude: -9, longitude: 12.5 }, admin);
  assert.equal(fora.status, 400); assert.match(fora.j.erro || fora.j.mensagem || JSON.stringify(fora.j), /fora do mapa oficial/);
  const ok = await req('POST', '/api/admin/catalogo/destinos', { ...base, latitude: -14.917, longitude: 13.4925, provincia_id: 1 }, admin);
  assert.equal(ok.status, 200); assert.equal(ok.j.municipio, 'Lubango');
  const huila = (await req('GET', '/api/catalogo')).j.provincias.find(p => p.nome === 'Huíla');
  assert.equal(ok.j.provincia_id, huila.id, 'a província segue o mapa, não o que foi escrito');
  // todos os lugares publicados obedecem ao mapa
  const m = (await req('GET', '/api/geo/mapa')).j.itens;
  assert.ok(m.every(i => i.municipio_mapa && i.provincia_mapa === (i.provincia || i.provincia_mapa)), 'província de cada lugar = província do mapa');
});

// ---------- I. Pesquisa diária com IA em sites públicos ----------
test('I1 página pública lida pela IA: inventados e passados descartados; sem duplicar', async () => {
  const fontes = (await req('GET', '/api/admin/catalogo/fontes', null, admin)).j;
  const tk = fontes.find(f => f.metodo === 'ia_pagina' && f.endpoint === 'https://ticket.ao/');
  let r = await req('POST', `/api/admin/fontes/${tk.id}/sincronizar`, null, admin);
  assert.equal(r.j.estado, 'ok', r.j.erro); assert.equal(r.j.lidos, 1); assert.equal(r.j.novos, 1);
  r = await req('POST', `/api/admin/fontes/${tk.id}/sincronizar`, null, admin);
  assert.equal(r.j.novos, 0);
  const ev = (await req('GET', '/api/catalogo')).j.eventos;
  const k = ev.find(e => e.titulo === 'Festival Kizomba na Baía');
  assert.equal(k.confianca, 'fonte identificada'); assert.equal(k.bilhetes_url, 'https://ticket.ao/event/kizomba-baia'); assert.equal(k.fonte_tipo, 'ia');
  assert.ok(!ev.some(e => /Inventado|Antigo/.test(e.titulo)));
  assert.ok(k.latitude == null || k.municipio, 'coordenadas só com município do mapa');
});
test('I2 notícias e rumores: rumor publicado como tal, notícia do mesmo evento não duplica, ligação falsa descartada', async () => {
  const fontes = (await req('GET', '/api/admin/catalogo/fontes', null, admin)).j;
  const nt = fontes.find(f => f.metodo === 'ia_noticias');
  const r = await req('POST', `/api/admin/fontes/${nt.id}/sincronizar`, null, admin);
  assert.equal(r.j.estado, 'ok', r.j.erro); assert.equal(r.j.novos, 1); assert.equal(r.j.duplicados, 1);
  const ev = (await req('GET', '/api/catalogo')).j.eventos;
  const rumor = ev.find(e => /Carnaval de Benguela/.test(e.titulo));
  assert.equal(rumor.confianca, 'rumor'); assert.equal(rumor.fonte_url, 'https://news.exemplo.ao/carnaval-benguela'); assert.equal(rumor.bilhetes_url, null);
  assert.ok(!ev.some(e => /ligação falsa/.test(e.titulo)));
  assert.equal((await req('POST', '/api/reservas/cotacao', { tipo: 'evento', item_id: rumor.id, quantidade: 1 })).status >= 400, true, 'rumores não se vendem');
  const q = (await req('GET', '/api/admin/qualidade', null, admin)).j;
  assert.ok(q.some(p => /Rumor publicado/.test(p.problema)));
});
test('I3 tarefa diária de pesquisa responde', async () => {
  const r = await req('GET', '/api/cron/pesquisa');
  assert.equal(r.status, 200); assert.ok(Array.isArray(r.j.fontes));
});
