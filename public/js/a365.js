/* =========================================================
   ANGOLA 365º — mapa oficial de municípios, perto de mim, futebol, roteiros e pratos
   O mapa desenha os 326 municípios (21 províncias) do shapefile oficial Angola_Level2.
   Carregado depois de app.js: acrescenta rotas, vistas e acções.
   ========================================================= */
ROUTES.push('mapa', 'perto', 'futebol', 'roteiros');
NAV.splice(NAV.findIndex(n => n[0] === 'destinos'), 0, ['mapa', 'map', 'Mapa de Angola'], ['perto', 'compass', 'Perto de mim']);
NAV.splice(NAV.findIndex(n => n[0] === 'gastronomia') + 1, 0, ['futebol', 'run', 'Futebol'], ['roteiros', 'list', 'Roteiros']);

const M = { geo: null, pontos: null, estadios: [], filtro: new Set(['destino', 'experiencia', 'alojamento', 'restaurante', 'evento', 'estadio']), vb: null, sel: null, munSel: null, carregando: false };
S.pos = null; // { lat, lon, precisao, origem: 'gps'|'manual', nome, municipio, provincia }
try { const p = JSON.parse(sessionStorage.getItem('a365_pos')); if (p && p.lat) S.pos = p; } catch (e) {}
const guardarPos = () => { try { sessionStorage.setItem('a365_pos', JSON.stringify(S.pos)); } catch (e) {} };

/* ---------- auxiliares ---------- */
// Pedir táxi na Yango (formato oficial de ligação da Yango: abre a app; sem app abre a página de pedido da Yango)
const yangoURL = (lat, lon) => { const p = S.pos; const ini = p ? `start-lat=${p.lat}&start-lon=${p.lon}&` : ''; const fb = encodeURIComponent(`https://yango.com/en_int/order/?${p ? `gfrom=${p.lon},${p.lat}&` : ''}gto=${lon},${lat}&ref=angola365`); return `https://yango.go.link/route?${ini}end-lat=${lat}&end-lon=${lon}&ref=angola365&adj_t=vokme8e_nd9s9z9&lang=pt&adj_deeplink_js=1&adj_fallback=${fb}`; };
const navURL = (lat, lon) => ({ yango: yangoURL(lat, lon), google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`, waze: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`, osm: `https://www.openstreetmap.org/directions?to=${lat},${lon}` });
// Botões «Como chegar» e «Chamar táxi»: abrem uma escolha de aplicações
const dadosLugar = (lat, lon, nome, end, prov) => `data-lat="${lat}" data-lon="${lon}" data-nome="${esc(nome || '')}" data-end="${esc(end || '')}" data-prov="${esc(prov || '')}"`;
// Noutra província que não a da pessoa: autocarros interprovinciais e voos domésticos em vez de táxi
const outraProvincia = prov => !!(prov && S.pos?.provincia && NORMQ(prov) !== NORMQ(S.pos.provincia));
const botoesIr = (lat, lon, nome, end, prov) => `<button type="button" class="btn-ir" data-mapas ${dadosLugar(lat, lon, nome, end, prov)}>${ic('map')}Como chegar</button>${outraProvincia(prov)
  ? `<button type="button" class="btn-taxi btn-viagem" data-viagem ${dadosLugar(lat, lon, nome, end, prov)}>${ic('ticket')}Autocarro ou voo</button>`
  : `<button type="button" class="btn-taxi" data-taxi ${dadosLugar(lat, lon, nome, end, prov)}>${ic('car')}Chamar táxi</button>`}`;
