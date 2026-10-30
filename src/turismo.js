// Angola 365º — rotas de geolocalização, futebol, eventos/sincronização, roteiros e qualidade dos dados.
const crypto = require('node:crypto');
const { get, all, run, tx, parseJSON } = require('./db');
const { erro } = require('./http');
const { sincronizarFonte, sincronizarTudo, norm, ADAPTADORES } = require('./sincronizar');
const pesquisa = require('./pesquisa');
const { RECURSOS } = require('./recursos');

const str = (v, max = 300) => (v == null ? '' : String(v)).trim().slice(0, max);
const num = v => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const { localizar, municipios } = require('./geo');
// "Dentro de Angola" = dentro do mapa oficial de municípios (shapefile Angola_Level2)
const dentroDeAngola = (lat, lon) => !!localizar(lat, lon);
function distanciaKm(a, b, c, d) { // fórmula de Haversine
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(c - a), dLon = rad(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const linksNavegacao = (lat, lon, nome) => lat == null ? null : {
  google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
  waze: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`,
  osm: `https://www.openstreetmap.org/directions?to=${lat},${lon}`,
  apple: `https://maps.apple.com/?daddr=${lat},${lon}&q=${encodeURIComponent(nome || '')}`,
};
const TIPOS_GEO = { destino: 'destinos', experiencia: 'experiencias', alojamento: 'alojamentos', evento: 'eventos', restaurante: 'restaurantes' };

// Pesquisa de lugares no OpenStreetMap (Nominatim), com cache e limite de 1 pedido por segundo (política de utilização)
const cacheGeo = new Map(); let ultimoNominatim = 0;
async function nominatim(q) {
  const chave = norm(q); const c = cacheGeo.get(chave);
  if (c && Date.now() - c.t < 24 * 36e5) return c.r;
  const espera = 1100 - (Date.now() - ultimoNominatim); if (espera > 0) await new Promise(r => setTimeout(r, espera));
  ultimoNominatim = Date.now();
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', limit: '6', countrycodes: 'ao', 'accept-language': 'pt' });
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Angola365/3.4 (+https://turismo-digital-360.vercel.app; projectos@sigafangola.ao)' }, signal: ctl.signal });
    if (!r.ok) throw new Error('O serviço de mapas respondeu ' + r.status);
    const L = (await r.json()).map(x => ({ nome: x.name || x.display_name.split(',')[0], endereco: x.display_name, lat: Number(x.lat), lon: Number(x.lon), tipo: x.category + '/' + x.type,
      estado: ['house', 'building', 'amenity', 'tourism', 'leisure', 'shop', 'historic'].includes(x.category) ? 'verificada' : 'aproximada', fonte: `https://www.openstreetmap.org/${x.osm_type}/${x.osm_id}` }));
    cacheGeo.set(chave, { t: Date.now(), r: L }); if (cacheGeo.size > 500) cacheGeo.delete(cacheGeo.keys().next().value);
    return L;
  } finally { clearTimeout(tm); }
}

const cacheMapa = new Map();
function mapa(lat, lon) { const k = lat + ',' + lon; if (!cacheMapa.has(k)) { const l = localizar(lat, lon); cacheMapa.set(k, { municipio_mapa: l?.municipio || null, provincia_mapa: l?.provincia || null }); } return cacheMapa.get(k); }
// Itens do catálogo com coordenadas, em formato comum
async function itensGeo(lang, listarPublico, tipos = Object.keys(TIPOS_GEO)) {
  const out = [];
  for (const tipo of tipos) {
    const tabela = TIPOS_GEO[tipo]; if (!tabela) continue;
    for (const i of await listarPublico(tabela, lang)) {
      if (i.latitude == null || i.longitude == null) continue;
      out.push({ tipo, id: i.id, nome: i.nome || i.titulo, imagem: i.imagem, categoria: i.categoria || i.tipo || i.especialidade || null, provincia: i.provincia || null, municipio: i.municipio, bairro: i.bairro,
        endereco: i.endereco, lat: i.latitude, lon: i.longitude, ...mapa(i.latitude, i.longitude), coord_estado: i.coord_estado, coord_fonte: i.coord_fonte, data: i.data || null, parceiro: i.parceiro });
    }
  }
  return out;
}

async function jogosFiltrados(q) {
  const cond = ['j.ativo = 1'], p = [];
  if (q.desde) { cond.push('j.data_hora >= ?'); p.push(q.desde); }
  if (q.ate) { cond.push('j.data_hora <= ?'); p.push(q.ate + (q.ate.length === 10 ? ' 23:59' : '')); }
  if (q.competicao) { cond.push('j.competicao ILIKE ?'); p.push('%' + q.competicao + '%'); }
  if (q.clube) { cond.push('(j.casa ILIKE ? OR j.fora ILIKE ?)'); p.push('%' + q.clube + '%', '%' + q.clube + '%'); }
  if (q.estadio) { cond.push('(j.estadio ILIKE ? OR e.nome ILIKE ?)'); p.push('%' + q.estadio + '%', '%' + q.estadio + '%'); }
  if (q.provincia) { cond.push('e.provincia ILIKE ?'); p.push('%' + q.provincia + '%'); }
  if (q.estado) { cond.push('j.estado = ?'); p.push(q.estado); }
  const ordem = q.ordem === 'desc' ? 'DESC' : 'ASC';
  const L = await all(`SELECT j.*, e.nome AS estadio_nome, e.cidade AS estadio_cidade, e.provincia AS estadio_provincia, e.latitude, e.longitude, e.coord_estado, e.coord_fonte
    FROM jogos j LEFT JOIN estadios e ON e.id = j.estadio_id WHERE ${cond.join(' AND ')} ORDER BY j.data_hora ${ordem}, j.id LIMIT ${Math.min(200, Number(q.limite) || 100)}`, ...p);
  // a mesma partida pode chegar de duas fontes ou repetida: mostra-se uma vez
  const vistos = new Set();
  return L.filter(j => { const k = j.data_hora.slice(0, 10) + '|' + norm(j.casa) + '|' + norm(j.fora); if (vistos.has(k)) return false; vistos.add(k); return true; })
    .map(j => ({ ...j, navegacao: linksNavegacao(j.latitude, j.longitude, j.estadio_nome) }));
}

// Plano de roteiro com dados reais do catálogo: agrupa por proximidade e evita dias impossíveis
async function planearRoteiro({ cidade, dias = 1, interesses = [], orcamento = null, pessoas = 1 }, lang, listarPublico) {
  dias = Math.max(1, Math.min(7, Number(dias) || 1));
  const base = (await itensGeo(lang, listarPublico, ['destino', 'experiencia', 'restaurante'])).filter(i => !cidade || norm([i.provincia, i.municipio, i.endereco, i.nome].join(' ')).includes(norm(cidade)));
  const xps = await listarPublico('experiencias', lang);
  const precoDe = it => it.tipo === 'experiencia' ? (xps.find(x => x.id === it.id)?.preco ?? null) : null;
  const gosta = it => !interesses.length || interesses.some(t => norm([it.categoria, it.nome].join(' ')).includes(norm(t)));
  let visitas = base.filter(i => i.tipo !== 'restaurante').sort((a, b) => gosta(b) - gosta(a));
  if (orcamento) visitas = visitas.filter(i => { const pr = precoDe(i); return pr == null || pr * pessoas <= orcamento; });
  const restaurantes = base.filter(i => i.tipo === 'restaurante');
  const plano = [], usados = new Set(); let custo = 0;
  for (let d = 1; d <= dias; d++) {
    const manha = visitas.find(v => !usados.has(v.tipo + v.id)); if (!manha) break; usados.add(manha.tipo + manha.id);
    // à tarde, o lugar mais próximo do da manhã (no máximo 60 km, para o dia ser exequível)
    const tarde = visitas.filter(v => !usados.has(v.tipo + v.id)).map(v => ({ v, km: distanciaKm(manha.lat, manha.lon, v.lat, v.lon) })).filter(x => x.km <= 60).sort((a, b) => a.km - b.km)[0];
    if (tarde) usados.add(tarde.v.tipo + tarde.v.id);
    const ref = tarde?.v || manha;
    const jantar = restaurantes.filter(r => !usados.has('r' + r.id)).map(r => ({ r, km: distanciaKm(ref.lat, ref.lon, r.lat, r.lon) })).sort((a, b) => a.km - b.km)[0];
    if (jantar) usados.add('r' + jantar.r.id);
    const passo = (periodo, it, km) => { const pr = precoDe(it); if (pr) custo += pr * pessoas; return { dia: d, periodo, tipo: it.tipo, item_id: it.id, nome: it.nome, lat: it.lat, lon: it.lon, km_anterior: km == null ? null : Math.round(km * 10) / 10, preco: pr, preco_tipo: pr ? 'publicado' : null }; };
    plano.push(passo('Manhã', manha, null));
    if (tarde) plano.push(passo('Tarde', tarde.v, tarde.km));
    if (jantar) plano.push(passo('Noite', jantar.r, jantar.km));
  }
  return { itens: plano, custo_publicado: custo, aviso: plano.length ? null : 'Não encontrei lugares com localização confirmada para estes critérios.', nota: 'Distâncias em linha recta entre pontos; o tempo de viagem real depende da estrada e do trânsito. Horários de funcionamento: confirme antes da visita.' };
}

Object.assign(ADAPTADORES, pesquisa.adaptadores({ nominatim }));

function registar({ api, auth, admin, corpo, auditar, limitarTentativas, listarPublico, lingua, hoje }) {
  const lang = req => lingua(req.query.get('lang'));

  // ---------- geolocalização ----------
  api.get('/api/geo/pesquisa', async req => {
    const q = str(req.query.get('q'), 120); if (q.length < 2) erro(400, 'Escreva pelo menos 2 letras.');
    const L = lang(req);
    const doCatalogo = (await itensGeo(L, listarPublico)).filter(i => norm([i.nome, i.endereco, i.municipio, i.bairro, i.provincia].join(' ')).includes(norm(q))).slice(0, 8)
      .map(i => ({ ...i, origem: 'catalogo' }));
    let lugares = [], aviso = null;
    try { lugares = (await nominatim(q)).map(l => ({ ...l, origem: 'osm' })); } catch (e) { aviso = 'A pesquisa de moradas está indisponível de momento; mostro só os lugares da plataforma.'; }
    return { catalogo: doCatalogo, lugares, aviso, atribuicao: '© contribuidores do OpenStreetMap (ODbL)' };
  });
  api.get('/api/geo/perto', async req => {
    const lat = num(req.query.get('lat')), lon = num(req.query.get('lon'));
    if (lat == null || lon == null) erro(400, 'Indique a localização (lat e lon).');
    const raio = Math.min(500, Math.max(1, num(req.query.get('raio')) || 25));
    const tipos = (req.query.get('tipos') || '').split(',').filter(t => TIPOS_GEO[t]);
    const L = (await itensGeo(lang(req), listarPublico, tipos.length ? tipos : undefined)).map(i => ({ ...i, distancia_km: Math.round(distanciaKm(lat, lon, i.lat, i.lon) * 10) / 10, navegacao: linksNavegacao(i.lat, i.lon, i.nome) }))
      .filter(i => i.distancia_km <= raio).sort((a, b) => a.distancia_km - b.distancia_km);
    return { fora_de_angola: !dentroDeAngola(lat, lon), raio_km: raio, itens: L.slice(0, 60) };
  });
  api.get('/api/geo/localizar', async req => {
    const lat = num(req.query.get('lat')), lon = num(req.query.get('lon')); if (lat == null || lon == null) erro(400, 'Indique a localização (lat e lon).');
    return { local: localizar(lat, lon), fonte: 'Mapa oficial de municípios (Angola_Level2)' };
  });
  api.get('/api/geo/municipios', async () => municipios());
  api.get('/api/geo/mapa', async req => ({ itens: (await itensGeo(lang(req), listarPublico)).map(i => ({ ...i, navegacao: linksNavegacao(i.lat, i.lon, i.nome) })),
    estadios: (await all('SELECT * FROM estadios WHERE ativo = 1 AND latitude IS NOT NULL')).map(e => ({ ...e, navegacao: linksNavegacao(e.latitude, e.longitude, e.nome) })) }));

  // ---------- futebol ----------
  api.get('/api/jogos', async req => {
    const q = Object.fromEntries(req.query); if (!q.desde && !q.ate && !q.estado) q.desde = hoje();
    return { jogos: await jogosFiltrados(q), fontes: await all(`SELECT id, nome, url, oficial, ultima_sync, ultimo_estado FROM fontes WHERE tipo = 'futebol' ORDER BY oficial DESC, nome`) };
  });
  api.get('/api/estadios', async () => (await all('SELECT * FROM estadios WHERE ativo = 1 ORDER BY nome')).map(e => ({ ...e, aliases: parseJSON(e.aliases, []), navegacao: linksNavegacao(e.latitude, e.longitude, e.nome) })));

  // ---------- roteiros ----------
  api.post('/api/roteiros/planear', corpo, async req => {
    await auth(req); const b = req.dados || {};
    return planearRoteiro({ cidade: str(b.cidade, 60), dias: b.dias, interesses: Array.isArray(b.interesses) ? b.interesses.map(x => str(x, 40)).slice(0, 8) : [], orcamento: num(b.orcamento) == null ? null : Math.round(num(b.orcamento)), pessoas: Math.max(1, Math.min(50, num(b.pessoas) || 1)) }, lingua(b.lang), listarPublico);
  });
  const validarRoteiro = b => {
    const itens = Array.isArray(b.itens) ? b.itens.slice(0, 60).map(i => ({ dia: Math.max(1, Math.min(14, Number(i.dia) || 1)), periodo: str(i.periodo, 20), tipo: str(i.tipo, 20), item_id: num(i.item_id), nome: str(i.nome, 160), nota: str(i.nota, 300), lat: num(i.lat), lon: num(i.lon), preco: num(i.preco) })) : [];
    const titulo = str(b.titulo, 120); if (!titulo) erro(400, 'Dê um nome ao roteiro.');
    return { titulo, cidade: str(b.cidade, 60) || null, data_inicio: /^\d{4}-\d{2}-\d{2}$/.test(b.data_inicio || '') ? b.data_inicio : null, dias: Math.max(1, Math.min(14, num(b.dias) || 1)), orcamento: num(b.orcamento), pessoas: Math.max(1, Math.min(50, num(b.pessoas) || 1)),
      interesses: JSON.stringify(Array.isArray(b.interesses) ? b.interesses.slice(0, 8).map(x => str(x, 40)) : []), transporte: str(b.transporte, 40) || null, acessibilidade: str(b.acessibilidade, 200) || null, itens: JSON.stringify(itens) };
  };
  const saidaRoteiro = r => r && ({ ...r, itens: parseJSON(r.itens, []), interesses: parseJSON(r.interesses, []) });
  api.get('/api/roteiros', async req => { await auth(req); return (await all('SELECT * FROM roteiros WHERE utilizador_id = ? ORDER BY atualizado_em DESC', req.user.id)).map(saidaRoteiro); });
  api.post('/api/roteiros', corpo, async req => {
    await auth(req); if ((await get('SELECT COUNT(*)::int AS n FROM roteiros WHERE utilizador_id = ?', req.user.id)).n >= 50) erro(400, 'Atingiu o máximo de 50 roteiros guardados.');
    const v = validarRoteiro(req.dados || {}); const ks = Object.keys(v);
    return saidaRoteiro(await get(`INSERT INTO roteiros (utilizador_id, ${ks.join(',')}) VALUES (?,${ks.map(() => '?').join(',')}) RETURNING *`, req.user.id, ...ks.map(k => v[k])));
  });
  api.put('/api/roteiros/:id', corpo, async req => {
    await auth(req); const v = validarRoteiro(req.dados || {}); const ks = Object.keys(v);
    const r = await get(`UPDATE roteiros SET ${ks.map(k => k + ' = ?').join(', ')}, atualizado_em = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') WHERE id = ? AND utilizador_id = ? RETURNING *`, ...ks.map(k => v[k]), Number(req.params.id), req.user.id);
    if (!r) erro(404, 'Roteiro não encontrado.'); return saidaRoteiro(r);
  });
  api.delete('/api/roteiros/:id', async req => { await auth(req); await run('DELETE FROM roteiros WHERE id = ? AND utilizador_id = ?', Number(req.params.id), req.user.id); });

  // ---------- ENDA AI ----------
  require('./enda').registar({ api, auth, corpo, limitarTentativas, listarPublico, lingua, hoje, ferramentas: { itensGeo, distanciaKm, linksNavegacao, jogosFiltrados, planearRoteiro, nominatim } });

  // ---------- sincronização (tarefa diária e painel) ----------
  api.get('/api/cron/sincronizar', async req => {
    if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) erro(401, 'Não autorizado.');
    // limpeza: contexto da ENDA com mais de 24 h e códigos de entrada expirados
    await run(`DELETE FROM enda_sessoes WHERE atualizado_em < to_char((now() AT TIME ZONE 'UTC') - interval '24 hours', 'YYYY-MM-DD HH24:MI:SS')`);
    return sincronizarTudo({ get, all, run }, tx, 'cron', { ia: false, ate: Date.now() + 40e3 });
  });
  // Pesquisa diária com IA em sites públicos (eventos, actividades, notícias e rumores)
  api.get('/api/cron/pesquisa', async req => {
    if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) erro(401, 'Não autorizado.');
    pesquisa.definirCredencial(req.headers['x-vercel-oidc-token']);
    return sincronizarTudo({ get, all, run }, tx, 'cron', { ia: true, ate: Date.now() + 200e3 });
  });
  // Importação semanal de lugares públicos do OpenStreetMap (praias, alojamentos, restaurantes, monumentos…)
  api.get('/api/cron/lugares', async req => {
    if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) erro(401, 'Não autorizado.');
    return sincronizarTudo({ get, all, run }, tx, 'cron', { lugares: true });
  });
  api.post('/api/admin/fontes/:id/sincronizar', async req => {
    await admin(req); pesquisa.definirCredencial(req.headers['x-vercel-oidc-token']); const r = await sincronizarFonte({ get, all, run }, tx, Number(req.params.id), 'admin');
    await auditar(req, 'sincronizar', 'fontes', Number(req.params.id), `${r.estado}: ${r.novos} novos, ${r.alterados} alterados${r.erro ? ' · ' + r.erro : ''}`);
    return r;
  });
  api.get('/api/admin/sincronizacoes', async req => { await admin(req); return all('SELECT s.*, f.nome AS fonte_nome FROM sincronizacoes s LEFT JOIN fontes f ON f.id = s.fonte_id ORDER BY s.inicio DESC, s.id DESC LIMIT 200'); });
  api.get('/api/admin/historico', async req => {
    await admin(req); const t = str(req.query.get('tabela'), 30), id = num(req.query.get('id'));
    return t && id ? all('SELECT * FROM historico_alteracoes WHERE tabela = ? AND registo_id = ? ORDER BY criado_em DESC, id DESC LIMIT 200', t, id) : all('SELECT * FROM historico_alteracoes ORDER BY criado_em DESC, id DESC LIMIT 300');
  });
  api.get('/api/admin/auditoria', async req => { await admin(req); return all('SELECT * FROM auditoria ORDER BY criado_em DESC, id DESC LIMIT 300'); });
  api.get('/api/admin/enda', async req => { await admin(req); return all(`SELECT r.*, u.email FROM enda_registos r LEFT JOIN utilizadores u ON u.id = r.utilizador_id ORDER BY r.criado_em DESC, r.id DESC LIMIT 300`); });
  api.post('/api/admin/enda/:id/revisto', async req => { await admin(req); await run('UPDATE enda_registos SET revisto = 1 WHERE id = ?', Number(req.params.id)); });

  // Verificação da qualidade dos dados: o que falta confirmar
  api.get('/api/admin/qualidade', async req => {
    await admin(req); const H = hoje(); const p = [];
    for (const [tabela, campo] of [['destinos', 'nome'], ['experiencias', 'titulo'], ['alojamentos', 'nome'], ['restaurantes', 'nome'], ['eventos', 'titulo']]) {
      for (const i of await all(`SELECT t.id, t.${campo} AS nome, t.latitude, t.longitude, t.endereco, t.coord_estado, t.municipio, p.nome AS provincia FROM ${tabela} t LEFT JOIN provincias p ON p.id = t.provincia_id WHERE t.ativo = 1`)) {
        if (i.latitude == null) p.push({ tabela, id: i.id, nome: i.nome, problema: 'Sem coordenadas confirmadas', gravidade: 'média' });
        else {
          const l = localizar(i.latitude, i.longitude);
          if (!l) p.push({ tabela, id: i.id, nome: i.nome, problema: 'Coordenadas fora do mapa oficial de municípios', gravidade: 'alta' });
          else {
            if (i.provincia && l.provincia !== i.provincia) p.push({ tabela, id: i.id, nome: i.nome, problema: `Província registada (${i.provincia}) diferente da do mapa (${l.provincia}, município ${l.municipio})`, gravidade: 'alta' });
            if (i.municipio && norm(i.municipio) !== norm(l.municipio)) p.push({ tabela, id: i.id, nome: i.nome, problema: `Município registado (${i.municipio}) diferente do mapa (${l.municipio})`, gravidade: 'média' });
            if (i.coord_estado === 'aproximada') p.push({ tabela, id: i.id, nome: i.nome, problema: 'Coordenadas aproximadas (confirmar no local)', gravidade: 'baixa' });
          }
        }
        if (!i.endereco) p.push({ tabela, id: i.id, nome: i.nome, problema: 'Endereço em falta', gravidade: 'baixa' });
      }
    }
    for (const e of await all(`SELECT id, titulo, data, confianca, fonte_url, bilhetes_url, estado FROM eventos WHERE ativo = 1 AND estado <> 'passado'`)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data)) p.push({ tabela: 'eventos', id: e.id, nome: e.titulo, problema: 'Data inválida', gravidade: 'alta' });
      if (!e.fonte_url) p.push({ tabela: 'eventos', id: e.id, nome: e.titulo, problema: 'Sem fonte identificada', gravidade: 'alta' });
      if (e.confianca === 'por confirmar') p.push({ tabela: 'eventos', id: e.id, nome: e.titulo, problema: 'Evento por confirmar', gravidade: 'média' });
      if (e.confianca === 'rumor') p.push({ tabela: 'eventos', id: e.id, nome: e.titulo, problema: 'Rumor publicado (marcado como não confirmado) — rever', gravidade: 'baixa' });
      if (e.data < H) p.push({ tabela: 'eventos', id: e.id, nome: e.titulo, problema: 'Data passada ainda publicada', gravidade: 'média' });
    }
    const dups = await all(`SELECT lower(titulo) AS t, data, COUNT(*)::int AS n FROM eventos WHERE ativo = 1 GROUP BY 1, 2 HAVING COUNT(*) > 1`);
    for (const d of dups) p.push({ tabela: 'eventos', id: null, nome: d.t, problema: `Evento duplicado (${d.n}× a ${d.data})`, gravidade: 'alta' });
    for (const j of await all(`SELECT id, casa, fora, estadio, estadio_id, confianca FROM jogos WHERE ativo = 1 AND data_hora >= ?`, H)) {
      if (j.estadio && !j.estadio_id) p.push({ tabela: 'jogos', id: j.id, nome: `${j.casa} x ${j.fora}`, problema: `Estádio «${j.estadio}» sem correspondência`, gravidade: 'baixa' });
      if (j.confianca === 'por confirmar') p.push({ tabela: 'jogos', id: j.id, nome: `${j.casa} x ${j.fora}`, problema: 'Data/hora por confirmar', gravidade: 'média' });
    }
    for (const e of await all('SELECT id, nome FROM estadios WHERE ativo = 1 AND latitude IS NULL')) p.push({ tabela: 'estadios', id: e.id, nome: e.nome, problema: 'Estádio sem coordenadas', gravidade: 'média' });
    for (const f of await all(`SELECT id, nome, ultimo_erro, falhas_seguidas FROM fontes WHERE ativo = 1 AND ultimo_estado = 'erro'`)) p.push({ tabela: 'fontes', id: f.id, nome: f.nome, problema: `Fonte com erro (${f.falhas_seguidas}×): ${f.ultimo_erro}`, gravidade: 'alta' });
    const ordem = { alta: 0, 'média': 1, baixa: 2 };
    return p.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);
  });
}

module.exports = { registar, localizar, distanciaKm, linksNavegacao, dentroDeAngola, planearRoteiro };
