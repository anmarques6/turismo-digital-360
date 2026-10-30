// Importação de lugares turísticos já publicados no OpenStreetMap (dados abertos, licença ODbL):
// praias, quedas de água, parques, miradouros, museus e monumentos → destinos;
// hotéis, resorts, residenciais, pousadas, lodges e apartamentos → alojamentos; restaurantes → restaurantes.
// Cada lugar tem de ficar dentro do mapa oficial de municípios (Angola_Level2); município e província vêm do mapa.
// Lugares que já existem na plataforma não são duplicados: recebem só a localização confirmada que lhes faltava.
const { localizar } = require('./geo');

const UA = 'Angola365/3.5 (+https://turismo-digital-360.vercel.app; projectos@sigafangola.ao)';
const ESPELHOS = (process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : []).concat([
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]);
// Consultas separadas por tipo de lugar: os servidores públicos recusam uma consulta única tão grande
const AREA = '[out:json][timeout:120];area["ISO3166-1"="AO"][admin_level=2]->.a;';
const CONSULTAS = {
  praias: 'nwr["natural"="beach"]["name"](area.a);',
  natureza_cultura: '(nwr["natural"="waterfall"]["name"](area.a);nwr["boundary"="national_park"]["name"](area.a);nwr["tourism"~"^(museum|viewpoint|zoo|theme_park)$"]["name"](area.a);nwr["historic"~"^(fort|castle|monument|archaeological_site)$"]["name"](area.a););',
  alojamentos: '(nwr["tourism"~"^(hotel|motel|guest_house|hostel|apartment|chalet)$"]["name"](area.a);nwr["leisure"="resort"]["name"](area.a););',
  restaurantes: 'nwr["amenity"="restaurant"]["name"](area.a);',
};
const CONSULTA = Object.values(CONSULTAS).map(q => AREA + q + 'out center tags;')[0];