function navLinks(it, compacto) {
  const lat = it.latitude ?? it.lat, lon = it.longitude ?? it.lon;
  if (lat == null || lon == null) return compacto ? '' : `<span class="meta coord-falta">${ic('pin')}Localização exacta por confirmar</span>`;
  const dist = S.pos ? distKm(S.pos.lat, S.pos.lon, lat, lon) : null; const nome = it.nome || it.titulo || ''; const end = [it.endereco, it.municipio, it.provincia].filter(Boolean).join(', ');
  return `<div class="nav-links">${dist != null ? `<span class="meta">${ic('compass')}${fmtKm(dist)} em linha recta</span>` : ''}${coordSelo(it, lat, lon)}
   ${botoesIr(lat, lon, nome, end, it.provincia || it.estadio_provincia)}<button type="button" data-mapa-foco="${lat},${lon}">${ic('pin')}Ver no mapa</button></div>`;
}
function coordSelo(it, lat, lon) {
  const e = it.coord_estado; if (!e) return '';
  const tip = e === 'verificada' ? 'Coordenadas confirmadas no OpenStreetMap — toque para escolher a aplicação de mapas' : 'Coordenadas aproximadas: confirme no local — toque para escolher a aplicação de mapas';
  return `<button type="button" class="pill ${e === 'verificada' ? 'p-green' : 'p-orange'} selo-coord" title="${tip}" data-mapas ${dadosLugar(lat ?? it.latitude ?? it.lat, lon ?? it.longitude ?? it.lon, it.nome || it.titulo, [it.endereco, it.municipio, it.provincia].filter(Boolean).join(', '))} data-coord-fonte="${esc(it.coord_fonte || '')}">${ic('pin')}${e === 'verificada' ? 'Localização verificada' : 'Localização aproximada'}</button>` + (it.verificado_em ? `<span class="meta">Verificado a ${dfmt(it.verificado_em)}</span>` : '');
}
// Aplicações de mapas
function abrirMapas(d) {
  const { lat, lon, nome, end } = d; const q = encodeURIComponent(nome || `${lat},${lon}`);
  const apps = [
    ['Google Maps', 'map', `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`],
    ['Waze', 'car', `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`],
    ['Apple Mapas', 'pin', `https://maps.apple.com/?daddr=${lat},${lon}&q=${q}`],
    ['OpenStreetMap', 'globe', `https://www.openstreetmap.org/directions?to=${lat},${lon}`],
    ['Outra app do telemóvel', 'phone', `geo:${lat},${lon}?q=${lat},${lon}(${q})`],
  ];
  openModal(`<div class="modal escolha">${modalHead(I18N.t('Como chegar'))}<p class="meta"><b>${esc(nome || '')}</b>${end ? '<br>' + esc(end) : ''}<br><span class="num">${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}</span></p>
   <div class="escolha-grid">${apps.map(([n, i, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${ic(i)}<span>${n}</span></a>`).join('')}
   <button type="button" data-copiar-coord="${lat}, ${lon}">${ic('check')}<span>${I18N.t('Copiar coordenadas')}</span></button></div>
   ${d.coordFonte ? `<p class="meta" style="margin-top:10px"><a class="fonte" href="${esc(d.coordFonte.split(' ')[0])}" target="_blank" rel="noopener">${ic('globe')}${I18N.t('Ver a origem da localização')}</a></p>` : ''}</div>`);
}
// Viagens entre províncias: autocarros interprovinciais e voos domésticos
// Cidades da pesquisa da NawaBus (bilhetes online de autocarro) e aeroportos servidos pela TAAG, por província
const NAWABUS = { Luanda: 'Luanda', Benguela: 'Benguela', 'Cuanza Sul': 'Cuanza Sul', Huambo: 'Huambo', 'Huíla': 'Lubango', Malanje: 'Malanje', 'Cuanza Norte': 'Ndalatando', 'Uíge': 'Uíge', Zaire: 'Soyo', Cabinda: 'Cabinda', Namibe: 'Namibe', Bengo: 'Luanda', 'Icolo e Bengo': 'Luanda' };
const AEROPORTO = { Luanda: 'Luanda', 'Icolo e Bengo': 'Luanda', Bengo: 'Luanda', Cabinda: 'Cabinda', Benguela: 'Catumbela', 'Bié': 'Cuito', 'Lunda Norte': 'Dundo', Huambo: 'Huambo', 'Huíla': 'Lubango', Moxico: 'Luena', Cubango: 'Menongue', Namibe: 'Namibe', Cunene: 'Ondjiva', 'Lunda Sul': 'Saurimo', Zaire: 'Soyo' };
const AUTOCARROS = [
  ['Macon', 'https://macontransp.com/', 'Ligações entre as principais cidades'],
  ['Real Express', 'https://realexpress-wl.praxioluna.com.br/?paginas=venda', 'Venda de bilhetes online'],
  ['Huambo Expresso', 'https://huamboexpresso.ao/', 'Luanda, Huambo e Planalto Central'],
  ['Viação Cidrália', 'https://cidralia.com/', 'Reserva por e-mail ou telefone'],
];
function abrirViagem(d) {
  const de = S.pos?.provincia || '', para = d.prov || '';
  const hoje = new Date(Date.now() + 36e5).toISOString().slice(0, 10);
  const nw = NAWABUS[de] && NAWABUS[para] && NAWABUS[de] !== NAWABUS[para]
    ? `https://www.nawabus.ao/search?origin=${encodeURIComponent(NAWABUS[de])}&destination=${encodeURIComponent(NAWABUS[para])}&date=${hoje}&tripType=one-way` : 'https://www.nawabus.ao/';
  const aDe = AEROPORTO[de], aPara = AEROPORTO[para];
  const voo = aPara && aDe !== aPara;
  const gf = `https://www.google.com/travel/flights?q=${encodeURIComponent(`voos de ${aDe || de || 'Luanda'} para ${aPara} Angola`)}&hl=pt-PT`;
  openModal(`<div class="modal escolha">${modalHead(I18N.t('Como viajar'))}<p class="meta">${de ? `${esc(de)} → ` : ''}<b>${esc(d.nome || para)}</b>${para ? ` · ${esc(para)}` : ''}</p>
   <h3 class="escolha-tit">${ic('ticket')} ${I18N.t('Autocarros interprovinciais')}</h3>
   <div class="escolha-grid"><a href="${esc(nw)}" target="_blank" rel="noopener"><span class="taxi-logo" style="background:#0E7C66">N</span><span>NawaBus</span><small>${I18N.t(nw.includes('search') ? 'Bilhetes online · pesquisa já preenchida' : 'Bilhetes online')}</small></a>
    ${AUTOCARROS.map(([n, u, t]) => `<a href="${esc(u)}" target="_blank" rel="noopener"><span class="taxi-logo" style="background:#1E63C9">${n[0]}</span><span>${n}</span><small>${I18N.t(t)}</small></a>`).join('')}</div>
   ${para === 'Cabinda' || de === 'Cabinda' ? `<p class="meta aviso-viagem">${I18N.t('Por estrada, Cabinda exige atravessar a República Democrática do Congo (visto e passaporte). O avião é a opção recomendada.')}</p>` : ''}
   ${voo ? `<h3 class="escolha-tit">${ic('globe')} ${I18N.t('Voos domésticos')}</h3>
   <div class="escolha-grid"><a href="https://www.taag.com/" target="_blank" rel="noopener"><span class="taxi-logo" style="background:#C8102E">T</span><span>TAAG</span><small>${esc(aDe || 'Luanda')} → ${esc(aPara)}</small></a>
    <a href="${esc(gf)}" target="_blank" rel="noopener"><span class="taxi-logo" style="background:#4285F4">G</span><span>Google Voos</span><small>${I18N.t('Comparar horários e preços')}</small></a></div>
    ${aDe && aDe !== 'Luanda' && aPara !== 'Luanda' ? `<p class="meta">${I18N.t('Entre províncias sem ligação directa, os voos da TAAG fazem normalmente escala em Luanda.')}</p>` : ''}` : aPara ? '' : `<p class="meta">${I18N.t('Esta província não tem voos comerciais regulares; o autocarro é a opção.')}</p>`}
   <h3 class="escolha-tit">${ic('car')} ${I18N.t('De carro')}</h3>
   <div class="escolha-grid"><button type="button" data-mapas ${dadosLugar(d.lat, d.lon, d.nome, d.end, d.prov)}>${ic('map')}<span>${I18N.t('Como chegar')}</span></button><a href="#viaturas" data-go="viaturas">${ic('car')}<span>${I18N.t('Alugar viatura')}</span></a></div>
   <p class="meta" style="margin-top:10px">${I18N.t('Horários e preços são definidos por cada operadora: confirme no site antes de viajar.')}</p></div>`);
}
// Aplicações de táxi que operam em Angola
function abrirTaxi(d) {
  const { lat, lon, nome, end } = d; const destino = [nome, end].filter(Boolean).join(', ') || `${lat}, ${lon}`;
  const android = /Android/i.test(navigator.userAgent);
  const intent = (pkg, web) => `intent://#Intent;package=${pkg};S.browser_fallback_url=${encodeURIComponent(web)};end`;
  const apps = [
    { n: 'Yango', cor: '#FFD400', u: yangoURL(lat, lon), destino: true },
    { n: 'Heetch', cor: '#FF2A6E', u: android ? intent('com.heetch', 'https://www.heetch.com/') : 'https://apps.apple.com/app/id693137280' },
    { n: 'Bolt', cor: '#34D186', u: 'https://bolt.eu/' },
    { n: 'inDrive', cor: '#C1F11D', u: android ? 'https://indrive.com/' : 'https://apps.apple.com/app/id780125801' },
  ];
  openModal(`<div class="modal escolha">${modalHead(I18N.t('Chamar táxi'))}<p class="meta">${I18N.t('Destino')}: <b>${esc(destino)}</b></p>
   <div class="escolha-grid taxi">${apps.map(a => `<a href="${esc(a.u)}" target="_blank" rel="noopener" data-taxi-app="${a.destino ? '' : 'copiar'}" data-destino="${esc(destino)}"><span class="taxi-logo" style="background:${a.cor}">${a.n[0]}</span><span>${a.n}</span><small>${I18N.t(a.destino ? 'Destino já preenchido' : 'Destino copiado: cole na app')}</small></a>`).join('')}</div>
   ${!S.pos && d.prov ? `<button type="button" class="link" data-viagem ${dadosLugar(d.lat, d.lon, d.nome, d.end, d.prov)} style="margin-top:10px">${ic('ticket')} ${I18N.t('Vem de outra província? Ver autocarros e voos')}</button>` : ''}
   <p class="meta" style="margin-top:10px">${I18N.t('A Yango abre com o destino preenchido. Na Heetch, Bolt e inDrive o destino é copiado ao tocar, para colar na app (estas apps não publicam ligações directas com destino).')}</p></div>`);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-mapas],[data-taxi],[data-viagem],[data-copiar-coord],[data-taxi-app]'); if (!b) return;
  const d = b.dataset;
  if (d.copiarCoord) { navigator.clipboard?.writeText(d.copiarCoord).then(() => toast(I18N.t('Coordenadas copiadas.')), () => toast(d.copiarCoord)); return; }
  if (d.taxiApp === 'copiar') { try { navigator.clipboard?.writeText(d.destino); } catch (er) {} toast(I18N.t('Destino copiado. Cole-o na app de táxi.')); return; }
  if (d.taxiApp !== undefined) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const dados = { lat: Number(d.lat), lon: Number(d.lon), nome: d.nome, end: d.end, prov: d.prov, coordFonte: d.coordFonte };
  if (d.viagem !== undefined) { abrirViagem(dados); return; }
  if (!Number.isFinite(dados.lat)) return;
  if (d.mapas !== undefined) abrirMapas(dados); else abrirTaxi(dados);
}, true);
function distKm(a, b, c, d) { const R = 6371, r = x => x * Math.PI / 180; const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
const fmtKm = k => k < 1 ? Math.round(k * 1000) + ' m' : (k < 10 ? k.toFixed(1) : Math.round(k)) + ' km';
const TIPO_COR = { destino: '#C8102E', experiencia: '#E2650F', alojamento: '#1E63C9', restaurante: '#7A3FC8', evento: '#2F7D45', estadio: '#141414' };
const TIPO_NOME = { destino: 'Destinos', experiencia: 'Experiências', alojamento: 'Alojamentos', restaurante: 'Restaurantes', evento: 'Eventos', estadio: 'Estádios' };
const TIPO_UM = { destino: 'Destino', experiencia: 'Experiência', alojamento: 'Alojamento', restaurante: 'Restaurante', evento: 'Evento', estadio: 'Estádio' };

/* ---------- geolocalização (todos os estados de erro) ---------- */
function pedirLocalizacao() {
  return new Promise(ok => {
    if (!window.isSecureContext) return ok({ erro: 'A localização só funciona em ligações seguras (https). Pesquise o local manualmente.' });
    if (!('geolocation' in navigator)) return ok({ erro: 'Este navegador não permite obter a localização. Pesquise o local manualmente.' });
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: p.coords.latitude, lon: p.coords.longitude, precisao: Math.round(p.coords.accuracy) }),
      e => ok({ erro: e.code === 1 ? 'Não autorizou o acesso à localização. Pode autorizar nas definições do navegador ou pesquisar o local manualmente.' : e.code === 3 ? 'A localização demorou demasiado. Tente de novo num local aberto ou pesquise manualmente.' : 'Não foi possível determinar a sua localização (GPS ou rede indisponível). Pesquise o local manualmente.' }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 });
  });
}
async function usarLocalizacao(btn) {
  if (btn) { btn.disabled = true; btn.dataset.txt = btn.innerHTML; btn.innerHTML = `${ic('compass')} ${I18N.t('A obter a localização…')}`; }
  const r = await pedirLocalizacao();
  if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.txt; }
  if (r.erro) { S.posErro = r.erro; toast(I18N.t(r.erro)); render(); return; }
  S.posErro = null;
  let loc = null; try { loc = (await API.get(`/api/geo/localizar?lat=${r.lat}&lon=${r.lon}`)).local; } catch (e) {}
  S.pos = { ...r, origem: 'gps', municipio: loc?.municipio || null, provincia: loc?.provincia || null, fora: !loc?.municipio };
  guardarPos(); render();
}

