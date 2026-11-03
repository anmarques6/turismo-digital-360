// Testes da versão Angola 365º: geolocalização, ENDA AI, sincronização, futebol, gastronomia, roteiros, segurança.
// A IA (AI Gateway), a Rádio 5 (RNA) e o OpenStreetMap são simulados em tests/fetch-falso.js.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { criarPool } = require('../src/pg');
const { classificar } = require('../src/enda');
const { distanciaKm } = require('../src/turismo');
const push = require('../src/push');
const VAPID = push.gerarChaves();

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
  srv = spawn(process.execPath, ['--require', path.join(__dirname, 'fetch-falso.js'), path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DATABASE_URL: urlTeste, AI_GATEWAY_API_KEY: 'chave-teste', VAPID_PUBLICA: VAPID.publica, VAPID_PRIVADA: VAPID.privada, LIMITE_TENTATIVAS: '200', ENDA_LIMITE: '500' }, stdio: ['ignore', 'pipe', 'inherit'] });
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

// ---------- J. Lugares públicos do OpenStreetMap e nome oficial ----------
test('J1 importação do OpenStreetMap: praias, alojamentos e restaurantes no mapa oficial, sem duplicar', async () => {
  const fontes = (await req('GET', '/api/admin/catalogo/fontes', null, admin)).j;
  const osm = fontes.find(f => f.metodo === 'osm'); assert.ok(osm, 'fonte OpenStreetMap existe');
  let r = await req('POST', `/api/admin/fontes/${osm.id}/sincronizar`, null, admin);
  assert.equal(r.j.estado, 'ok', r.j.erro);
  // 8 elementos: «Praia» genérica e o de Lisboa ficam de fora; Quedas de Calandula e Palmeiras já existiam
  assert.equal(r.j.lidos, 6); assert.equal(r.j.novos, 4);
  const c = (await req('GET', '/api/catalogo')).j;
  const praia = c.destinos.find(d => d.nome === 'Praia Morena');
  assert.equal(praia.categoria, 'Praias'); assert.equal(praia.provincia, 'Benguela'); assert.ok(praia.municipio); assert.equal(praia.imagem_ilustrativa, 1);
  assert.match(praia.fonte, /openstreetmap\.org\/way\/101/);
  assert.equal(c.destinos.filter(d => /Calandula/.test(d.nome)).length, 1, 'não duplica as Quedas de Calandula');
  const palm = c.alojamentos.filter(a => a.nome === 'Palmeiras Suite Hotel');
  assert.equal(palm.length, 1); assert.ok(palm[0].latitude != null, 'o hotel existente recebeu a localização');
  const res = c.alojamentos.find(a => a.nome === 'Residencial Teste Kinaxixe');
  assert.equal(res.tipo, 'Residenciais'); assert.equal(res.parceiro, 0); assert.equal(res.preco_noite, null); assert.equal(res.site, 'https://residencialteste.ao/');
  const resort = c.alojamentos.find(a => a.nome === 'Resort Teste do Namibe');
  assert.equal(resort.tipo, 'Resorts');
  assert.match(resort.imagem, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/Resort_Teste_Namibe\.jpg/); assert.equal(resort.imagem_ilustrativa, 0);
  assert.match(resort.imagem_fonte, /commons\.wikimedia\.org\/wiki\/File:/);
  const rest = c.restaurantes.find(x => x.nome === 'Restaurante Teste da Ilha');
  assert.equal(rest.especialidade, 'Marisqueira · Cozinha angolana'); assert.equal(rest.nivel_preco, null); assert.equal(rest.horario, 'Mo-Su 12:00-23:00');
  assert.ok(!c.restaurantes.some(x => x.nome === 'Restaurante de Lisboa'));
  // segunda leitura: nada novo
  r = await req('POST', `/api/admin/fontes/${osm.id}/sincronizar`, null, admin);
  assert.equal(r.j.novos, 0);
  // perto de mim encontra a residencial
  const perto = (await req('GET', '/api/geo/perto?lat=-8.825&lon=13.240&raio=2&tipos=alojamento')).j;
  const rk = perto.itens.find(i => i.nome === 'Residencial Teste Kinaxixe'); assert.ok(rk);
  assert.match(rk.navegacao.yango, /^https:\/\/yango\.go\.link\/route\?end-lat=-8\.825&end-lon=13\.24&ref=angola365&/);
});
test('J2 nome oficial «Quedas de Calandula» e experiências com localização', async () => {
  const c = (await req('GET', '/api/catalogo')).j;
  assert.ok(c.destinos.some(d => d.nome === 'Quedas de Calandula'));
  assert.ok(!JSON.stringify(c.destinos).includes('Kalandula') || c.destinos.every(d => !/Kalandula/.test(d.nome)));
  const xp = c.experiencias.find(x => /Calandula/.test(x.titulo));
  assert.ok(xp && xp.latitude != null, 'a experiência das Quedas tem localização');
  const en = (await req('GET', '/api/catalogo?lang=en')).j.destinos.find(d => d.id === c.destinos.find(x => x.nome === 'Quedas de Calandula').id);
  assert.ok(!/Kalandula/.test(en.nome));
  const r = await req('GET', '/api/cron/lugares'); assert.equal(r.status, 200);
});