const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`".,]/g, '').replace(/\s+/g, ' ').trim();
const GENERICOS = new Set(['praia', 'restaurante', 'hotel', 'pensao', 'residencial', 'bar', 'snack bar', 'restaurant', 'beach', 'guest house', 'hospedaria', 'cascata', 'museu', 'miradouro', 'lodge', 'pousada']);
function distKm(a, b, c, d) { const R = 6371, r = x => x * Math.PI / 180; const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

const COZINHA = { regional: 'Cozinha angolana', angolan: 'Cozinha angolana', african: 'Cozinha africana', portuguese: 'Cozinha portuguesa', brazilian: 'Cozinha brasileira', italian: 'Italiana', pizza: 'Pizzaria', chinese: 'Chinesa', japanese: 'Japonesa', sushi: 'Sushi', indian: 'Indiana', lebanese: 'Libanesa', turkish: 'Turca', french: 'Francesa', seafood: 'Marisqueira', fish: 'Peixe', barbecue: 'Grelhados', steak_house: 'Carnes', grill: 'Grelhados', burger: 'Hambúrgueres', international: 'Internacional', coffee_shop: 'Café', asian: 'Asiática', thai: 'Tailandesa', mexican: 'Mexicana', korean: 'Coreana', vegetarian: 'Vegetariana', chicken: 'Frango', mediterranean: 'Mediterrânica', spanish: 'Espanhola', greek: 'Grega', ethiopian: 'Etíope', cuban: 'Cubana', sandwich: 'Sandes', breakfast: 'Pequenos-almoços' };
// Imagens de bancos de imagens livres já usadas no site; ficam marcadas como ilustrativas
const IMG = { Praias: '/img/ev_festa.jpg', Natureza: '/img/g3.jpg', Cultura: '/img/cidadealta.jpg', Aventura: '/img/tigres.jpg', 'Hotéis': '/img/h_epic.jpg', Resorts: '/img/h_resort.jpg', Residenciais: '/img/h_cazenga.jpg', Hospedarias: '/img/h_cazenga.jpg', Pousadas: '/img/h_cazenga.jpg', Lodges: '/img/h_villa.jpg', Apartamentos: '/img/h_apt.jpg', Villas: '/img/h_villa.jpg' };
const IMG_REST = ['/img/r_mar.jpg', '/img/r_sabor.jpg', '/img/r_tasca.jpg'];

// Classifica um elemento do OpenStreetMap numa tabela e categoria da plataforma
function classificar(t) {
  const nome = t.name || '';
  if (t.natural === 'beach') return { tabela: 'destinos', categoria: 'Praias', o: 'Praia' };
  if (t.natural === 'waterfall') return { tabela: 'destinos', categoria: 'Natureza', o: 'Queda de água' };
  if (t.boundary === 'national_park') return { tabela: 'destinos', categoria: 'Natureza', o: 'Parque nacional' };
  if (t.tourism === 'viewpoint') return { tabela: 'destinos', categoria: 'Natureza', o: 'Miradouro' };
  if (t.tourism === 'zoo') return { tabela: 'destinos', categoria: 'Natureza', o: 'Jardim zoológico' };
  if (t.tourism === 'theme_park') return { tabela: 'destinos', categoria: 'Aventura', o: 'Parque temático' };
  if (t.tourism === 'museum') return { tabela: 'destinos', categoria: 'Cultura', o: 'Museu' };
  if (['fort', 'castle'].includes(t.historic)) return { tabela: 'destinos', categoria: 'Cultura', o: 'Fortaleza histórica' };
  if (t.historic === 'monument') return { tabela: 'destinos', categoria: 'Cultura', o: 'Monumento' };
  if (t.historic === 'archaeological_site') return { tabela: 'destinos', categoria: 'Cultura', o: 'Sítio arqueológico' };
  if (t.amenity === 'restaurant') return { tabela: 'restaurantes', o: 'Restaurante' };
  if (t.leisure === 'resort' || /\bresort\b/i.test(nome)) return { tabela: 'alojamentos', tipo: 'Resorts' };
  if (/residencial/i.test(nome)) return { tabela: 'alojamentos', tipo: 'Residenciais' };
  if (/pousada/i.test(nome)) return { tabela: 'alojamentos', tipo: 'Pousadas' };
  if (/\blodge\b/i.test(nome)) return { tabela: 'alojamentos', tipo: 'Lodges' };
  if (t.tourism === 'hotel' || t.tourism === 'motel') return { tabela: 'alojamentos', tipo: 'Hotéis' };
  if (t.tourism === 'guest_house') return { tabela: 'alojamentos', tipo: /hospedaria|pens[aã]o/i.test(nome) ? 'Hospedarias' : 'Residenciais' };
  if (t.tourism === 'hostel') return { tabela: 'alojamentos', tipo: 'Hospedarias' };
  if (t.tourism === 'apartment') return { tabela: 'alojamentos', tipo: 'Apartamentos' };
  if (t.tourism === 'chalet') return { tabela: 'alojamentos', tipo: 'Villas' };
  return null;
}
const urlSegura = u => { if (!u) return null; let s = String(u).trim().split(/[;\s]/)[0]; if (!/^https?:\/\//i.test(s)) s = 'https://' + s; try { const x = new URL(s); return /^https?:$/.test(x.protocol) && x.hostname.includes('.') ? x.href.slice(0, 300) : null; } catch { return null; } };
const telefone = t => (t.phone || t['contact:phone'] || t['contact:mobile'] || '').split(';')[0].trim().slice(0, 40) || null;
const endereco = t => [[t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '), t['addr:suburb'] || t['addr:neighbourhood']].filter(Boolean).join(', ').slice(0, 200) || null;

// Lê o OpenStreetMap (tenta vários servidores públicos) e devolve os lugares já classificados e localizados no mapa oficial
async function pedirOverpass(consulta, espelhos, fetchFn, ms) {
  let ultimoErro = null;
  for (const url of espelhos) {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetchFn(url, { method: 'POST', headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(consulta), signal: ctl.signal });
      const txt = await r.text();
      if (!r.ok) throw new Error(`${new URL(url).host} respondeu ${r.status}`);
      const dados = JSON.parse(txt); if (!Array.isArray(dados.elements)) throw new Error('resposta sem elementos');
      if (dados.remark && /runtime error|timeout|out of memory/i.test(dados.remark)) throw new Error(`${new URL(url).host}: ${dados.remark.slice(0, 120)}`);
      return dados.elements;
    } catch (e) { ultimoErro = e.name === 'AbortError' ? new Error(`${new URL(url).host} não respondeu a tempo`) : e; }
    finally { clearTimeout(tm); }
  }
  throw ultimoErro || new Error('sem resposta');
}
// Lê o OpenStreetMap por partes (tenta vários servidores públicos) e devolve os lugares classificados e localizados no mapa oficial
async function lerOSM({ consultas = CONSULTAS, espelhos = ESPELHOS, fetchFn = fetch, ms = 150000 } = {}) {
  const elementos = [], falhas = [];
  // OSM_FICHEIRO: elementos já extraídos (ex.: do ficheiro completo de Angola da Geofabrik, scripts/extrair-osm.py)
  if (process.env.OSM_FICHEIRO) elementos.push(...JSON.parse(require('node:fs').readFileSync(process.env.OSM_FICHEIRO, 'utf8')).elements);
  else for (const [nome, q] of Object.entries(consultas)) {
    try { elementos.push(...await pedirOverpass(AREA + q + 'out center tags;', espelhos, fetchFn, ms)); }
    catch (e) { falhas.push(`${nome}: ${e.message}`); }
  }
  if (!elementos.length) throw new Error('OpenStreetMap indisponível: ' + falhas.join(' | '));
  const dados = { elements: elementos };
  const out = [], vistos = new Set();
  for (const el of dados.elements) {
    const t = el.tags || {}; const nome = String(t['name:pt'] || t.name || '').trim().replace(/\s+/g, ' ');
    if (nome.length < 3 || GENERICOS.has(norm(nome))) continue;
    const c = classificar({ ...t, name: nome }); if (!c) continue;
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon; if (lat == null || lon == null) continue;
    const loc = localizar(lat, lon); if (!loc) continue; // fora do mapa oficial
    const osm_id = `${el.type}/${el.id}`; if (vistos.has(osm_id)) continue; vistos.add(osm_id);
    out.push({ ...c, osm_id, nome: nome.slice(0, 160), lat: Math.round(lat * 1e7) / 1e7, lon: Math.round(lon * 1e7) / 1e7, municipio: loc.municipio, provincia: loc.provincia, coord_estado: loc.exacto ? 'verificada' : 'aproximada',
      fonte: `https://www.openstreetmap.org/${osm_id}`, site: urlSegura(t.website || t['contact:website'] || t.url), telefone: telefone(t), endereco: endereco(t), horario: (t.opening_hours || '').slice(0, 200) || null,
      descricao_osm: (t['description:pt'] || t.description || '').slice(0, 400) || null, cozinha: (t.cuisine || '').split(/[;,]/).map(x => COZINHA[x.trim()] || null).filter(Boolean).slice(0, 2).join(' · ') || null,
      estrelas: /^[1-5]$/.test(t.stars || '') ? Number(t.stars) : null, quartos: /^\d{1,4}$/.test(t.rooms || '') ? Number(t.rooms) : null });
  }
  out.falhas = falhas;
  return out;
}