/* ---------- mapa (SVG, sem bibliotecas externas) ---------- */
const BB = { x0: 11.55, x1: 24.2, y0: -18.15, y1: -4.3 }; const KX = Math.cos(-11.2 * Math.PI / 180);
const W = 1000, HH = Math.round(W * (BB.y1 - BB.y0) / ((BB.x1 - BB.x0) * KX));
const px = lon => (lon - BB.x0) * KX / ((BB.x1 - BB.x0) * KX) * W, py = lat => (BB.y1 - lat) / (BB.y1 - BB.y0) * HH;
const CORES_PROV = ['#F6E7C1', '#E8D5B0', '#F3DADF', '#DDE8D3', '#D8E3EE', '#EBDDEB', '#F1E3CF', '#DCEBE6', '#EFE6C9', '#E3DCEF', '#F4DCCB', '#D9E6D9', '#ECE0D2', '#D7E4E9', '#F0D9E2', '#E1EAD0', '#EDE3DA', '#D6DFF0', '#F2E8D5', '#E0E6DD', '#EBD9D3'];
async function carregarMapa() {
  if (M.geo && M.pontos) return;
  if (M.carregando) return; M.carregando = true;
  try {
    const [g, p] = await Promise.all([M.geo ? M.geo : fetch('/geo/angola-municipios.geojson').then(r => { if (!r.ok) throw new Error('Mapa indisponível'); return r.json(); }), API.get('/api/geo/mapa?lang=' + I18N.lang)]);
    const provs = [...new Set(g.features.map(f => f.properties.provincia))].sort();
    M.geo = g.features.map(f => {
      const d = f.geometry.coordinates.map(pol => pol.map(anel => 'M' + anel.map(([x, y]) => px(x).toFixed(1) + ',' + py(y).toFixed(1)).join('L') + 'Z').join('')).join('');
      return { m: f.properties.municipio, p: f.properties.provincia, d, cor: CORES_PROV[provs.indexOf(f.properties.provincia) % CORES_PROV.length], polis: f.geometry.coordinates };
    });
    M.provincias = provs;
    M.pontos = p.itens; M.estadios = p.estadios.map(e => ({ tipo: 'estadio', id: e.id, nome: e.nome, lat: e.latitude, lon: e.longitude, provincia: e.provincia, municipio: null, coord_estado: e.coord_estado, coord_fonte: e.coord_fonte, navegacao: e.navegacao }));
  } finally { M.carregando = false; }
}
const dentroAnel = (x, y, a) => { let d = false; for (let i = 0, j = a.length - 1; i < a.length; j = i++) { const [xi, yi] = a[i], [xj, yj] = a[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d; } return d; };
const municipioDe = (lat, lon) => M.geo?.find(m => m.polis.some(p => dentroAnel(lon, lat, p[0]) && !p.slice(1).some(b => dentroAnel(lon, lat, b))));
const todosPontos = () => [...(M.pontos || []), ...M.estadios].filter(i => M.filtro.has(i.tipo));

V.mapa = () => {
  if (!M.geo) { carregarMapa().then(() => route() === 'mapa' && render()).catch(e => { M.erro = e.message; route() === 'mapa' && render(); }); return pageHead('Mapa de Angola', '21 províncias · 326 municípios', I('hero')) + `<div class="wrap"><div class="card" style="padding:30px;text-align:center">${M.erro ? esc(M.erro) : 'A carregar o mapa…'}</div></div>`; }
  const vb = M.vb || [0, 0, W, HH];
  const esc_ = W / vb[2]; const r = Math.max(2.2, 7 / esc_ ** 0.5) / esc_ ** 0.5;
  const P = todosPontos();
  const munSel = M.munSel ? M.geo.find(m => m.m === M.munSel) : null;
  const naMun = munSel ? P.filter(i => (i.municipio && i.municipio === munSel.m) || (!i.municipio && municipioDe(i.lat, i.lon)?.m === munSel.m)) : [];
  const sel = M.sel;
  const contagem = Object.fromEntries(Object.keys(TIPO_NOME).map(t => [t, [...(M.pontos || []), ...M.estadios].filter(i => i.tipo === t).length]));
  return pageHead('Mapa de Angola', 'Todos os destinos no mapa oficial: 21 províncias e 326 municípios', I('hero')) + `<div class="wrap">
   <div class="mapa-barra">${Object.keys(TIPO_NOME).map(t => `<button class="fchip${M.filtro.has(t) ? ' on' : ''}" data-mapa-tipo="${t}" aria-pressed="${M.filtro.has(t)}"><span class="ponto" style="background:${TIPO_COR[t]}"></span>${TIPO_NOME[t]} <small class="num">${contagem[t]}</small></button>`).join('')}</div>
   <div class="mapa-grid">
    <div class="mapa-caixa card">
     <svg id="mapa-svg" viewBox="${vb.join(' ')}" role="img" aria-label="${I18N.t('Mapa de Angola com municípios e lugares')}" preserveAspectRatio="xMidYMid meet">
      <g class="mun">${M.geo.map((m, i) => `<path d="${m.d}" fill="${m.cor}" data-mun="${i}" class="${munSel === m ? 'sel' : ''}"><title>${esc(m.m)} · ${esc(m.p)}</title></path>`).join('')}</g>
      <g class="pts">${P.map((it, i) => `<circle cx="${px(it.lon).toFixed(1)}" cy="${py(it.lat).toFixed(1)}" r="${(sel && sel.tipo === it.tipo && sel.id === it.id ? r * 1.8 : r).toFixed(2)}" fill="${TIPO_COR[it.tipo]}" data-ponto="${i}" class="${it.coord_estado === 'aproximada' ? 'aprox' : ''}"><title>${esc(it.nome)}</title></circle>`).join('')}</g>
      ${S.pos ? `<g class="eu"><circle cx="${px(S.pos.lon)}" cy="${py(S.pos.lat)}" r="${(r * 2.4).toFixed(2)}" fill="#1E63C9" fill-opacity=".25"/><circle cx="${px(S.pos.lon)}" cy="${py(S.pos.lat)}" r="${(r * 1.1).toFixed(2)}" fill="#1E63C9" stroke="#fff" stroke-width="${(r * .4).toFixed(2)}"/></g>` : ''}
     </svg>
     <div class="mapa-zoom"><button data-mapa-zoom="1.6" aria-label="${I18N.t('Aproximar')}">${ic('plus')}</button><button data-mapa-zoom="0.625" aria-label="${I18N.t('Afastar')}"><svg class="i" viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button><button data-mapa-reset aria-label="${I18N.t('Ver Angola inteira')}">${ic('globe')}</button><button data-usar-local aria-label="${I18N.t('Usar a minha localização')}">${ic('compass')}</button></div>
     <p class="mapa-atrib">Limites: Angola_Level2 (21 províncias, 326 municípios, WGS84) · Moradas: © contribuidores do OpenStreetMap</p>
    </div>
    <aside class="mapa-lado">
     ${S.pos ? `<div class="card" style="padding:12px 14px"><b>${ic('compass')} ${S.pos.origem === 'gps' ? 'Está aqui' : 'Ponto escolhido'}</b><p class="meta">${S.pos.municipio ? `${esc(S.pos.municipio)} · ${esc(S.pos.provincia)}` : S.pos.fora ? 'Fora do território de Angola' : esc(S.pos.nome || '')}${S.pos.precisao ? ` · ±${S.pos.precisao} m` : ''}</p><button class="link" data-go="perto">Ver o que está perto ${ic('chev')}</button></div>` : ''}
     ${sel ? cartaoPonto(sel) : munSel ? `<div class="card" style="padding:14px"><div style="display:flex;justify-content:space-between;gap:8px"><div><b style="font-size:17px">${esc(munSel.m)}</b><p class="meta">Província de ${esc(munSel.p)}</p></div><button class="k-ic" data-mapa-fechar aria-label="Fechar">${ic('x')}</button></div>
       ${naMun.length ? `<ul class="mapa-lista">${naMun.slice(0, 40).map(it => `<li><button data-ponto-ref="${it.tipo}:${it.id}"><span class="ponto" style="background:${TIPO_COR[it.tipo]}"></span>${esc(it.nome)}<small>${TIPO_UM[it.tipo]}</small></button></li>`).join('')}</ul>` : '<p class="meta" style="margin-top:8px">Ainda não há lugares registados neste município.</p>'}</div>`
       : `<div class="card" style="padding:14px"><b>Explore o mapa</b><p class="meta" style="margin-top:6px">Toque num município para ver o que lá existe, ou num ponto para ver o lugar e como lá chegar. Arraste para mover e use a roda ou dois dedos para aproximar.</p>
       <form data-geo-pesquisa style="margin-top:10px"><label class="sr" for="geo-q">Pesquisar local</label><div class="search"><span>${ic('search')}</span><input id="geo-q" name="q" placeholder="${I18N.t('Pesquisar local, bairro ou morada')}" autocomplete="off"></div></form><div id="geo-res"></div></div>`}
     <div class="card mapa-legenda" style="padding:12px 14px"><b>Províncias</b><div class="leg">${M.provincias.map((p, i) => `<button data-mapa-prov="${esc(p)}"><span style="background:${CORES_PROV[i % CORES_PROV.length]}"></span>${esc(p)}</button>`).join('')}</div></div>
    </aside>
   </div></div>`;
};
function cartaoPonto(it) {
  const det = it.tipo !== 'estadio' ? item(it.tipo, it.id) : null;
  const loc = it.municipio ? `${it.municipio} · ${it.provincia || ''}` : (municipioDe(it.lat, it.lon) ? `${municipioDe(it.lat, it.lon).m} · ${municipioDe(it.lat, it.lon).p}` : it.provincia || '');
  return `<div class="card" style="padding:14px">${it.imagem ? `<img src="${esc(it.imagem)}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:10px;margin-bottom:10px">` : ''}
   <div style="display:flex;justify-content:space-between;gap:8px"><div><span class="pill" style="background:${TIPO_COR[it.tipo]};color:#fff">${TIPO_UM[it.tipo]}</span><h3 style="margin-top:6px;font-size:17px">${esc(it.nome)}</h3><p class="meta">${esc(loc)}</p>${it.endereco ? `<p class="meta">${esc(it.endereco)}</p>` : ''}</div><button class="k-ic" data-mapa-fechar aria-label="Fechar">${ic('x')}</button></div>
   ${navLinks(it)}
   <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${det ? `<button class="btn btn-navy" data-ver-item="${it.tipo}:${it.id}">Ver detalhes</button>` : ''}<button class="btn btn-ghost" data-k-ask="${esc(I18N.t('Como chego a {nome}?', { nome: it.nome }))}">${ic('chat')} Perguntar à ENDA</button></div></div>`;
}
// abrir o item na página certa
function verItem(tipo, id) {
  const it = item(tipo, id); if (!it) return;
  if (tipo === 'experiencia') { S.detail = +id; go('experiencia/' + id); return; }
  if (tipo === 'destino') { S.f.q_dest = it.nome; S.f.dcat = 'Todos'; go('destinos'); return; }
  if (tipo === 'alojamento') { S.f.q_al = it.nome; go('alojamentos'); return; }
  if (tipo === 'evento') { S.f.q_ev = it.titulo; S.f.ecat = 'Todos'; S.f.econf = 'Todos'; go('eventos'); return; }
  if (tipo === 'restaurante') { S.f.q_g = it.nome; S.f.gcat = 'Restaurantes'; go('gastronomia'); return; }
}
function focarMapa(lat, lon, zoom = 8) {
  const w = W / zoom, h = HH / zoom; M.vb = [px(lon) - w / 2, py(lat) - h / 2, w, h];
  const P = todosPontos(); const perto = P.map(it => ({ it, d: Math.hypot(it.lat - lat, it.lon - lon) })).sort((a, b) => a.d - b.d)[0];
  M.sel = perto && perto.d < 0.002 ? perto.it : null; M.munSel = null;
  if (route() !== 'mapa') go('mapa'); else render();
}
// arrastar / aproximar sem redesenhar a página inteira
function ligarMapa() {
  const svg = document.getElementById('mapa-svg'); if (!svg || svg.dataset.ligado) return; svg.dataset.ligado = 1;
  const vb = () => svg.viewBox.baseVal; const ptrs = new Map(); let moveu = false, dist0 = 0;
  const paraSVG = (cx, cy) => { const r = svg.getBoundingClientRect(); const s = Math.max(vb().width / r.width, vb().height / r.height); const ox = (r.width * s - vb().width) / 2, oy = (r.height * s - vb().height) / 2; return [vb().x + (cx - r.left) * s - ox, vb().y + (cy - r.top) * s - oy, s]; };
  const zoomEm = (cx, cy, f) => { const [x, y] = paraSVG(cx, cy); const v = vb(); const nw = Math.min(W * 1.2, Math.max(W / 60, v.width / f)); const k = nw / v.width; v.x = x - (x - v.x) * k; v.y = y - (y - v.y) * k; v.width = nw; v.height = v.height * k; fim(); };
  let t = null; const fim = () => { clearTimeout(t); t = setTimeout(() => { const v = vb(); M.vb = [v.x, v.y, v.width, v.height]; render(); }, 260); };
  svg.addEventListener('wheel', e => { e.preventDefault(); zoomEm(e.clientX, e.clientY, e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
  svg.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); moveu = false; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; dist0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  svg.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return; const ant = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (dist0) { zoomEm((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / dist0); dist0 = d; } moveu = true; return; }
    const dx = e.clientX - ant[0], dy = e.clientY - ant[1]; if (Math.abs(dx) + Math.abs(dy) > 2) moveu = true; if (!moveu) return;
    svg.setPointerCapture?.(e.pointerId); const s = paraSVG(0, 0)[2]; const v = vb(); v.x -= dx * s; v.y -= dy * s; fim();
  });
  const solta = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) dist0 = 0; };
  svg.addEventListener('pointerup', e => {
    solta(e); if (moveu) return;
    const c = e.target.closest('[data-ponto]'), m = e.target.closest('[data-mun]');
    if (c) { M.sel = todosPontos()[+c.dataset.ponto]; M.munSel = null; render(); }
    else if (m) { M.munSel = M.geo[+m.dataset.mun].m; M.sel = null; render(); }
  });
  svg.addEventListener('pointercancel', solta);
}
new MutationObserver(() => ligarMapa()).observe(document.getElementById('app'), { childList: true, subtree: true });