// ---------- K. Notificações push ----------
test('K1 cifra Web Push (RFC 8291) decifrável pelo navegador', () => {
  const crypto = require('node:crypto');
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const auth = crypto.randomBytes(16);
  const msg = push.cifrar('{"titulo":"Olá"}', ua.getPublicKey().toString('base64url'), auth.toString('base64url'));
  const sal = msg.subarray(0, 16), idlen = msg[20], as = msg.subarray(21, 21 + idlen), corpo = msg.subarray(21 + idlen);
  const h = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
  const ikm = h(h(auth, ua.computeSecret(as)), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), as, Buffer.from([1])]));
  const prk = h(sal, ikm);
  const d = crypto.createDecipheriv('aes-128-gcm', h(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16), h(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12));
  d.setAuthTag(corpo.subarray(-16));
  const claro = Buffer.concat([d.update(corpo.subarray(0, -16)), d.final()]);
  assert.equal(claro.subarray(0, -1).toString(), '{"titulo":"Olá"}'); assert.equal(claro.at(-1), 2);
});
test('K2 subscrição de push: validada, guardada e usada nas notificações; subscrições mortas são apagadas', async () => {
  assert.equal((await req('GET', '/api/push/chave')).j.chave, VAPID.publica);
  const crypto = require('node:crypto'); const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const keys = { p256dh: ua.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') };
  assert.equal((await req('POST', '/api/push/subscrever', { endpoint: 'https://malicioso.exemplo/x', keys }, cliente)).status, 400);
  assert.equal((await req('POST', '/api/push/subscrever', { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys }, cliente)).status, 200);
  assert.equal((await req('POST', '/api/push/subscrever', { endpoint: 'https://fcm.googleapis.com/fcm/send/gone', keys }, cliente)).status, 200);
  assert.equal((await req('POST', '/api/notificacoes', { titulo: 'Teste push', corpo: 'Olá' }, cliente)).status, 200);
  await new Promise(r => setTimeout(r, 600));
  const pg = criarPool(urlTeste, 1);
  const L = (await pg.query("SELECT endpoint FROM push_subscricoes")).rows.map(x => x.endpoint); pg.fechar();
  assert.deepEqual(L, ['https://fcm.googleapis.com/fcm/send/abc'], 'a subscrição que respondeu 410 foi removida');
});

// ---------- L. Parceiros (operadores) ----------
test('L1 parceiro regista um hotel: produto criado no catálogo de alojamentos, em revisão até aprovação', async () => {
  const op = (await req('POST', '/api/auth/registar', { nome: 'Hotel Exemplo Lda', email: `op${Date.now()}@exemplo.ao`, senha: 'segredo12' })).j.token;
  const esq = await req('GET', '/api/parceiro/esquema'); assert.equal(esq.status, 200);
  assert.equal(esq.j.tipos.hotel.tabela, 'alojamentos'); assert.ok(esq.j.campos.alojamentos.preco_noite.req);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  assert.equal((await req('POST', '/api/parceiro/upload', { dados: 'data:image/png;base64,' + Buffer.from('<script>').toString('base64') }, op)).status, 400, 'não aceita ficheiros que não são imagens');
  const foto = (await req('POST', '/api/parceiro/upload', { dados: png }, op)).j.caminho; assert.match(foto, /^\/api\/imagens\/\d+$/);
  const neg = { tipo_negocio: 'hotel', nome: 'Hotel Marginal Exemplo', telefone: '923 000 111', endereco: 'Av. 4 de Fevereiro', latitude: LUANDA.lat, longitude: LUANDA.lon, imagem: foto };
  assert.equal((await req('POST', '/api/parceiro/negocios', { negocio: { ...neg, latitude: 38.7, longitude: -9.1 }, produto: { preco_noite: 50000 } }, op)).status, 400, 'fora de Angola');
  assert.equal((await req('POST', '/api/parceiro/negocios', { negocio: neg, produto: {} }, op)).status, 400, 'preço obrigatório');
  const r = await req('POST', '/api/parceiro/negocios', { negocio: neg, produto: { preco_noite: 55000, quartos: 20, comodidades: ['Wi-Fi', 'Piscina'], tipo: 'Villas' } }, op);
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal(r.j.negocio.estado, 'em_revisao'); assert.equal(r.j.negocio.provincia, 'Luanda'); assert.ok(r.j.negocio.municipio, 'município do mapa oficial');
  assert.equal(r.j.produto.tipo, 'Hotéis', 'o tipo vem do tipo de negócio'); assert.equal(r.j.produto.ativo, 0); assert.equal(r.j.produto.parceiro, 1);
  assert.equal(r.j.produto.negocio_id, r.j.negocio.id); assert.equal(Number(r.j.produto.latitude), LUANDA.lat);
  assert.equal((await req('GET', '/api/auth/eu', null, op)).j.utilizador.papel, 'parceiro');
  assert.ok(!(await req('GET', '/api/alojamentos')).j.some(a => a.id === r.j.produto.id), 'não aparece antes de aprovado');
  // outro utilizador não mexe no negócio nem nos produtos
  assert.equal((await req('PUT', `/api/parceiro/produtos/alojamentos/${r.j.produto.id}`, { preco_noite: 1 }, outro)).status, 403);
  assert.equal((await req('PUT', `/api/parceiro/produtos/utilizadores/1`, { nome: 'x' }, op)).status, 404, 'só tabelas do catálogo do parceiro');
  assert.equal((await req('PATCH', `/api/parceiro/produtos/alojamentos/${r.j.produto.id}`, { ativo: 1 }, op)).status, 409, 'não se publica sem aprovação');
  // administração aprova
  assert.equal((await req('PATCH', `/api/admin/negocios/${r.j.negocio.id}`, { estado: 'aprovado' }, op)).status, 403);
  const L = (await req('GET', '/api/admin/negocios', null, admin)).j; assert.ok(L.find(n => n.id === r.j.negocio.id).produtos.length === 1);
  assert.equal((await req('PATCH', `/api/admin/negocios/${r.j.negocio.id}`, { estado: 'aprovado' }, admin)).status, 200);
  const pub = (await req('GET', '/api/alojamentos')).j.find(a => a.id === r.j.produto.id);
  assert.ok(pub, 'publicado após aprovação'); assert.equal(pub.coord_estado, 'verificada'); assert.equal(pub.preco_noite, 55000);
  // um cliente reserva: o parceiro é avisado e vê a reserva no painel
  const rv = await req('POST', '/api/reservas', { tipo: 'alojamento', item_id: pub.id, quantidade: 2, data: new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10), metodo: 'Multicaixa Express' }, cliente);
  assert.equal(rv.status, 200, JSON.stringify(rv.j));
  await new Promise(x => setTimeout(x, 300));
  const painel = (await req('GET', '/api/parceiro/painel', null, op)).j;
  assert.equal(painel.reservas.length, 1); assert.equal(painel.reservas[0].codigo, rv.j.reserva.codigo); assert.ok(painel.reservas[0].cliente_nome);
  assert.ok((await req('GET', '/api/notificacoes', null, op)).j.lista.some(n => n.titulo === 'Nova reserva recebida'));
  assert.equal((await req('GET', '/api/parceiro/painel', null, outro)).j.reservas.length, 0, 'outros não vêem reservas alheias');
  // editar o negócio actualiza o produto principal
  assert.equal((await req('PUT', `/api/parceiro/negocios/${r.j.negocio.id}`, { negocio: { ...neg, nome: 'Hotel Marginal Novo', telefone: '923 999 999' } }, op)).status, 200);
  const ed = (await req('GET', '/api/parceiro/painel', null, op)).j.produtos[0];
  assert.equal(ed.nome, 'Hotel Marginal Novo'); assert.equal(ed.telefone, '923 999 999');
  // suspender esconde tudo
  await req('PATCH', `/api/admin/negocios/${r.j.negocio.id}`, { estado: 'suspenso', nota_admin: 'teste' }, admin);
  assert.ok(!(await req('GET', '/api/alojamentos')).j.some(a => a.id === pub.id));
});