function descricao(l) {
  const onde = `${l.municipio}, província de ${l.provincia}`;
  const base = l.tabela === 'destinos' ? `${l.o} em ${onde}.` : `Restaurante em ${onde}${l.cozinha ? ` · ${l.cozinha}` : ''}.`;
  return [base, l.descricao_osm, 'Informação pública do OpenStreetMap; confirme horários e preços directamente com o estabelecimento.'].filter(Boolean).join(' ');
}

// Grava um lugar (dentro de uma transacção). c = contadores {novos, alterados, duplicados}
async function gravarLugar(d, l, ctx, c) {
  const { prov, existentes, hoje } = ctx; const T = l.tabela; const campoNome = 'nome';
  const ja = existentes[T].porOsm.get(l.osm_id);
  if (ja) { // já importado: actualiza só o que vem do OpenStreetMap e estava vazio
    await d.run(`UPDATE ${T} SET latitude = COALESCE(latitude, ?), longitude = COALESCE(longitude, ?), verificado_em = ? WHERE id = ?`, l.lat, l.lon, hoje, ja.id);
    c.duplicados++; return;
  }
  // o mesmo lugar já existe (nome igual ou contido, na mesma zona ou ainda sem localização)? Não duplica: dá-lhe a localização
  const n = norm(l.nome);
  const igual = existentes[T].lista.find(x => { const m = norm(x[campoNome]); const nomeOk = m === n || (Math.min(m.length, n.length) >= 6 && (m.includes(n) || n.includes(m))); if (!nomeOk) return false;
    return x.latitude == null ? (!x.provincia_id || x.provincia_id === prov[l.provincia]) : distKm(x.latitude, x.longitude, l.lat, l.lon) < 1.5; });
  if (igual) {
    if (igual.latitude == null) {
      await d.run(`UPDATE ${T} SET latitude = ?, longitude = ?, coord_estado = ?, coord_fonte = ?, municipio = ?, provincia_id = COALESCE(?, provincia_id), endereco = COALESCE(endereco, ?), osm_id = COALESCE(osm_id, ?), verificado_em = ? WHERE id = ?`,
        l.lat, l.lon, l.coord_estado, l.fonte, l.municipio, prov[l.provincia] ?? null, l.endereco, l.osm_id, hoje, igual.id);
      igual.latitude = l.lat; igual.longitude = l.lon; c.alterados++;
    } else { if (!igual.osm_id) await d.run(`UPDATE ${T} SET osm_id = ? WHERE id = ? AND osm_id IS NULL`, l.osm_id, igual.id); c.duplicados++; }
    existentes[T].porOsm.set(l.osm_id, igual); return;
  }
  const comum = { nome: l.nome, provincia_id: prov[l.provincia] ?? null, latitude: l.lat, longitude: l.lon, coord_estado: l.coord_estado, coord_fonte: l.fonte, municipio: l.municipio, endereco: l.endereco, horario: l.horario,
    verificado_em: hoje, fonte: l.fonte, osm_id: l.osm_id, imagem_ilustrativa: 1, descricao: descricao(l), rating: 0, num_avaliacoes: 0, ativo: 1 };
  let reg;
  if (T === 'destinos') reg = { ...comum, categoria: l.categoria, imagem: IMG[l.categoria], palavras_chave: [l.o, l.municipio, l.provincia].join(',').toLowerCase() };
  else if (T === 'alojamentos') { delete comum.descricao; reg = { ...comum, tipo: l.tipo, local: `${l.municipio}, ${l.provincia}`, imagem: IMG[l.tipo] || IMG['Hotéis'], parceiro: 0, site: l.site, telefone: l.telefone, preco_noite: null, quartos: l.quartos || 10, comodidades: '[]', etiqueta: l.estrelas ? `${l.estrelas}★` : null }; }
  else reg = { ...comum, local: `${l.municipio}, ${l.provincia}`, imagem: IMG_REST[existentes[T].lista.length % 3], parceiro: 0, site: l.site, telefone: l.telefone, preco_medio: null, nivel_preco: null, especialidade: l.cozinha };
  const ks = Object.keys(reg);
  const novo = await d.get(`INSERT INTO ${T} (${ks.join(',')}) VALUES (${ks.map(() => '?').join(',')}) ON CONFLICT (osm_id) WHERE osm_id IS NOT NULL DO NOTHING RETURNING id`, ...ks.map(k => reg[k]));
  if (!novo) { c.duplicados++; return; }
  const x = { id: novo.id, nome: l.nome, latitude: l.lat, longitude: l.lon, provincia_id: reg.provincia_id, osm_id: l.osm_id };
  existentes[T].lista.push(x); existentes[T].porOsm.set(l.osm_id, x); c.novos++;
}