/* ---------- perto de mim ---------- */
const P_ = { raio: 25, tipos: new Set(), dados: null, chave: null };
V.perto = () => {
  const head = pageHead('Perto de mim', 'Lugares da plataforma ordenados pela distância', I('luanda'));
  if (!S.pos) return head + `<div class="wrap"><div class="card perto-vazio"><span style="color:var(--red)">${ic('compass')}</span><h2>Onde está?</h2><p class="meta">Use a localização do dispositivo ou escreva um bairro, cidade ou morada. A sua localização é usada só para calcular distâncias e não fica guardada no servidor.</p>
    ${S.posErro ? `<p class="erro-box" role="alert">${esc(I18N.t(S.posErro))}</p>` : ''}
    <button class="btn btn-red" data-usar-local>${ic('compass')} Usar a minha localização</button>
    <form data-geo-pesquisa style="margin-top:14px;text-align:left"><label class="sr" for="geo-q">Pesquisar local</label><div class="search"><span>${ic('search')}</span><input id="geo-q" name="q" placeholder="${I18N.t('Pesquisar local, bairro ou morada')}" autocomplete="off"></div></form><div id="geo-res"></div></div></div>`;
  const chave = [S.pos.lat, S.pos.lon, P_.raio, [...P_.tipos].join(), I18N.lang].join('|');
  if (P_.chave !== chave) { P_.chave = chave; P_.dados = null; API.get(`/api/geo/perto?lat=${S.pos.lat}&lon=${S.pos.lon}&raio=${P_.raio}&tipos=${[...P_.tipos].join(',')}&lang=${I18N.lang}`).then(d => { P_.dados = d; route() === 'perto' && render(); }).catch(e => { P_.dados = { erro: e.message }; route() === 'perto' && render(); }); }
  const d = P_.dados;
  return head + `<div class="wrap">
   <div class="card" style="padding:12px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="color:#1E63C9">${ic('compass')}</span><div style="flex:1;min-width:180px"><b>${S.pos.origem === 'gps' ? 'A sua localização' : esc(S.pos.nome || 'Ponto escolhido')}</b><p class="meta">${S.pos.municipio ? `${esc(S.pos.municipio)} · ${esc(S.pos.provincia)}` : S.pos.fora ? 'Fora do território de Angola' : ''}${S.pos.precisao ? ` · precisão ±${S.pos.precisao} m` : ''}</p></div>
    <button class="btn btn-ghost" data-usar-local>${ic('compass')} Actualizar</button><button class="btn btn-ghost" data-limpar-local>${ic('x')} Mudar de local</button></div>
   <div class="mapa-barra" style="margin-top:12px"><label class="meta" for="raio">Raio</label><select id="raio" data-perto-raio>${[5, 10, 25, 50, 100, 300].map(r => `<option value="${r}" ${r === P_.raio ? 'selected' : ''}>${r} km</option>`).join('')}</select>
    ${['destino', 'experiencia', 'alojamento', 'restaurante', 'evento'].map(t => `<button class="fchip${P_.tipos.has(t) ? ' on' : ''}" data-perto-tipo="${t}"><span class="ponto" style="background:${TIPO_COR[t]}"></span>${TIPO_NOME[t]}</button>`).join('')}</div>
   ${d?.fora_de_angola ? `<p class="erro-box">A posição indicada fica fora de Angola; as distâncias podem ser muito grandes.</p>` : ''}
   ${!d ? '<div class="card" style="padding:24px;text-align:center">A procurar…</div>' : d.erro ? `<p class="erro-box">${esc(d.erro)}</p>` : d.itens.length ? `<div class="perto-lista">${d.itens.map(it => `<article class="card perto-item">${it.imagem ? `<img src="${esc(it.imagem)}" alt="" loading="lazy">` : ''}<div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="pill" style="background:${TIPO_COR[it.tipo]};color:#fff">${TIPO_UM[it.tipo]}</span><b class="num">${fmtKm(it.distancia_km)}</b></div><h3>${esc(it.nome)}</h3><p class="meta">${esc([it.endereco, it.municipio, it.provincia].filter(Boolean).join(' · '))}</p>${navLinks({ ...it, latitude: it.lat, longitude: it.lon })}<div style="margin-top:6px"><button class="link" data-ver-item="${it.tipo}:${it.id}">Ver detalhes ${ic('chev')}</button></div></div></article>`).join('')}</div>` : empty(`Não há lugares registados a menos de ${P_.raio} km. Aumente o raio.`)}
   <p class="meta" style="margin-top:10px">Distâncias em linha recta; o percurso por estrada é maior. Use Google Maps ou Waze para o caminho e o tempo de viagem.</p></div>`;
};