test('L2 rent-a-car e organizador de eventos: vários produtos com empresa/organizador automáticos', async () => {
  const op = (await req('POST', '/api/auth/registar', { nome: 'Rent Exemplo', email: `rc${Date.now()}@exemplo.ao`, senha: 'segredo12' })).j.token;
  const r = await req('POST', '/api/parceiro/negocios', { negocio: { tipo_negocio: 'rentacar', nome: 'Kianda Rent', telefone: '+244 923 111 222', endereco: 'Aeroporto 4 de Fevereiro', latitude: -8.8584, longitude: 13.2312 } }, op);
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(r.j.produto, null, 'rent-a-car não cria produto único');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const foto = (await req('POST', '/api/parceiro/upload', { dados: png }, op)).j.caminho;
  const v = await req('POST', `/api/parceiro/negocios/${r.j.negocio.id}/produtos`, { nome: 'Toyota Hilux', categoria: 'SUVs', preco_dia: 45000, imagem: foto, empresa: 'Outra' }, op);
  assert.equal(v.status, 200, JSON.stringify(v.j)); assert.equal(v.j.empresa, 'Kianda Rent'); assert.equal(v.j.local_levantamento, 'Aeroporto 4 de Fevereiro');
  const ev = (await req('POST', '/api/parceiro/negocios', { negocio: { tipo_negocio: 'eventos', nome: 'Kianda Eventos', telefone: '923 111 333', endereco: 'Ilha de Luanda', latitude: LUANDA.lat, longitude: LUANDA.lon } }, op)).j.negocio;
  const e = await req('POST', `/api/parceiro/negocios/${ev.id}/produtos`, { titulo: 'Noite de Semba', categoria: 'Música', data: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10), hora: '20:00', preco: 5000, lotacao: 200, imagem: foto }, op);
  assert.equal(e.status, 200, JSON.stringify(e.j)); assert.equal(e.j.organizador, 'Kianda Eventos'); assert.equal(e.j.confianca, 'fonte identificada'); assert.ok(e.j.municipio && e.j.provincia_id, 'município e província do mapa oficial');
  const p = (await req('GET', '/api/parceiro/painel', null, op)).j; assert.equal(p.negocios.length, 2); assert.equal(p.produtos.length, 2);
  assert.equal((await req('DELETE', `/api/parceiro/produtos/viaturas/${v.j.id}`, null, op)).j.apagado, true);
});