async function contexto(d) {
  const prov = Object.fromEntries((await d.all('SELECT id, nome FROM provincias')).map(p => [p.nome, p.id]));
  const existentes = {};
  for (const T of ['destinos', 'alojamentos', 'restaurantes']) {
    const lista = await d.all(`SELECT id, nome, latitude, longitude, provincia_id, osm_id FROM ${T}`);
    existentes[T] = { lista, porOsm: new Map(lista.filter(x => x.osm_id).map(x => [x.osm_id, x])) };
  }
  const hoje = new Date(Date.now() + 36e5).toISOString().slice(0, 10);
  return { prov, existentes, hoje };
}

// Experiências: a localização é a do lugar onde acontecem (destino ou cidade de partida conhecida)
async function localizarExperiencias(d) {
  const L = await d.all('SELECT e.id, e.titulo, e.local, e.latitude FROM experiencias e WHERE e.latitude IS NULL');
  const D = await d.all('SELECT nome, latitude, longitude, coord_estado, coord_fonte, municipio, provincia_id, palavras_chave FROM destinos WHERE latitude IS NOT NULL AND ativo = 1');
  let n = 0;
  for (const x of L) {
    const t = norm(x.titulo + ' ' + x.local);
    const alvo = D.find(dd => (dd.palavras_chave || '').split(',').map(norm).concat(norm(dd.nome)).some(k => k.length >= 6 && t.includes(k)));
    if (!alvo) continue;
    await d.run(`UPDATE experiencias SET latitude = ?, longitude = ?, coord_estado = 'aproximada', coord_fonte = ?, municipio = ?, provincia_id = COALESCE(provincia_id, ?) WHERE id = ?`, alvo.latitude, alvo.longitude, alvo.coord_fonte, alvo.municipio, alvo.provincia_id, x.id);
    n++;
  }
  return n;
}

module.exports = { lerOSM, gravarLugar, contexto, classificar, localizarExperiencias, CONSULTAS, ESPELHOS };