/* ---------- futebol ---------- */
const F_ = { tab: 'proximos', comp: '', clube: '', prov: '', dados: null, chave: null };
V.futebol = () => {
  const head = pageHead('Central de Futebol', 'Calendário, resultados e como chegar ao estádio', I('ev_kite'));
  const q = new URLSearchParams(); if (F_.tab === 'resultados') { q.set('estado', 'terminado'); q.set('ordem', 'desc'); } if (F_.comp) q.set('competicao', F_.comp); if (F_.clube) q.set('clube', F_.clube); if (F_.prov) q.set('provincia', F_.prov);
  const chave = q.toString();
  if (F_.chave !== chave) { F_.chave = chave; F_.dados = null; API.get('/api/jogos?' + chave).then(d => { F_.dados = d; route() === 'futebol' && render(); }).catch(e => { F_.dados = { erro: e.message }; route() === 'futebol' && render(); }); }
  const d = F_.dados; const comps = d ? [...new Set(d.jogos?.map(j => j.competicao) || [])] : [];
  const EST = { agendado: ['Agendado', 'p-blue'], 'ao vivo': ['Ao vivo', 'p-red'], terminado: ['Terminado', 'p-green'], adiado: ['Adiado', 'p-orange'], cancelado: ['Cancelado', 'p-red'] };
  const porDia = {}; for (const j of d?.jogos || []) (porDia[j.data_hora.slice(0, 10)] ||= []).push(j);
  return head + `<div class="wrap">
   <div class="tabs" role="tablist">${[['proximos', 'Próximos jogos'], ['resultados', 'Resultados']].map(([k, n]) => `<button role="tab" aria-selected="${F_.tab === k}" data-fut-tab="${k}">${n}</button>`).join('')}</div>
   <form class="fut-filtros card" data-fut-filtros><label>Competição<input name="comp" value="${esc(F_.comp)}" list="fut-comps" placeholder="Girabola, Taça…"></label><datalist id="fut-comps">${comps.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <label>Clube<input name="clube" value="${esc(F_.clube)}" placeholder="Petro, 1.º de Agosto…"></label>
    <label>Província<select name="prov"><option value="">Todas</option>${lista('provincias').concat(S.cat?.provincias || []).map(p => p.nome).filter((v, i, a) => a.indexOf(v) === i).sort().map(p => `<option ${p === F_.prov ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
    <button class="btn btn-navy">${ic('search')} Filtrar</button></form>
   ${!d ? '<div class="card" style="padding:24px;text-align:center">A carregar…</div>' : d.erro ? `<p class="erro-box">${esc(d.erro)}</p>` : !d.jogos.length ? empty('Sem jogos para estes filtros.') : Object.entries(porDia).map(([dia, L]) => `<section class="section"><h2 class="fut-dia">${dlong(dia)}</h2>${L.map(j => `<article class="card jogo">
     <div class="jogo-topo"><span class="meta">${esc(j.competicao)}${j.jornada ? ` · Jornada ${esc(j.jornada)}` : ''}</span><span class="pill ${EST[j.estado]?.[1] || 'p-blue'}">${EST[j.estado]?.[0] || esc(j.estado)}</span></div>
     <div class="jogo-equipas"><b>${esc(j.casa)}</b><span class="jogo-res num">${j.golos_casa != null ? `${j.golos_casa} – ${j.golos_fora}` : j.data_hora.slice(11, 16)}</span><b>${esc(j.fora)}</b></div>
     <div class="jogo-pe"><span class="meta">${ic('pin')}${esc(j.estadio_nome || j.estadio || 'Estádio por confirmar')}${j.estadio_cidade ? ` · ${esc(j.estadio_cidade)}` : ''}</span>
      <span class="meta">${ic('clock')}Hora de Angola</span>
      ${j.confianca && j.confianca !== 'oficial' ? `<span class="pill ${j.confianca === 'por confirmar' ? 'p-orange' : 'p-blue'}">${j.confianca === 'por confirmar' ? 'Por confirmar' : 'Fonte identificada'}</span>` : j.confianca === 'oficial' ? '<span class="pill p-green">Oficial</span>' : ''}
      ${j.fonte_url ? `<a class="meta fonte" href="${esc(j.fonte_url)}" target="_blank" rel="noopener">${ic('globe')}${esc(j.fonte_nome || hostDe(j.fonte_url))}</a>` : ''}</div>
     <div class="nav-links">${j.navegacao ? `${botoesIr(j.latitude, j.longitude, j.estadio_nome, j.estadio_cidade, j.estadio_provincia)}<button type="button" data-mapa-foco="${j.latitude},${j.longitude}">${ic('pin')}Ver no mapa</button>` : '<span class="meta">Localização do estádio por confirmar</span>'}${j.bilhetes_url ? `<a href="${esc(j.bilhetes_url)}" target="_blank" rel="noopener" class="btn btn-navy">${ic('ticket')}Bilhetes (canal oficial)</a>` : ''}</div>
    </article>`).join('')}</section>`).join('')}
   ${d?.fontes?.length ? `<div class="card" style="padding:12px 14px;margin-top:14px"><b>Fontes</b><ul class="fontes-lista">${d.fontes.map(f => `<li>${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nome)}</a>` : esc(f.nome)}${f.oficial ? ' <span class="pill p-green">oficial</span>' : ''}${f.ultima_sync ? `<small> · actualizado ${dataSQL(f.ultima_sync).toLocaleString(I18N.loc, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}${f.ultimo_estado === 'erro' ? ' (última leitura falhou)' : ''}</small>` : ''}</li>`).join('')}</ul><p class="meta">Só mostramos ligações de bilhetes de canais oficiais. Confirme sempre a hora junto do clube ou da federação.</p></div>` : ''}</div>`;
};