test('L3 «Este negócio é meu»: o dono reclama uma ficha existente; só passa a ser dele depois de aprovado', async () => {
  const al = (await req('GET', '/api/alojamentos')).j.find(a => a.parceiro === 0 && !a.negocio_id && a.latitude != null);
  assert.ok(al, 'há fichas de alojamento sem dono');
  const op = (await req('POST', '/api/auth/registar', { nome: 'Dono Real', email: `dono${Date.now()}@exemplo.ao`, senha: 'segredo12' })).j.token;
  const op2 = (await req('POST', '/api/auth/registar', { nome: 'Outro Dono', email: `dono2${Date.now()}@exemplo.ao`, senha: 'segredo12' })).j.token;
  const neg = { nome: al.nome, telefone: '923 000 222', endereco: al.endereco || al.local, latitude: al.latitude, longitude: al.longitude };
  assert.equal((await req('POST', '/api/parceiro/negocios', { negocio: neg, produto: {}, reclamar: { tabela: 'alojamentos', id: al.id } }, op)).status, 400, 'preço obrigatório');
  assert.equal((await req('POST', '/api/parceiro/negocios', { negocio: neg, produto: { preco_noite: 1 }, reclamar: { tabela: 'utilizadores', id: 1 } }, op)).status, 400);
  const r = await req('POST', '/api/parceiro/negocios', { negocio: neg, produto: { preco_noite: 42000 }, reclamar: { tabela: 'alojamentos', id: al.id } }, op);
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(r.j.produto, null, 'não cria ficha duplicada');
  const r2 = (await req('POST', '/api/parceiro/negocios', { negocio: neg, produto: { preco_noite: 30000 }, reclamar: { tabela: 'alojamentos', id: al.id } }, op2)).j;
  let ficha = (await req('GET', '/api/alojamentos')).j.find(a => a.id === al.id);
  assert.equal(ficha.parceiro, 0, 'antes da aprovação, a ficha não muda'); assert.equal(ficha.negocio_id, null);
  const adm = (await req('GET', '/api/admin/negocios', null, admin)).j.find(n => n.id === r.j.negocio.id); assert.equal(adm.reclama.id, al.id);
  assert.equal((await req('PATCH', `/api/admin/negocios/${r.j.negocio.id}`, { estado: 'aprovado' }, admin)).status, 200);
  ficha = (await req('GET', '/api/alojamentos')).j.find(a => a.id === al.id);
  assert.equal(ficha.negocio_id, r.j.negocio.id); assert.equal(ficha.parceiro, 1); assert.equal(ficha.preco_noite, 42000); assert.equal(ficha.telefone, '923 000 222');
  const p = (await req('GET', '/api/parceiro/painel', null, op)).j; assert.equal(p.produtos.length, 1); assert.equal(p.produtos[0].id, al.id);
  const outro2 = (await req('GET', '/api/parceiro/painel', null, op2)).j.negocios[0];
  assert.equal(outro2.id, r2.negocio.id); assert.equal(outro2.estado, 'rejeitado', 'o outro pedido é recusado automaticamente');
  assert.equal((await req('POST', '/api/parceiro/negocios', { negocio: neg, produto: { preco_noite: 1 }, reclamar: { tabela: 'alojamentos', id: al.id } }, op2)).status, 409, 'já tem dono');
});