/* ---------- roteiros ---------- */
const R_ = { lista: null, edit: null, planeando: false, aCarregar: false };
V.roteiros = () => {
  const head = pageHead('Roteiros', 'Planeie a viagem com lugares reais e guarde para mais tarde', I('mussulo'));
  if ((S.roteiros === null || R_.lista === null) && !R_.aCarregar) { R_.aCarregar = true; S.roteiros = undefined; API.get('/api/roteiros').then(L => { R_.lista = L; S.roteiros = L; }).catch(e => { R_.lista = []; toast(e.message); }).finally(() => { R_.aCarregar = false; route() === 'roteiros' && render(); }); }
  const ed = R_.edit;
  const provs = (S.cat?.provincias || []).map(p => p.nome).sort();
  return head + `<div class="wrap">
   ${ed ? editorRoteiro(ed) : `<form class="card rot-form" data-rot-planear><h2 style="font-size:18px">Novo roteiro</h2>
    <div class="rot-campos"><label>Cidade ou província<select name="cidade"><option value="">Todo o país</option>${provs.map(p => `<option>${esc(p)}</option>`).join('')}</select></label>
    <label>Dias<input type="number" name="dias" min="1" max="7" value="2"></label><label>Pessoas<input type="number" name="pessoas" min="1" max="50" value="2"></label>
    <label>Orçamento por pessoa (Kz, opcional)<input type="number" name="orcamento" min="0" step="1000" placeholder="ex.: 50000"></label></div>
    <fieldset class="rot-int"><legend class="meta">Interesses</legend>${['Praias', 'Natureza', 'Cultura', 'Aventura', 'Gastronomia', 'Cidades'].map(i => `<label class="fchip"><input type="checkbox" name="int" value="${i}"> ${i}</label>`).join('')}</fieldset>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-red" ${R_.planeando ? 'disabled' : ''}>${ic('list')} ${R_.planeando ? 'A planear…' : 'Planear'}</button><button type="button" class="btn btn-ghost" data-k-ask="${esc(I18N.t('Ajuda-me a planear um roteiro'))}">${ic('chat')} Planear com a ENDA</button></div></form>`}
   <section class="section"><div class="sec-head"><h2>Os meus roteiros</h2></div>
   ${R_.lista === null ? '<div class="card" style="padding:20px">A carregar…</div>' : R_.lista.length ? `<div class="grid">${R_.lista.map(r => `<article class="card" style="padding:14px"><h3>${esc(r.titulo)}</h3><p class="meta">${r.cidade ? esc(r.cidade) + ' · ' : ''}${r.dias} dia${r.dias > 1 ? 's' : ''} · ${r.itens.length} paragens</p><p class="meta">Actualizado ${dataSQL(r.atualizado_em).toLocaleDateString(I18N.loc)}</p><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn btn-navy" data-rot-abrir="${r.id}">${ic('edit')} Abrir</button><button class="btn btn-ghost" data-k-ask="${esc(I18N.t('Ajusta o meu roteiro «{t}» (id {id})', { t: r.titulo, id: r.id }))}">${ic('chat')} ENDA</button><button class="btn btn-ghost" data-rot-apagar="${r.id}" aria-label="Apagar">${ic('trash')}</button></div></article>`).join('')}</div>` : empty('Ainda não guardou roteiros.')}</section></div>`;
};
function editorRoteiro(r) {
  const dias = {}; r.itens.forEach((it, i) => (dias[it.dia] ||= []).push([it, i]));
  return `<form class="card rot-form" data-rot-guardar><div style="display:flex;gap:8px;align-items:center"><label style="flex:1">Nome do roteiro<input name="titulo" value="${esc(r.titulo || '')}" maxlength="120" required></label><button type="button" class="k-ic" data-rot-fechar aria-label="Fechar">${ic('x')}</button></div>
   ${r.aviso ? `<p class="erro-box">${esc(I18N.t(r.aviso))}</p>` : ''}
   ${Object.entries(dias).map(([d, L]) => `<div class="rot-dia"><b>Dia ${d}</b>${L.map(([it, i]) => `<div class="rot-item"><span class="meta rot-per">${esc(I18N.t(it.periodo || ''))}</span><div style="flex:1"><b>${esc(it.nome)}</b>${it.km_anterior != null ? `<small class="meta"> · ${fmtKm(it.km_anterior)} do anterior</small>` : ''}${it.preco ? `<small class="meta"> · ${kz(it.preco)}/pessoa</small>` : ''}<input class="rot-nota" data-rot-nota="${i}" value="${esc(it.nota || '')}" placeholder="${I18N.t('Nota (opcional)')}" maxlength="300">${it.lat != null ? navLinks({ lat: it.lat, lon: it.lon }, true) : ''}</div>
     <div class="rot-acoes"><button type="button" data-rot-mover="${i}:-1" aria-label="Subir">▲</button><button type="button" data-rot-mover="${i}:1" aria-label="Descer">▼</button><button type="button" data-rot-tirar="${i}" aria-label="Retirar">${ic('x')}</button></div></div>`).join('')}</div>`).join('') || '<p class="meta">Sem paragens.</p>'}
   ${r.custo_publicado ? `<p class="meta">Custo das actividades com preço publicado: <b>${kz(r.custo_publicado)}</b> (sem alojamento nem transporte).</p>` : ''}
   ${r.nota ? `<p class="meta">${esc(I18N.t(r.nota))}</p>` : ''}
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-red">${ic('check')} ${r.id ? 'Guardar alterações' : 'Guardar roteiro'}</button></div></form>`;
}

/* ---------- prato: ingredientes, fonte e onde comer ---------- */
function abrirPrato(id) {
  const p = item('prato', id); if (!p) return;
  const rel = (S.cat?.pratos_restaurantes || []).filter(x => x.prato_id === p.id).map(x => ({ r: item('restaurante', x.restaurante_id), fonte: x.fonte })).filter(x => x.r);
  openModal(`<div class="modal">${modalHead(esc(p.nome))}<img src="${esc(p.imagem)}" alt="" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;margin:10px 0">
   <p>${esc(p.historia || p.descricao)}</p>
   ${p.ingredientes?.length ? `<h3 style="margin-top:12px;font-size:15px">Ingredientes principais</h3><ul class="ingr">${p.ingredientes.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
   ${p.regiao ? `<p class="meta">Região associada: ${esc(p.regiao)}</p>` : ''}${p.alergenios ? `<p class="meta">Alergénios: ${esc(p.alergenios)}</p>` : ''}
   ${p.fonte ? `<p class="meta"><a class="fonte" href="${esc(p.fonte)}" target="_blank" rel="noopener">${ic('globe')}Fonte: ${esc(hostDe(p.fonte))}</a></p>` : ''}
   <h3 style="margin-top:14px;font-size:15px">Onde comer</h3>
   ${rel.length ? rel.map(({ r, fonte }) => `<div class="card" style="padding:10px 12px;margin-top:8px"><b>${esc(r.nome)}</b><p class="meta">${esc(r.endereco || r.local)}</p>${navLinks(r)}${fonte ? `<a class="meta fonte" href="${esc(fonte)}" target="_blank" rel="noopener">${ic('globe')}Porque está aqui: ${esc(hostDe(fonte))}</a>` : ''}</div>`).join('') : '<p class="meta">Ainda não confirmámos restaurantes que sirvam este prato. Pergunte à ENDA por sugestões.</p>'}
   <button class="btn btn-ghost" style="margin-top:12px" data-k-explain="prato:${p.id}">${ic('chat')} ENDA explica em voz alta</button></div>`);
}

/* ---------- menu lateral no telemóvel ---------- */
function menu(abrir) {
  const sh = document.querySelector('.shell'); if (!sh) return;
  sh.classList.toggle('menu-aberto', abrir); document.body.classList.toggle('menu-aberto', abrir);
  document.querySelectorAll('[data-menu]').forEach(b => b.setAttribute('aria-expanded', abrir));
  if (abrir) document.querySelector('#menu-lateral .nav button')?.focus();
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-menu]')) { e.preventDefault(); e.stopImmediatePropagation(); menu(true); return; }
  if (e.target.closest('[data-menu-fechar]')) { e.stopImmediatePropagation(); menu(false); return; }
  if (e.target.closest('#menu-lateral [data-go], #menu-lateral a')) { document.body.classList.remove('menu-aberto'); }
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('menu-aberto')) menu(false); });
window.addEventListener('hashchange', () => document.body.classList.remove('menu-aberto'));

/* ---------- acções ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('button,a'); if (!b) return; const d = b.dataset;
  if (d.mais) { S.f['n_' + d.mais] = (S.f['n_' + d.mais] || 24) + 24; render(); return; }
  if (d.mapaTipo) { M.filtro.has(d.mapaTipo) ? M.filtro.delete(d.mapaTipo) : M.filtro.add(d.mapaTipo); M.sel = null; render(); return; }
  if (d.mapaZoom) { const v = M.vb || [0, 0, W, HH]; const f = +d.mapaZoom; const nw = Math.min(W * 1.2, Math.max(W / 60, v[2] / f)), nh = v[3] * nw / v[2]; M.vb = [v[0] + (v[2] - nw) / 2, v[1] + (v[3] - nh) / 2, nw, nh]; render(); return; }
  if (d.mapaReset !== undefined) { M.vb = null; M.sel = null; M.munSel = null; render(); return; }
  if (d.mapaFechar !== undefined) { M.sel = null; M.munSel = null; render(); return; }
  if (d.mapaFoco) { e.preventDefault(); const [la, lo] = d.mapaFoco.split(',').map(Number); closeModal(); if (typeof K !== 'undefined' && K.open && innerWidth < 760) { K.open = false; terminarVoz(); renderK(); } await carregarMapa().catch(() => {}); focarMapa(la, lo); return; }
  if (d.mapaProv) { const L = M.geo.filter(m => m.p === d.mapaProv); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const m of L) for (const pol of m.polis) for (const [x, y] of pol[0]) { x0 = Math.min(x0, px(x)); x1 = Math.max(x1, px(x)); y0 = Math.min(y0, py(y)); y1 = Math.max(y1, py(y)); } const pad = 20; M.vb = [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad]; M.sel = null; M.munSel = null; render(); return; }
  if (d.pontoRef) { const [t, id] = d.pontoRef.split(':'); M.sel = todosPontos().find(i => i.tipo === t && String(i.id) === id) || null; render(); return; }
  if (d.verItem) { const [t, id] = d.verItem.split(':'); verItem(t, id); return; }
  if (d.usarLocal !== undefined) { usarLocalizacao(b); return; }
  if (d.limparLocal !== undefined) { S.pos = null; guardarPos(); render(); return; }
  if (d.geoEscolher) { const o = JSON.parse(d.geoEscolher); let loc = null; try { loc = (await API.get(`/api/geo/localizar?lat=${o.lat}&lon=${o.lon}`)).local; } catch (er) {} S.pos = { lat: o.lat, lon: o.lon, origem: 'manual', nome: o.nome, municipio: loc?.municipio || null, provincia: loc?.provincia || null, fora: !loc?.municipio }; guardarPos(); if (route() === 'mapa') focarMapa(o.lat, o.lon, 10); else render(); return; }
  if (d.pertoTipo) { P_.tipos.has(d.pertoTipo) ? P_.tipos.delete(d.pertoTipo) : P_.tipos.add(d.pertoTipo); render(); return; }
  if (d.futTab) { F_.tab = d.futTab; render(); return; }
  if (d.prato) { abrirPrato(+d.prato); return; }
  if (d.rotAbrir) { R_.edit = JSON.parse(JSON.stringify(R_.lista.find(r => r.id === +d.rotAbrir))); render(); return; }
  if (d.rotFechar !== undefined) { R_.edit = null; render(); return; }
  if (d.rotApagar) { if (!confirmarSimples()) return; await API.del('/api/roteiros/' + d.rotApagar).catch(er => toast(er.message)); R_.lista = null; render(); return; }
  if (d.rotTirar) { lerNotas(); R_.edit.itens.splice(+d.rotTirar, 1); render(); return; }
  if (d.rotMover) { lerNotas(); const [i, dir] = d.rotMover.split(':').map(Number); const L = R_.edit.itens, j = i + dir; if (j < 0 || j >= L.length) return; if (L[j].dia !== L[i].dia) { L[i].dia = L[j].dia; } else [L[i], L[j]] = [L[j], L[i]]; render(); return; }
}, false);
// confirmação sem caixas de diálogo do navegador: segundo toque em 3 s
let _conf = 0; function confirmarSimples() { if (Date.now() - _conf < 3000) { _conf = 0; return true; } _conf = Date.now(); toast(I18N.t('Toque outra vez para confirmar.')); return false; }
function lerNotas() { document.querySelectorAll('[data-rot-nota]').forEach(i => { const it = R_.edit?.itens[+i.dataset.rotNota]; if (it) it.nota = i.value; }); }
document.addEventListener('change', e => { if (e.target.matches('[data-perto-raio]')) { P_.raio = +e.target.value; render(); } });
document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.matches('[data-geo-pesquisa]')) {
    e.preventDefault(); const q = f.q.value.trim(); const box = document.getElementById('geo-res'); if (q.length < 2) return;
    box.innerHTML = `<p class="meta">${I18N.t('A pesquisar…')}</p>`;
    try {
      const r = await API.get('/api/geo/pesquisa?q=' + encodeURIComponent(q) + '&lang=' + I18N.lang);
      const L = [...r.catalogo.map(i => ({ nome: i.nome, sub: [TIPO_UM[i.tipo], i.municipio, i.provincia].filter(Boolean).join(' · '), lat: i.lat, lon: i.lon })), ...r.lugares.map(l => ({ nome: l.nome, sub: l.endereco, lat: l.lat, lon: l.lon }))];
      box.innerHTML = (r.aviso ? `<p class="meta">${esc(I18N.t(r.aviso))}</p>` : '') + (L.length ? `<ul class="mapa-lista">${L.slice(0, 10).map(l => `<li><button data-geo-escolher='${esc(JSON.stringify({ nome: l.nome, lat: l.lat, lon: l.lon }))}'>${ic('pin')}${esc(l.nome)}<small>${esc(l.sub || '')}</small></button></li>`).join('')}</ul><p class="meta" style="font-size:11px">${esc(r.atribuicao)}</p>` : `<p class="meta">${I18N.t('Nada encontrado em Angola com esse nome.')}</p>`);
    } catch (er) { box.innerHTML = `<p class="erro-box">${esc(er.message)}</p>`; }
    return;
  }
  if (f.matches('[data-fut-filtros]')) { e.preventDefault(); F_.comp = f.comp.value.trim(); F_.clube = f.clube.value.trim(); F_.prov = f.prov.value; render(); return; }
  if (f.matches('[data-rot-planear]')) {
    e.preventDefault(); R_.planeando = true; render();
    try {
      const fd = new FormData(f);
      const r = await API.post('/api/roteiros/planear', { cidade: fd.get('cidade'), dias: +fd.get('dias'), pessoas: +fd.get('pessoas'), orcamento: fd.get('orcamento') ? +fd.get('orcamento') : null, interesses: fd.getAll('int'), lang: I18N.lang });
      R_.edit = { titulo: `${fd.get('cidade') || 'Angola'} em ${fd.get('dias')} dia${+fd.get('dias') > 1 ? 's' : ''}`, cidade: fd.get('cidade') || null, dias: +fd.get('dias'), pessoas: +fd.get('pessoas'), orcamento: fd.get('orcamento') ? +fd.get('orcamento') : null, interesses: fd.getAll('int'), ...r };
    } catch (er) { toast(er.message); } finally { R_.planeando = false; render(); }
    return;
  }
  if (f.matches('[data-rot-guardar]')) {
    e.preventDefault(); lerNotas(); const r = R_.edit; r.titulo = f.titulo.value.trim();
    const corpo = { titulo: r.titulo, cidade: r.cidade, dias: Math.max(1, ...r.itens.map(i => i.dia), 1), pessoas: r.pessoas, orcamento: r.orcamento, interesses: r.interesses, itens: r.itens };
    try { r.id ? await API.put('/api/roteiros/' + r.id, corpo) : await API.post('/api/roteiros', corpo); toast(I18N.t('Roteiro guardado.')); R_.edit = null; R_.lista = null; render(); } catch (er) { toast(er.message); }
  }
});
// a ENDA pode guardar roteiros: ao voltar à página, recarrega
const _antesDe = antesDe; antesDe = async r => { if (r === 'roteiros' && S.roteiros === null) R_.lista = null; return _antesDe(r); };
