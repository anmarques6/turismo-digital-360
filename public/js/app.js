/* =========================================================
   ANGOLA 365º — aplicação do turista
   Os dados vêm da API (base de dados); nada fica preso ao navegador.
   ========================================================= */

/* ---------- estado ---------- */
const S = {
  user: null, cat: null, favs: new Set(), f: {}, detail: null, q: '', hideBal: false,
  txTab: 'Todas', resTab: 'Próximas', notifs: [], naoLidas: 0, carteira: null, reservas: null, avals: [], pesquisa: [], loginMode: 'in', carregando: true,
};
const T = { destino: 'destinos', experiencia: 'experiencias', alojamento: 'alojamentos', evento: 'eventos', prato: 'pratos', restaurante: 'restaurantes', viatura: 'viaturas', tradutor: 'tradutores' };
const ROTA_DO_TIPO = { destino: 'destinos', experiencia: 'experiencias', alojamento: 'alojamentos', evento: 'eventos', prato: 'gastronomia', restaurante: 'gastronomia', viatura: 'viaturas', tradutor: 'tradutores' };
const lista = t => S.cat?.[t] || [];
const item = (tipo, id) => lista(T[tipo]).find(i => i.id === Number(id));
const nomeDe = i => i?.nome || i?.titulo || '';
const hojeISO = () => S.cat?.hoje || new Date().toISOString().slice(0, 10);
const somaDias = (d, n) => new Date(new Date(d + 'T12:00:00').getTime() + n * 864e5).toISOString().slice(0, 10);
const dataSQL = s => new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + 'Z');
const prefs = { get(k, d) { try { const v = localStorage.getItem('td360_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('td360_' + k, JSON.stringify(v)); } catch (e) {} } };

const ROUTES = ['inicio', 'destinos', 'experiencias', 'experiencia', 'alojamentos', 'eventos', 'gastronomia', 'viaturas', 'pagamentos', 'reservas', 'tradutores', 'favoritos', 'perfil', 'pesquisa'];
const NAV = [['inicio', 'home', 'Início'], ['sep', 'Explorar'], ['destinos', 'pin', 'Destinos'], ['experiencias', 'palm', 'Experiências'], ['alojamentos', 'bed', 'Alojamentos'], ['eventos', 'cal', 'Eventos'], ['gastronomia', 'food', 'Gastronomia'], ['sep', 'Serviços'], ['viaturas', 'car', 'Aluguer de viaturas'], ['tradutores', 'lang', 'Tradutores'], ['sep', 'Conta'], ['reservas', 'ticket', 'As minhas reservas'], ['pagamentos', 'wallet', 'Carteira e pagamentos'], ['favoritos', 'heart', 'Favoritos'], ['perfil', 'user', 'Perfil']];

function route() { const h = location.hash.slice(1).split('/')[0]; return ROUTES.includes(h) ? h : 'inicio'; }
function go(r) { if (location.hash.slice(1) === r) render(); else location.hash = r; window.scrollTo(0, 0); }
window.addEventListener('hashchange', () => { const p = location.hash.slice(1).split('/'); if (p[0] === 'experiencia' && p[1]) S.detail = +p[1]; render(); window.scrollTo(0, 0); });

/* ---------- componentes ---------- */
const favBtn = (tipo, id, plain) => { const k = tipo + ':' + id; return `<button class="fav${plain ? ' plain' : ''}" data-fav="${k}" aria-pressed="${S.favs.has(k)}" aria-label="Favorito">${ic('heart')}</button>`; };
const stars = (r, n) => (!Number(r) ? `<span class="pill p-blue" style="align-self:flex-start">Novo na plataforma</span>` : `<span class="meta"><span class="star">${ic('star')}</span><b style="color:var(--fg)">${Number(r || 0).toFixed(1)}</b>${n != null ? ` <span>(${n})</span>` : ''}</span>`);
const PILL = { Praias: 'p-blue', Natureza: 'p-green', Cultura: 'p-purple', Aventura: 'p-orange', Cidades: 'p-blue', Gastronomia: 'p-purple', Música: 'p-green', Esportes: 'p-blue', Negócios: 'p-orange' };
const catPill = c => `<span class="pill ${PILL[c] || 'p-green'}">${c}</span>`;
const catBg = { Natureza: '#2F7D45', Cultura: '#E2650F', Gastronomia: '#7A3FC8', Aventura: '#C8102E', 'Bem-estar': '#1F9E8A', Música: '#2F7D45', Esportes: '#1E63C9', Negócios: '#0B1B3F' };
const AMEN_IC = { 'Wi-Fi': 'wifi', Piscina: 'pool', 'Pequeno-almoço': 'coffee', 'Ar condicionado': 'snow', Estacionamento: 'park', Spa: 'spa', Cozinha: 'kitchen' };
const TIPO_AL_PILL = { Hotéis: 'p-green', Pousadas: 'p-green', Resorts: 'p-purple', Apartamentos: 'p-orange', Villas: 'p-blue' };
const PRATO_PILL = ['p-orange', 'p-red', 'p-green', 'p-purple'];
const mesCurto = m => new Date(2026, m, 15).toLocaleDateString(I18N.loc, { month: 'short' }).replace('.', '');
const MESES = { get length() { return 12; } }; for (let m = 0; m < 12; m++) Object.defineProperty(MESES, m, { get: () => mesCurto(m).toUpperCase() });
const dfmt = d => { const x = new Date(d + 'T12:00'); const m = mesCurto(x.getMonth()); return `${String(x.getDate()).padStart(2, '0')} ${m.charAt(0).toUpperCase() + m.slice(1)}`; };
const dlong = d => new Date(d + 'T12:00').toLocaleDateString(I18N.loc, { day: 'numeric', month: 'long', year: 'numeric' });
const empty = t => `<div class="empty" style="grid-column:1/-1">${ic('search')}<p>${t}</p></div>`;
const match = (txt, q) => !q || NORMQ(txt).includes(NORMQ(q));
const NORMQ = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const precoAl = a => a.preco_noite == null ? null : Math.round(a.preco_noite * (100 - (a.oferta_pct || 0)) / 100);
const hostDe = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
const btnPedir = (tipo, id, cls = 'btn btn-navy') => `<button class="${cls}" data-pedir="${tipo}:${id}">${ic('chat')} Pedir reserva</button>`;
const seloFonte = it => it.fonte ? `<a class="meta fonte" href="${esc(it.fonte)}" target="_blank" rel="noopener">${ic('globe')}Fonte: ${esc(hostDe(it.fonte))}</a>` : '';

function chips(key, list, cls = '') {
  const cur = S.f[key] || list[0][0];
  return `<div class="chips ${cls}" role="toolbar">${list.map(([v, icn, color]) => `<button class="chip" data-chip="${key}" data-v="${v}" aria-pressed="${cur === v}">${icn && icn.startsWith('flag:') ? `<span class="flag">${icn.slice(5)}</span>` : `<span style="color:${cur === v ? 'inherit' : (color || 'var(--fg)')}">${ic(icn)}</span>`}${v}</button>`).join('')}</div>`;
}
function search(key, ph, opts = {}) {
  return `<div class="searchbar ${opts.navy ? 'navy' : ''}">${ic('search')}<input id="q-${key}" data-q="${key}" placeholder="${ph}" value="${esc(S.f['q_' + key] || '')}" aria-label="${ph}">${opts.dates ? `<span class="divider"></span><span class="dates">${ic('cal')}<input type="date" id="d-${key}" aria-label="Datas" value="${S.f['d_' + key] || ''}" data-date="${key}"></span>` : ''}<button class="go" ${opts.submit ? 'type="submit"' : `type="button" data-focus="q-${key}"`} aria-label="${opts.submit ? 'Pesquisar' : 'Filtros'}">${ic(opts.icon || 'sliders')}</button></div>`;
}
function pageHead(title, sub, img, cls = '') {
  return `<header class="page-head ${cls}">${img ? `<img class="bg" src="${img}" alt="">` : ''}<div class="wrap in"><button class="circle" data-go="inicio" aria-label="Voltar">${ic('back')}</button><div style="flex:1;min-width:0"><h1>${title}</h1><p>${sub}</p></div><button class="circle" data-go="favoritos" aria-label="Favoritos">${ic('heart')}<span class="badge-dot num">${S.favs.size}</span></button></div></header>`;
}
const I = n => n === 'sigaf' ? '/img/sigaf.webp' : `/img/${n}.jpg`;

/* ---------- vistas ---------- */
const V = {};
V.inicio = () => {
  const first = (S.user?.nome || 'Viajante').split(' ')[0];
  const dest = lista('destinos').filter(d => d.destaque).slice(0, 6);
  const xps = [...lista('experiencias')].sort((a, b) => b.destaque - a.destaque).slice(0, 3);
  return `<header class="hero"><img class="bg" src="${I('hero')}" alt="Memorial Agostinho Neto e a Marginal de Luanda ao pôr do sol">
   <div class="topbar-m"><div class="wrap"><button class="circle" style="background:var(--red)" data-go="perfil" aria-label="Menu">${ic('menu')}</button>${logo()}<span style="display:flex;gap:8px;align-items:center">${I18N.seletor('on-dark mini')}<button class="circle" aria-label="Notificações" data-notifs>${ic('bell')}<span class="bell-count" data-notif-count>0</span></button></span></div></div>
   <div class="wrap in"><p style="margin:0 0 8px;color:var(--gold);font-weight:700">Olá, ${esc(first)}</p><h1>${t('Angola<br><em>te</em> espera.')}</h1><p>Descubra destinos incríveis, experiências únicas.</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button class="btn btn-gold" data-k-ask="Sugere-me um passeio">${ic('chat')} Pergunte à ENDA</button><button class="btn" style="background:rgba(255,255,255,.14);color:#fff;position:relative" data-notifs>${ic('bell')} Notificações<span class="bell-count" data-notif-count>0</span></button></div></div></header>
  <div class="wrap">
   <form data-search>${search('global', 'Para onde deseja ir?', { icon: 'search', submit: 1 })}</form>
   <nav class="quick" aria-label="Módulos">
    ${[['destinos', 'pin', 'Destinos', '#FDECEE', 'var(--red)'], ['experiencias', 'palm', 'Experiências', 'var(--gold)'], ['alojamentos', 'bed', 'Alojamentos', '#141414'], ['eventos', 'cal', 'Eventos', 'var(--red)'], ['gastronomia', 'food', 'Gastronomia', 'var(--gold)'], ['viaturas', 'car', 'Viaturas', 'var(--navy)'], ['mapa', 'map', 'Mapa', 'var(--red-deep)'], ['reservas', 'ticket', 'Reservas', '#141414']].map(([r, i, l, bg, c]) => `<button data-go="${r}"><span class="ico" style="background:${bg};${c ? 'color:' + c : ''}">${ic(i)}</span>${l}</button>`).join('')}
   </nav>
   <section class="section"><div class="sec-head"><h2>Destinos em Destaque</h2><button class="link" data-go="destinos">Ver todos ${ic('chev')}</button></div>
    <div class="row-scroll">${dest.map(d => `<div class="tile" role="button" tabindex="0" data-open-dest="${d.id}"><img src="${d.imagem}" alt="${esc(d.nome)}">${favBtn('destino', d.id)}<div class="cap"><small>${ic('pin')}${esc(d.provincia || '')}</small><b>${esc(d.nome)}</b><small><span class="star">${ic('star')}</span>${d.rating} · ${d.num_avaliacoes} avaliações</small></div></div>`).join('')}</div></section>
   <div class="banner b-red"><span class="b-ico">${ic('percent')}</span><div class="txt"><h3>Onde ficar em Angola</h3><p>${lista('alojamentos').length} alojamentos em ${new Set(lista('alojamentos').map(a => a.provincia)).size} províncias: hotéis, resorts e pousadas reais.</p></div><button class="btn btn-gold" data-go="alojamentos">Ver alojamentos ${ic('chev')}</button></div>
   <section class="section"><div class="sec-head"><h2>Experiências para si</h2><button class="link" data-go="experiencias">Ver todas ${ic('chev')}</button></div>
    <div class="grid">${xps.map(xpCard).join('')}</div></section>
   <section class="section"><div class="sec-head"><h2>Próximos eventos</h2><button class="link" data-go="eventos">Ver todos ${ic('chev')}</button></div>
    <div class="row-scroll">${lista('eventos').slice(0, 4).map(evCard).join('')}</div></section>
   <section class="section"><div class="sec-head"><h2>Porquê escolher o Angola 365º?</h2></div>
    <div class="why card" style="padding:22px 12px">
     <div><span style="color:var(--red)">${ic('shield')}</span><b>Seguro</b>Viagens com segurança</div>
     <div><span style="color:var(--gold)">${ic('headset')}</span><b>Suporte 24h</b>Estamos sempre aqui</div>
     <div><span>${ic('badge')}</span><b>Confiável</b>Parceiros verificados e avaliados</div>
     <div><span style="color:var(--gold)">${ic('lock')}</span><b>Pagamento seguro</b>Transacções protegidas</div>
    </div></section>
  </div>`;
};

function destCard(d) { return `<article class="card hcard"><div class="pic"><img src="${d.imagem}" alt="${esc(d.nome)}">${favBtn('destino', d.id)}</div><div class="body"><h3>${esc(d.nome)}</h3><span class="meta">${ic('pin')}${esc([d.municipio, d.provincia].filter(Boolean).join(' · '))}</span>${navLinks(d)}<p class="desc">${esc(d.descricao)}</p><div class="foot">${stars(d.rating)}${catPill(d.categoria)}<button class="k-explain-btn" data-k-explain="destino:${d.id}">${ic('chat')}ENDA explica</button></div></div></article>`; }
V.destinos = () => {
  const cat = S.f.dcat || 'Todos', q = S.f.q_dest || '', ord = S.f.dord || 'Popular';
  const L = lista('destinos').filter(d => (cat === 'Todos' || d.categoria === cat) && match(d.nome + ' ' + d.provincia + ' ' + d.descricao + ' ' + (d.palavras_chave || ''), q));
  L.sort(ord === 'Avaliação' ? (a, b) => b.rating - a.rating : ord === 'Nome' ? (a, b) => a.nome.localeCompare(b.nome) : (a, b) => b.num_avaliacoes - a.num_avaliacoes);
  return pageHead('Destinos', 'Explore os melhores lugares de Angola', I('luanda')) + `<div class="wrap">${search('dest', 'Para onde deseja ir?', { navy: 1 })}
   ${chips('dcat', [['Todos', 'grid'], ['Praias', 'palm', '#1F9E8A'], ['Natureza', 'mountain', '#2F7D45'], ['Cultura', 'museum', '#E2650F'], ['Aventura', 'hike', '#7A3FC8'], ['Cidades', 'city', '#1E63C9']])}
   <div class="sec-head" style="margin-top:12px"><h2>Descubra destinos incríveis</h2><label class="sort">Ordenar por <select id="dord" data-sel="dord">${['Popular', 'Avaliação', 'Nome'].map(o => `<option ${o === ord ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div>
   <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,460px),1fr))">${L.map(destCard).join('') || empty('Nenhum destino corresponde à pesquisa.')}</div>
   <div class="banner b-navy"><span class="b-ico">${ic('compass')}</span><div class="txt"><h3>Não sabe por onde começar?</h3><p>Deixe a ENDA sugerir destinos perfeitos para si.</p></div><button class="btn btn-goldgrad" data-k-ask="Sugere-me um passeio">Recomendar para mim ${ic('chev')}</button></div></div>`;
};

function xpCard(x) { return `<article class="card vcard"><div class="pic"><img src="${x.imagem}" alt="${esc(x.titulo)}">${favBtn('experiencia', x.id)}<span class="pill" style="background:${catBg[x.categoria]}">${x.categoria}</span></div><div class="body"><h3>${esc(x.titulo)}</h3><span class="meta">${ic('pin')}${esc(x.local)}</span><p class="desc">${esc(x.descricao)}</p><div class="foot">${stars(x.rating, x.num_avaliacoes)}<span class="price"><small>A partir de</small><b class="num" style="color:${catBg[x.categoria]}">${kz(x.preco)}</b></span></div><button class="btn btn-navy" style="margin-top:6px" data-open-xp="${x.id}">Ver experiência</button></div></article>`; }
V.experiencias = () => {
  const cat = S.f.xcat || 'Todas', q = S.f.q_xp || '';
  const L = lista('experiencias').filter(x => (cat === 'Todas' || x.categoria === cat) && match(x.titulo + ' ' + x.local + ' ' + x.descricao, q));
  return pageHead('Experiências', 'Viva momentos únicos em Angola', I('xp_kal')) + `<div class="wrap">${search('xp', 'O que gostaria de viver?', { navy: 1 })}
   ${chips('xcat', [['Todas', 'grid'], ['Aventura', 'hike', '#2F7D45'], ['Cultura', 'museum', '#E2650F'], ['Natureza', 'leaf', '#2F7D45'], ['Gastronomia', 'food', '#7A3FC8'], ['Bem-estar', 'lotus', '#C8102E']])}
   <section class="section" style="margin-top:14px"><div class="sec-head"><h2>${cat === 'Todas' ? 'Experiências em destaque' : cat}</h2><span class="meta">${L.length} experiência${L.length === 1 ? '' : 's'}</span></div>
   <div class="grid">${L.map(xpCard).join('') || empty('Ainda não há experiências nesta categoria.')}</div></section>
   <div class="banner b-navy"><span class="b-ico">${ic('crown')}</span><div class="txt"><h3>Angola 365º Premium</h3><p>Acesso a experiências exclusivas e benefícios especiais.</p></div><button class="btn btn-goldgrad" data-toast="Plano Premium: 4.900 Kz/mês. Disponível em breve.">Conhecer benefícios ${ic('chev')}</button></div></div>`;
};

V.experiencia = () => {
  const x = item('experiencia', S.detail) || lista('experiencias')[0];
  if (!x) return empty('Experiência não encontrada.');
  const gal = x.galeria?.length ? x.galeria : [x.imagem];
  const icInc = ['guide', 'car', 'bottle', 'camera', 'shield'];
  const jaAvaliou = S.avals.some(a => a._minha);
  return `<header class="dhero"><img src="${gal[0]}" alt="${esc(x.titulo)}"><div class="tools"><div class="wrap" style="display:flex;justify-content:space-between;width:100%"><button class="circle" data-go="experiencias" aria-label="Voltar">${ic('back')}</button><span style="display:flex;gap:10px">${favBtn('experiencia', x.id).replace('class="fav"', 'class="fav" style="position:static"')}<button class="circle" data-copy="${esc(x.titulo)}" aria-label="Partilhar">${ic('share')}</button></span></div></div>
   <div class="wrap in" style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><span class="pill" style="background:${catBg[x.categoria]};color:#fff">${x.categoria}</span><h1>${esc(x.titulo)}</h1><p class="meta" style="color:#eee;margin-top:8px">${ic('pin')}${esc(x.local)}, Angola &nbsp; <span class="star">${ic('star')}</span><b>${x.rating}</b> (${x.num_avaliacoes} avaliações)</p></div><div class="pricebox"><small>A partir de</small><b class="num">${kz(x.preco)}</b></div></div></header>
  <div class="wrap">
   <div class="facts"><div><span style="color:var(--green)">${ic('clock')}</span>Duração<b>${esc(x.duracao || '—')}</b></div><div><span style="color:var(--orange)">${ic('users')}</span>Grupo<b>${x.grupo_min} – ${x.grupo_max} pessoas</b></div><div><span style="color:var(--blue)">${ic('cal')}</span>Disponibilidade<b>${esc(x.disponibilidade || '—')}</b></div><div><span style="color:var(--purple)">${ic('lang')}</span>Idiomas<b>${esc(x.idiomas || 'PT')}</b></div></div>
   <div class="two section"><div style="display:flex;flex-direction:column;gap:28px;min-width:0">
     <section><h2 style="font-size:19px;margin-bottom:8px">Sobre a experiência</h2><p style="max-width:65ch">${esc(x.descricao_longa || x.descricao)}</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><button class="btn btn-ghost" data-k-explain="experiencia:${x.id}">${ic('chat')} ENDA explica em voz alta</button><button class="btn btn-ghost" data-k-invite="experiencia:${x.id}">${ic('share')} Convidar amigos</button></div></section>
     ${x.inclui?.length ? `<section><h2 style="font-size:19px;margin-bottom:12px">O que está incluído</h2><div class="incl">${x.inclui.map((t, i) => `<div>${ic(icInc[i] || 'check')}${esc(t)}</div>`).join('')}</div></section>` : ''}
     <section><div class="sec-head"><h2>Galeria</h2><span class="meta">${gal.length} foto${gal.length === 1 ? '' : 's'} · toque para ampliar</span></div><div class="gallery">${gal.slice(0, 4).map((g, i) => `<button data-lb="${i}" aria-label="Ampliar foto ${i + 1}"><img src="${g}" alt=""></button>`).join('')}</div></section>
   </div>
   <aside class="card" style="padding:18px;display:flex;flex-direction:column;gap:14px;align-self:start">
     <div style="display:flex;align-items:center;gap:12px"><span class="b-ico" style="background:var(--gold);color:#fff;border:0">${ic('star')}</span><div><b>Avaliações dos viajantes</b><p class="meta">Média ${x.rating} · ${x.num_avaliacoes} avaliações</p></div></div>
     ${S.avals.slice(0, 5).map(a => `<div style="border-top:1px solid var(--line);padding-top:12px"><b style="font-size:14px">${esc(a.autor_nome)}</b> <span class="meta" style="display:inline">${a.autor_cidade ? '· ' + esc(a.autor_cidade) : ''} · ${'★'.repeat(a.nota)}</span><p class="desc" style="margin-top:4px">${esc(a.comentario || '')}</p></div>`).join('') || '<p class="meta">Ainda sem comentários. Seja o primeiro.</p>'}
     ${jaAvaliou ? '' : `<form data-review="experiencia:${x.id}" class="review-form"><b style="font-size:14px">Deixe a sua avaliação</b><div class="rate" role="radiogroup" aria-label="Nota">${[5, 4, 3, 2, 1].map(n => `<input type="radio" id="nt${n}" name="nota" value="${n}" ${n === 5 ? 'checked' : ''}><label for="nt${n}" title="${n} estrela${n > 1 ? 's' : ''}">★</label>`).join('')}</div><textarea name="comentario" rows="3" maxlength="800" placeholder="Como foi a experiência?"></textarea><button class="btn btn-ghost" type="submit">${ic('check')} Publicar avaliação</button></form>`}
   </aside></div>
   <div class="bookbar"><div class="pr"><small>A partir de</small><b class="num">${kz(x.preco)}</b><small>por pessoa</small></div><span class="meta" style="flex:1">${ic('shield')} Reserva segura e confirmação imediata</span><button class="btn btn-goldgrad" data-book="experiencia:${x.id}">Reservar agora</button></div>
  </div>`;
};

function alCard(a) {
  const p = precoAl(a), parceiro = a.parceiro !== 0;
  return `<article class="card hcard"><div class="pic"><img src="${a.imagem}" alt="${esc(a.nome)}" loading="lazy">${a.oferta_pct && parceiro ? `<span class="pill" style="background:var(--red);color:#fff;left:12px;top:12px;position:absolute">−${a.oferta_pct}%</span>` : ''}</div><div class="body"><div style="display:flex;justify-content:space-between;gap:8px"><div style="min-width:0">${a.etiqueta ? `<span class="pill ${TIPO_AL_PILL[a.tipo] || 'p-green'}">${esc(a.etiqueta)}</span>` : ''}<h3 style="margin-top:4px">${esc(a.nome)}</h3></div>${favBtn('alojamento', a.id, 1)}</div><span class="meta">${ic('pin')}${esc(a.local)}</span>${stars(a.rating, a.num_avaliacoes)}<span class="meta" style="gap:12px;flex-wrap:wrap">${(a.comodidades || []).map(t => `<span class="meta">${ic(AMEN_IC[t] || 'check')}${esc(t)}</span>`).join('')}</span>${parceiro ? '' : seloFonte(a)}<div class="foot">${parceiro && p != null ? `<span class="price" style="text-align:left"><small style="text-align:left">A partir de</small>${a.oferta_pct ? `<s class="meta num" style="display:inline">${kz(a.preco_noite)}</s> ` : ''}<b class="num">${kz(p)}</b> <small style="display:inline">/ noite</small></span><button class="btn btn-navy" data-book="alojamento:${a.id}">Reservar</button>` : `<span class="price" style="text-align:left"><small style="text-align:left">Preço</small><b>Sob consulta</b></span>${btnPedir('alojamento', a.id)}`}</div></div></article>`;
}
V.alojamentos = () => {
  const t = S.f.acat || 'Todos', q = S.f.q_al || '', ord = S.f.aord || 'Recomendados';
  const L = lista('alojamentos').filter(a => (t === 'Todos' || a.tipo === t) && match(a.nome + ' ' + a.local + ' ' + (a.provincia || ''), q));
  if (ord === 'Menor preço') L.sort((a, b) => (precoAl(a) ?? 1e12) - (precoAl(b) ?? 1e12)); if (ord === 'Maior avaliação') L.sort((a, b) => b.rating - a.rating);
  const oferta = lista('alojamentos').filter(a => a.oferta_pct && a.parceiro !== 0).sort((a, b) => b.oferta_pct - a.oferta_pct)[0];
  return pageHead('Alojamentos', 'Encontre o lugar perfeito para ficar', I('h_resort')) + `<div class="wrap">${search('al', 'Para onde deseja ir?', { navy: 1 })}
   ${chips('acat', [['Todos', 'building'], ['Hotéis', 'hotel', '#1E63C9'], ['Pousadas', 'house', '#2F7D45'], ['Resorts', 'palm', '#E2650F'], ['Apartamentos', 'building', '#7A3FC8'], ['Villas', 'house', '#C8102E']])}
   ${oferta ? `<div class="banner b-navy" style="margin-top:12px;padding:0;align-items:stretch"><div class="txt" style="padding:22px"><h3>Ofertas Exclusivas</h3><p style="margin-bottom:14px">${oferta.oferta_pct}% OFF no ${esc(oferta.nome)}: ${kz(precoAl(oferta))} por noite em vez de ${kz(oferta.preco_noite)}.</p><button class="btn btn-goldgrad" data-book="alojamento:${oferta.id}">Reservar oferta ${ic('chev')}</button></div><img src="${I('al_banner')}" alt="Quarto com vista para o mar" style="width:min(45%,360px);min-height:160px;object-fit:cover"></div>` : ''}
   <section class="section"><div class="sec-head"><h2>Alojamentos em destaque</h2><label class="sort">Ordenar por <select id="aord" data-sel="aord">${['Recomendados', 'Menor preço', 'Maior avaliação'].map(o => `<option ${o === ord ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div>
   <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,500px),1fr))">${L.map(alCard).join('') || empty('Sem alojamentos para este filtro.')}</div></section>
   <div class="banner" style="background:var(--orange-bg);color:var(--fg)"><span class="b-ico">${ic('headset')}</span><div class="txt"><h3 style="color:var(--fg);font-size:16px">Precisa de ajuda para escolher?</h3><p style="color:var(--muted)">Envie-nos um pedido e um especialista responde em até 24 horas.</p></div><button class="btn btn-ghost" data-suporte="Ajuda a escolher alojamento">${ic('chat')} Falar agora</button></div></div>`;
};

const CONF_EV = { oficial: ['Confirmado', 'p-green'], 'fonte identificada': ['Fonte identificada', 'p-blue'], 'notícia': ['Notícia', 'p-purple'], 'por confirmar': ['Por confirmar', 'p-orange'], rumor: ['Rumor — não confirmado', 'p-red'] };
const naoConfirmado = e => ['rumor', 'notícia', 'por confirmar'].includes(e.confianca);
function evCard(e) {
  const d = new Date(e.data + 'T12:00'); const livres = e.lotacao - e.bilhetes_vendidos; const cf = CONF_EV[e.confianca];
  const fim = e.data_fim && e.data_fim !== e.data ? ' – ' + dfmt(e.data_fim) : '';
  const hora = e.hora && e.hora !== '00:00' ? ' · ' + e.hora : '';
  let acao;
  if (e.estado === 'cancelado') acao = `<span class="pill p-red">Cancelado</span>`;
  else if (e.bilhetes_url) acao = `<a class="btn btn-navy" style="flex:1" href="${esc(e.bilhetes_url)}" target="_blank" rel="noopener">${ic('ticket')} Bilhetes em ${esc(hostDe(e.bilhetes_url))}</a>`;
  else if (naoConfirmado(e)) acao = e.fonte_url ? `<a class="btn btn-ghost" style="flex:1" href="${esc(e.fonte_url)}" target="_blank" rel="noopener">${ic('globe')} Ver a fonte</a>` : '';
  else acao = `<button class="btn btn-navy" style="flex:1" data-book="evento:${e.id}" ${livres <= 0 ? 'disabled' : ''}>${livres <= 0 ? 'Esgotado' : e.preco ? 'Comprar bilhete' : 'Garantir lugar'}</button>`;
  const preco = e.preco_texto ? `<span class="meta">${esc(e.preco_texto)}</span>` : naoConfirmado(e) || e.bilhetes_url ? '' : e.preco ? `<span class="meta">A partir de <b class="num" style="color:${catBg[e.categoria]};font-size:16px">${kz(e.preco)}</b></span>` : `<b style="color:var(--orange)">Entrada gratuita</b>`;
  return `<article class="card vcard${e.confianca === 'rumor' ? ' rumor' : ''}"><div class="pic"><img src="${e.imagem}" alt="${esc(e.titulo)}" loading="lazy"><span class="datebox num" style="background:${catBg[e.categoria] || 'var(--navy)'}">${String(d.getDate()).padStart(2, '0')}<small>${MESES[d.getMonth()]}</small></span>${favBtn('evento', e.id)}<span class="pill" style="background:${catBg[e.categoria]}">${e.categoria}</span></div><div class="body"><h3>${esc(e.titulo)}</h3>
   <div style="display:flex;gap:6px;flex-wrap:wrap">${cf ? `<span class="pill ${cf[1]}">${cf[0]}</span>` : ''}${e.estado === 'adiado' ? '<span class="pill p-orange">Adiado</span>' : ''}</div>
   <span class="meta">${ic('pin')}${esc(e.local)}${e.municipio ? ` · ${esc(e.municipio)}` : ''}</span><span class="meta">${ic('cal')}${dfmt(e.data)}${fim}${hora}</span>
   ${e.fonte_url ? `<a class="meta fonte" href="${esc(e.fonte_url)}" target="_blank" rel="noopener">${ic('globe')}Fonte: ${esc(e.fonte_nome || hostDe(e.fonte_url))}</a>` : ''}
   <div class="foot">${preco}${!naoConfirmado(e) && !e.bilhetes_url && livres <= 0 ? '<span class="pill p-red">Esgotado</span>' : !naoConfirmado(e) && !e.bilhetes_url && livres < 100 ? `<span class="pill p-orange num">Últimos ${livres}</span>` : ''}</div>
   <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">${acao}${e.latitude != null ? `<a class="btn btn-ghost" style="padding:12px" href="https://www.google.com/maps/dir/?api=1&destination=${e.latitude},${e.longitude}" target="_blank" rel="noopener" aria-label="Como chegar">${ic('map')}</a>` : ''}<button class="btn btn-ghost" style="padding:12px" data-k-invite="evento:${e.id}" aria-label="Convidar amigos">${ic('share')}</button></div></div></article>`;
}
V.eventos = () => {
  const c = S.f.ecat || 'Todos', q = S.f.q_ev || '', dt = S.f.d_ev || '';
  const cf = S.f.econf || 'Todos';
  const L = lista('eventos').filter(e => (c === 'Todos' || e.categoria === c) && match(e.titulo + ' ' + e.local + ' ' + (e.municipio || ''), q) && (!dt || (e.data_fim || e.data) >= dt) && (cf === 'Todos' || (cf === 'Confirmados' ? !naoConfirmado(e) : naoConfirmado(e))));
  return pageHead('Eventos', 'Viva experiências inesquecíveis em Angola', I('ev_jazz')) + `<div class="wrap">${search('ev', 'O que deseja encontrar?', { navy: 1, dates: 1 })}
   ${chips('ecat', [['Todos', 'grid'], ['Música', 'music', '#7A3FC8'], ['Cultura', 'mask', '#E2650F'], ['Festivais', 'star', '#D6336C'], ['Esportes', 'run', '#2F7D45'], ['Gastronomia', 'glass', '#C8102E'], ['Família', 'users', '#1F9E8A'], ['Negócios', 'brief', '#1E63C9']])}
   ${chips('econf', [['Todos', 'list'], ['Confirmados', 'check', '#2F7D45'], ['Notícias e rumores', 'chat', '#C8102E']])}
   <p class="meta" style="margin-top:8px">Pesquisamos todos os dias agendas e notícias públicas. «Rumor» e «Notícia» ainda não foram confirmados pela organização — confirme na fonte antes de ir.</p>
   <section class="section" style="margin-top:14px"><div class="sec-head"><h2>Próximos eventos</h2><span class="meta">${dt ? 'A partir de ' + dfmt(dt) + ' · ' : ''}${L.length} evento${L.length === 1 ? '' : 's'}</span></div>
   <div class="grid">${L.map(evCard).join('') || empty('Nenhum evento encontrado nestas datas.')}</div></section>
   <div class="banner b-navy"><span class="b-ico">${ic('ticket')}</span><div class="txt"><h3>Garanta o seu lugar!</h3><p>Compre os seus bilhetes com segurança e encontre-os sempre nas suas reservas.</p></div><button class="btn btn-goldgrad" data-go="reservas">Ver os meus bilhetes ${ic('chev')}</button></div></div>`;
};

V.gastronomia = () => {
  const c = S.f.gcat || 'Todos', q = S.f.q_g || '';
  const P2 = lista('pratos').filter(p => (c === 'Todos' || c === p.categoria) && match(p.nome + ' ' + p.descricao, q));
  const R = lista('restaurantes').filter(r => match(r.nome + ' ' + r.local + ' ' + (r.especialidade || ''), q));
  return pageHead('Gastronomia', 'Descubra os sabores autênticos de Angola', I('f_muamba'), 'brown') + `<div class="wrap">${search('g', 'O que deseja saborear?', {})}
   ${chips('gcat', [['Todos', 'grid'], ['Pratos', 'pot', '#E2650F'], ['Doces', 'cake', '#D6336C'], ['Bebidas', 'cup', '#2F7D45'], ['Restaurantes', 'food', '#7A3FC8'], ['Comida de rua', 'streetfood', '#1F9E8A']], 'brown')}
   ${c !== 'Restaurantes' ? `<section class="section" style="margin-top:14px"><div class="sec-head"><h2>Sabores em destaque</h2></div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">${P2.map((p, i) => `<article class="card vcard"><div class="pic"><img src="${p.imagem}" alt="${esc(p.nome)}">${favBtn('prato', p.id)}${p.etiqueta ? `<span class="pill ${PRATO_PILL[i % 4]}" style="color:inherit">${esc(p.etiqueta)}</span>` : ''}</div><div class="body"><h3>${esc(p.nome)}</h3><p class="desc">${esc(p.descricao)}</p><div class="foot">${stars(p.rating, p.num_avaliacoes)}<button class="k-explain-btn" data-prato="${p.id}">${ic('list')}Ingredientes e onde comer</button></div></div></article>`).join('') || empty(c === 'Bebidas' || c === 'Comida de rua' ? 'Brevemente: estamos a recolher os melhores locais desta categoria.' : 'Nada encontrado.')}</div></section>` : ''}
   <section class="section"><div class="sec-head"><h2>Restaurantes recomendados</h2></div>
   <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,500px),1fr))">${R.map(r => { const parceiro = r.parceiro !== 0; return `<article class="card hcard"><div class="pic"><img src="${r.imagem}" alt="${esc(r.nome)}" loading="lazy"></div><div class="body"><div style="display:flex;justify-content:space-between;gap:8px"><h3>${esc(r.nome)}</h3>${favBtn('restaurante', r.id, 1)}</div><span class="meta">${ic('pin')}${esc(r.endereco || r.local)}${r.municipio ? ` · ${esc(r.municipio)}` : ''}</span>${navLinks(r)}<p class="desc">${esc(r.descricao)}</p><span class="meta" style="gap:10px;flex-wrap:wrap">${stars(r.rating, r.num_avaliacoes)}<b>${r.nivel_preco}</b><span>${esc(r.especialidade || '')}</span></span>${parceiro ? '' : seloFonte(r)}<div class="foot">${parceiro && r.preco_medio != null ? `<span class="price" style="text-align:left"><small style="text-align:left">A partir de</small><b class="num">${kz(r.preco_medio)}</b> <small style="display:inline">/ pessoa</small></span><button class="btn btn-navy" data-book="restaurante:${r.id}">Reservar mesa</button>` : `<span class="price" style="text-align:left"><small style="text-align:left">Preço</small><b>${r.nivel_preco}</b></span>${btnPedir('restaurante', r.id)}`}</div></div></article>`; }).join('') || empty('Nenhum restaurante encontrado.')}</div></section>
   <div class="banner b-brown"><span class="b-ico">${ic('crown')}</span><div class="txt"><h3>Angola 365º Premium</h3><p>Experiências gastronómicas exclusivas e descontos em restaurantes seleccionados.</p></div><button class="btn btn-gold" data-toast="Plano Premium: 4.900 Kz/mês. Disponível em breve.">Quero ser Premium ${ic('chev')}</button></div></div>`;
};

const LOCAIS = ['Luanda', 'Benguela', 'Lubango', 'Malanje', 'Namibe', 'Aeroporto AIAAN'];
function rentAtual() { return S.f.rent || { loc: 'Luanda', ini: somaDias(hojeISO(), 6), fim: somaDias(hojeISO(), 9) }; }
V.viaturas = () => {
  const cat = S.f.ccat || '', r = rentAtual();
  const CARS = lista('viaturas');
  const L = CARS.filter(c => !cat || c.categoria === cat);
  const dias = Math.max(1, Math.round((new Date(r.fim) - new Date(r.ini)) / 864e5));
  const cats = ['Económicos', 'SUVs', 'Sedans', 'Luxo', 'Vans'].map(n => { const cs = CARS.filter(c => c.categoria === n); const pr = cs.map(c => c.preco_promo || c.preco_dia).filter(v => v != null).sort((a, b) => a - b); return cs.length ? [n, pr[0] ?? null, cs[0].imagem, cs.length] : null; }).filter(Boolean);
  const empresas = [...new Set(CARS.map(c => c.empresa).filter(Boolean))];
  const promo = CARS.find(c => c.preco_promo && c.parceiro !== 0);
  return `<header class="page-head" style="background:#0E1A2E"><img class="bg" style="opacity:.9;object-position:right" src="${I('c_suv')}" alt=""><div class="wrap in" style="padding-bottom:80px"><button class="circle" data-go="inicio" aria-label="Voltar">${ic('back')}</button><div style="flex:1"><h1>Aluguer de Viaturas</h1><p>Liberdade para explorar Angola ao seu ritmo.</p></div></div></header>
  <div class="wrap">
   <form class="rent-form" data-rent>
    <label for="r-loc">Local de levantamento<select id="r-loc" name="loc">${LOCAIS.map(l => `<option ${l === r.loc ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label for="r-ini">Data de levantamento<input id="r-ini" name="ini" type="date" min="${hojeISO()}" value="${r.ini}"></label>
    <label for="r-fim">Data de devolução<input id="r-fim" name="fim" type="date" min="${hojeISO()}" value="${r.fim}"></label>
    <label for="r-cat">Tipo de veículo<select id="r-cat" name="cat"><option value="">Todos os tipos</option>${cats.map(([c]) => `<option ${c === cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <button class="btn btn-navy" type="submit">${ic('search')} Procurar veículos</button>
   </form>
   <div class="perks">${[['badge', 'Melhores preços garantidos'], ['shield', 'Cancelamento grátis'], ['gauge', 'Quilometragem ilimitada'], ['shield', 'Seguro incluído'], ['headset', 'Suporte 24/7']].map(([i, t]) => `<div>${ic(i)}${t}</div>`).join('')}</div>
   <section class="section"><div class="sec-head"><h2>Categorias de veículos</h2></div><div class="row-scroll" style="grid-auto-columns:minmax(150px,1fr)">${cats.map(([n, p, im, k]) => `<button class="cat-car" data-chip="ccat" data-v="${n}" aria-pressed="${cat === n}"><img src="${im}" alt="" loading="lazy"><b>${n}</b>${p != null ? `<small>A partir de</small><span class="p num">${kz(p)} <small>/dia</small></span>` : `<small>${k} modelo${k > 1 ? 's' : ''}</small><span class="p">Sob consulta</span>`}</button>`).join('')}</div></section>
   ${promo ? `<div class="banner" style="background:#0E1A2E;padding:0;align-items:stretch"><div class="txt" style="padding:22px"><span class="pill p-green" style="background:var(--green);color:#fff">OFERTA DA SEMANA</span><h3 style="color:#fff;font-size:22px;margin-top:8px">${esc(promo.nome)}</h3><p>Perfeito para as suas aventuras em família.</p><p style="margin-top:8px"><s style="opacity:.6">${kz(promo.preco_dia)}</s> <b style="color:#5ED38C;font-size:20px">${kz(promo.preco_promo)}</b> /dia</p><button class="btn" style="background:#fff;color:var(--ink);margin-top:10px" data-book="viatura:${promo.id}">Reservar agora ${ic('chev')}</button></div><img src="${I('c_offer')}" alt="SUV em estrada de terra" style="width:min(48%,380px);min-height:180px;object-fit:cover"></div>` : ''}
   ${empresas.length ? `<p class="meta" style="margin-top:14px">${ic('car')} Empresas listadas: ${empresas.map(esc).join(', ')}. No Aeroporto de Luanda operam também Avis, Hertz, Sixt e Budget.</p>` : ''}<section class="section" id="carros"><div class="sec-head"><h2>${cat || 'Veículos disponíveis'}</h2><span class="meta">${r.loc} · ${dias} dia${dias > 1 ? 's' : ''}</span></div>
   <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">${L.map(c => { const p = c.preco_promo || c.preco_dia, parceiro = c.parceiro !== 0 && p != null; return `<article class="card vcard"><div class="pic" style="aspect-ratio:16/10"><img src="${c.imagem}" alt="${esc(c.nome)}" loading="lazy">${favBtn('viatura', c.id)}</div><div class="body"><h3>${esc(c.nome)}</h3><span class="meta" style="display:block">${c.empresa ? `<b>${esc(c.empresa)}</b> · ` : ''}${c.categoria}${c.local_levantamento ? ' · ' + esc(c.local_levantamento) : ''}</span><span class="meta" style="gap:10px"><span class="meta">${ic('users')}${c.lugares}</span><span class="meta">${ic('snow')}A/C</span><span class="meta">${ic('gauge')}${esc(c.transmissao)}</span></span>${parceiro ? `<div class="foot"><b class="num" style="color:var(--green);font-size:17px">${kz(p)} <small style="color:var(--muted);font-weight:500">/dia</small></b><span class="meta num">Total ${kz(p * dias)}</span></div><button class="btn btn-navy" data-book="viatura:${c.id}">Reservar</button>` : `<div class="foot"><span class="price" style="text-align:left"><small style="text-align:left">${c.preco_indicativo ? 'Preço indicativo' : 'Preço'}</small><b class="num">${esc(c.preco_indicativo || 'Sob consulta')}</b></span></div>${seloFonte(c)}${btnPedir('viatura', c.id)}`}</div></article>`; }).join('') || empty('Sem veículos nesta categoria.')}</div></section>
   <div class="banner" style="background:var(--green-bg);color:var(--fg)"><span class="b-ico" style="border-color:var(--green);color:var(--green)">${ic('car')}</span><div class="txt"><h3 style="color:var(--fg);font-size:16px">Precisa de ajuda para escolher?</h3><p style="color:var(--muted)">Fale com um dos nossos especialistas e encontre o carro ideal para a sua viagem.</p></div><a class="btn btn-ghost" style="color:var(--green)" href="https://wa.me/244926239938" target="_blank" rel="noopener">${ic('whats')} WhatsApp +244 926 239 938</a></div>
  </div>`;
};

const TX_COR = { Alojamentos: 'var(--red)', Experiências: 'var(--gold)', Transportes: '#141414', Gastronomia: 'var(--red-deep)', Eventos: 'var(--purple)', Tradutores: 'var(--blue)', Carregamento: 'var(--green)', Ajuste: 'var(--blue)' };
const TX_IC = { Alojamentos: 'hotel', Experiências: 'mountain', Transportes: 'car', Gastronomia: 'food', Eventos: 'ticket', Tradutores: 'lang', Carregamento: 'plus', Ajuste: 'wallet' };
const TX_EST = { pago: ['Pago', 'p-green'], concluido: ['Concluído', 'p-green'], pendente: ['Pendente', 'p-orange'], reembolsado: ['Reembolsado', 'p-blue'], falhado: ['Cancelado', 'p-red'] };
V.pagamentos = () => {
  const c = S.carteira || { transacoes: [] };
  const tabs = ['Todas', 'Experiências', 'Alojamentos', 'Eventos', 'Transportes', 'Gastronomia', 'Tradutores', 'Carregamentos'];
  const L = c.transacoes.filter(t => S.txTab === 'Todas' || t.categoria === S.txTab || (S.txTab === 'Carregamentos' && t.tipo !== 'pagamento'));
  return pageHead('Carteira e pagamentos', 'Seguros, rápidos e 100% protegidos', I('hero'), 'red') + `<div class="wrap">
   <div class="wallet"><div><small>Saldo na carteira</small><div class="bal num">${S.hideBal ? '••••••' : kz(S.user.saldo)} <button data-hide aria-label="Mostrar ou ocultar saldo" style="color:#B4B4BE">${ic('eye')}</button></div><div class="pts">${ic('star')} <span class="num">${grp(S.user.pontos)} pts</span> <small style="font-weight:500">· Pontos Angola 365º</small></div></div><button class="btn btn-gold" data-topup>${ic('plus')} Adicionar saldo</button></div>
   <section class="section"><div class="sec-head"><h2>Acções rápidas</h2></div><div class="acts">${[['plus', 'Carregar carteira', 'data-topup'], ['ticket', 'As minhas reservas', 'data-go="reservas"'], ['bank', 'Transferência bancária', 'data-toast="IBAN para carregamento: AO06 0040 0000 1234 5678 1019 1 · referência TD360."'], ['receipt', 'Histórico de pagamentos', 'data-scroll="hist"'], ['headset', 'Ajuda com um pagamento', 'data-suporte="Problema com um pagamento"']].map(([i, t, a]) => `<button ${a}>${ic(i)}${t}</button>`).join('')}</div></section>
   <section class="section" id="hist"><div class="sec-head"><h2>Os meus movimentos</h2><span class="meta num">${L.length} registo${L.length === 1 ? '' : 's'}</span></div>
    <div class="tabs" role="tablist">${tabs.map(t => `<button role="tab" aria-selected="${S.txTab === t}" data-txtab="${t}">${t}</button>`).join('')}</div>
    <div class="card" style="margin-top:12px">${L.map(t => { const d = dataSQL(t.criado_em); const cred = t.tipo !== 'pagamento'; const [el, ec] = TX_EST[t.estado] || [t.estado, 'p-blue']; return `<div class="tx"><img src="${t.imagem || I('hero')}" alt=""><span class="ti" style="background:${TX_COR[t.categoria] || 'var(--navy)'}">${ic(TX_IC[t.categoria] || (t.tipo === 'reembolso' ? 'swap' : 'card'))}</span><div style="min-width:0"><b>${esc(t.descricao)}</b><small>${esc(t.categoria || '')} · ${d.toLocaleDateString(I18N.loc)} · ${d.toLocaleTimeString(I18N.loc, { hour: '2-digit', minute: '2-digit' })}${t.metodo ? ' · ' + esc(t.metodo) : ''}</small></div><div class="amt num" ${cred ? 'style="color:var(--green)"' : ''}>${cred ? '+' : ''}${kz(t.valor)}<br><span class="pill ${ec}">${el}</span></div></div>`; }).join('') || '<div class="empty">Sem movimentos nesta categoria.</div>'}</div></section>
   <div class="banner b-red"><span class="b-ico">${ic('star')}</span><div class="txt"><h3>Pague com Angola 365º e ganhe mais benefícios!</h3><p>Acumule 1 ponto por cada 100 Kz e troque por descontos exclusivos.</p></div></div>
   <section class="section"><div class="sec-head"><h2>Formas de pagamento</h2></div><div class="card methods">
    <div class="m"><span class="mlogo" style="background:#1A1F71;color:#fff">MC</span><div style="flex:1"><b>•••• 4587</b><p class="meta">Válido até 08/28</p></div><span class="pill p-red">Padrão</span></div>
    <div class="m"><span class="mlogo" style="background:#FF7A00;color:#fff">UNITEL</span><div style="flex:1"><b>Unitel Money</b><p class="meta num">${esc(S.user.telefone || 'Associe o seu número no perfil')}</p></div></div>
    <div class="m"><span class="mlogo" style="background:#E30613;color:#fff">MCX</span><div style="flex:1"><b>Multicaixa Express</b><p class="meta">Pagamento por referência · confirmado pela equipa</p></div></div>
   </div></section></div>`;
};

const RES_EST = { pendente: ['A aguardar pagamento', 'p-orange'], confirmada: ['Confirmada', 'p-green'], concluida: ['Concluída', 'p-blue'], cancelada: ['Cancelada', 'p-red'] };
V.reservas = () => {
  const H = hojeISO(); const R = S.reservas || [];
  const grupos = {
    'Próximas': R.filter(r => r.estado === 'confirmada' && (r.data_fim || r.data_inicio || H) >= H),
    'Pendentes': R.filter(r => r.estado === 'pendente'),
    'Histórico': R.filter(r => r.estado === 'concluida' || (r.estado === 'confirmada' && (r.data_fim || r.data_inicio || H) < H)),
    'Canceladas': R.filter(r => r.estado === 'cancelada'),
  };
  const L = grupos[S.resTab] || [];
  return pageHead('As minhas reservas', 'Bilhetes, estadias e passeios num só lugar', I('ev_festival')) + `<div class="wrap section">
   <div class="tabs" role="tablist">${Object.keys(grupos).map(t => `<button role="tab" aria-selected="${S.resTab === t}" data-restab="${t}">${t} <span class="num" style="opacity:.6">${grupos[t].length}</span></button>`).join('')}</div>
   <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,480px),1fr));margin-top:14px">${L.map(r => { const [el, ec] = RES_EST[r.estado]; const podeCancelar = ['pendente', 'confirmada'].includes(r.estado) && (!r.data_inicio || r.data_inicio > H); return `<article class="card hcard res"><div class="pic"><img src="${r.imagem || I('hero')}" alt=""></div><div class="body"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><span class="pill ${ec}">${el}</span><span class="meta num" style="font-weight:700">${r.codigo}</span></div><h3>${esc(r.item_nome)}</h3><span class="meta">${ic('cal')}${r.data_inicio ? dlong(r.data_inicio) : '—'}${r.data_fim ? ' → ' + dlong(r.data_fim) : ''}${r.notas && /^\d{2}:\d{2}$/.test(r.notas) ? ' · ' + r.notas : ''}</span><span class="meta">${ic('users')}${r.quantidade} ${r.unidade}${r.quantidade > 1 ? 's' : ''} · ${esc(r.metodo_pagamento)}</span><div class="foot"><b class="num" style="font-size:17px">${kzOuGratis(r.total)}</b><span style="display:flex;gap:6px">${r.estado !== 'cancelada' ? `<button class="btn btn-ghost" style="padding:8px 12px;font-size:13px" data-bilhete="${r.id}">${ic('ticket')} Ver</button>` : ''}${podeCancelar ? `<button class="btn btn-ghost" style="padding:8px 12px;font-size:13px;color:var(--red)" data-cancelar="${r.id}">Cancelar</button>` : ''}</span></div></div></article>`; }).join('') || empty(S.resTab === 'Próximas' ? 'Ainda não tem reservas futuras. Explore experiências e eventos e reserve em segundos.' : 'Nada por aqui.')}</div>
   <div class="banner b-navy"><span class="b-ico">${ic('compass')}</span><div class="txt"><h3>Planeie a próxima aventura</h3><p>A ENDA monta-lhe um roteiro de 1 a 3 dias com base no que gosta.</p></div><button class="btn btn-goldgrad" data-k-ask="Roteiro de 3 dias">Pedir roteiro ${ic('chev')}</button></div></div>`;
};

V.tradutores = () => {
  const l = S.f.tlang || 'Todos', q = S.f.q_tr || '', tab = S.f.ttab || 'Perto de si';
  let L = lista('tradutores').filter(t => (l === 'Todos' || t.idiomas.includes(l) || l === 'Português') && match(t.nome + ' ' + t.idiomas.join(' '), q));
  if (tab === 'Melhor avaliados') L = [...L].sort((a, b) => b.rating - a.rating); else if (tab === 'Disponíveis agora') L = L.filter(t => t.disponivel); else L = [...L].sort((a, b) => a.distancia_km - b.distancia_km);
  return pageHead('Tradutores', 'Comunique sem fronteiras. Encontre tradutores perto de si.', I('hero'), 'red') + `<div class="wrap">${search('tr', 'Procure por idioma ou especialidade', {})}
   <p style="margin-top:20px;font-weight:700;font-size:13px">Idioma de que precisa</p>
   ${chips('tlang', [['Todos', 'lang'], ['Inglês', 'flag:🇬🇧'], ['Francês', 'flag:🇫🇷'], ['Português', 'flag:🇵🇹'], ['Mandarim', 'flag:🇨🇳'], ['Espanhol', 'flag:🇪🇸']], 'red')}
   <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 16px"><span style="color:var(--red)">${ic('pin')}</span><div style="flex:1"><small class="meta">A minha localização</small><b>Luanda, Angola</b></div><span class="link" style="font-size:13px">Talatona</span></div>
   <div class="banner b-red"><div class="txt"><h3 style="color:#fff;font-size:20px">Viaje tranquilo, comunique melhor!</h3><p>Tradutores verificados e avaliados para tornar a sua experiência em Angola inesquecível. Olá · Hello · Bonjour · 你好 · Mbote</p></div></div>
   <div class="tabs" role="tablist" style="margin-top:22px">${['Perto de si', 'Melhor avaliados', 'Disponíveis agora'].map(t => `<button role="tab" aria-selected="${tab === t}" data-chip="ttab" data-v="${t}">${t}</button>`).join('')}</div>
   <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,500px),1fr));margin-top:14px">${L.map(t => `<article class="card tr"><div class="av"><img src="${t.imagem}" alt="${esc(t.nome)}">${t.disponivel ? '<span class="online"></span>' : ''}</div><div style="min-width:0"><h3>${esc(t.nome)}</h3><p class="meta">${esc(t.idiomas[0] || '')} ${ic('swap')} Português${t.idiomas[1] ? ' · ' + esc(t.idiomas[1]) : ''}</p><p class="meta">${ic('pin')}${esc(t.cidade)} · <span class="num">${String(t.distancia_km).replace('.', ',')} km</span></p></div><div class="side-r" style="text-align:right">${stars(t.rating, t.num_avaliacoes)}<small class="meta" style="justify-content:flex-end">A partir de</small><b class="num" style="color:var(--red);font-size:17px">${kz(t.preco_hora)}/h</b><br><span class="pill ${t.disponivel ? 'p-green' : 'p-orange'}">${t.disponivel ? 'Disponível agora' : 'Disponível amanhã'}</span></div><div style="display:flex;flex-direction:column;gap:8px;align-items:center">${favBtn('tradutor', t.id, 1)}<button class="btn btn-red" style="padding:8px 14px;font-size:13px" data-book="tradutor:${t.id}">Contratar</button></div></article>`).join('') || empty('Nenhum tradutor disponível com este filtro.')}</div>
   <div class="why why3 card" style="margin-top:20px;padding:18px 12px"><div><span style="color:var(--gold)">${ic('shield')}</span><b>Tradutores verificados</b>Perfis verificados manualmente</div><div><span style="color:var(--red)">${ic('chat')}</span><b>Comunicação segura</b>Chat e chamadas na app</div><div><span style="color:var(--gold)">${ic('star')}</span><b>Avaliações reais</b>Opiniões de outros viajantes</div></div></div>`;
};

const SING = { destino: 'Destino', experiencia: 'Experiência', alojamento: 'Alojamento', evento: 'Evento', prato: 'Prato', restaurante: 'Restaurante', viatura: 'Viatura', tradutor: 'Tradutor' };
V.favoritos = () => {
  const all = [...S.favs].map(k => { const [tipo, id] = k.split(':'); const it = item(tipo, id); return it && { tipo, it }; }).filter(Boolean);
  return pageHead('Favoritos', 'Os lugares e serviços que guardou', I('kalandula')) + `<div class="wrap section"><div class="grid">${all.map(({ tipo, it }) => `<article class="card hcard"><div class="pic"><img src="${it.imagem}" alt="${esc(nomeDe(it))}"></div><div class="body"><span class="pill p-blue" style="align-self:flex-start">${SING[tipo]}</span><h3>${esc(nomeDe(it))}</h3><p class="desc">${esc(it.provincia || it.local || it.descricao || it.categoria || '')}</p><div class="foot">${favBtn(tipo, it.id, 1)}${tipo === 'experiencia' ? `<button class="link" data-open-xp="${it.id}">Ver ${ic('chev')}</button>` : `<button class="link" data-go="${ROTA_DO_TIPO[tipo]}">Ver ${ic('chev')}</button>`}</div></div></article>`).join('') || empty('Ainda não tem favoritos. Toque no coração de qualquer destino, evento ou serviço para o guardar aqui.')}</div></div>`;
};

V.perfil = () => {
  const u = S.user;
  const ini = u.nome.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const desde = dataSQL(u.criado_em).toLocaleDateString(I18N.loc, { month: 'long', year: 'numeric' });
  return `<header class="page-head red"><img class="bg" src="${I('hero')}" alt=""><div class="wrap in" style="padding-bottom:80px"><button class="circle" data-go="inicio" aria-label="Voltar">${ic('back')}</button><div style="flex:1"><h1>Perfil</h1><p>A sua conta Angola 365º</p></div></div></header>
  <div class="wrap"><div class="prof"><span class="ava">${esc(ini)}</span><div><h2 style="font-size:24px">${esc(u.nome)}</h2><p class="meta">${esc(u.email)}${u.telefone ? ' · ' + esc(u.telefone) : ''} · ${t('Membro desde {data}', { data: desde })}</p></div></div>
   <div class="stats section"><div><b class="num">${(S.reservas || []).filter(r => r.estado !== 'cancelada').length}</b><small>Reservas</small></div><div><b class="num">${S.favs.size}</b><small>Favoritos</small></div><div><b class="num" style="color:var(--gold)">${grp(u.pontos)}</b><small>Pontos 360</small></div></div>
   <div class="card list-set section">
    <button data-go="reservas">${ic('ticket')}<span>As minhas reservas</span>${ic('chev')}</button>
    <button data-go="pagamentos">${ic('wallet')}<span>Carteira e pagamentos</span>${ic('chev')}</button>
    <button data-go="favoritos">${ic('heart')}<span>Favoritos</span>${ic('chev')}</button>
    <button data-editar-perfil>${ic('edit')}<span>Editar perfil e senha</span>${ic('chev')}</button>
    <button data-theme-toggle>${ic('moon')}<span>Tema escuro / claro</span>${ic('chev')}</button>
    <div class="row-lang">${ic('globe')}<span>Idioma</span>${I18N.seletor('compact')}</div>
    <button data-suporte="">${ic('headset')}<span>Ajuda e suporte</span>${ic('chev')}</button>
    ${u.papel === 'admin' ? `<a href="/admin/" style="display:flex">${ic('chart')}<span>Painel de administração</span>${ic('chev')}</a>` : ''}
    <button data-logout style="color:var(--red)">${ic('logout')}<span>Terminar sessão</span></button>
   </div>
   <p class="meta" style="justify-content:center;margin-top:24px">Desenvolvido por <img src="${I('sigaf')}" alt="SIGAF" style="height:20px;width:auto"> · www.sigafangola.ao · <a class="link" style="display:inline;font-size:inherit" href="/creditos.html">Créditos das imagens</a> · <a class="link" style="display:inline;font-size:inherit" href="/privacidade.html">Privacidade</a> · <a class="link" style="display:inline;font-size:inherit" href="/termos.html">Termos</a></p></div>`;
};

V.pesquisa = () => {
  const R = S.pesquisa;
  return pageHead('Resultados', 'Pesquisa por “' + esc(S.q) + '”', I('luanda')) + `<div class="wrap"><form data-search>${search('global', 'Para onde deseja ir?', { icon: 'search', submit: 1 })}</form><div class="grid section">${R.map(r => `<button class="card hcard" ${r.tipo === 'experiencia' ? `data-open-xp="${r.id}"` : `data-open-res="${r.tipo}:${r.id}"`}><div class="pic"><img src="${r.imagem}" alt=""></div><div class="body"><h3>${esc(r.nome)}</h3><p class="meta">${esc(r.subtitulo)}${r.data ? ' · ' + dfmt(r.data) : r.preco ? ' · ' + kz(r.preco) : ''}</p><span class="link" style="margin-top:auto">Abrir ${ic('chev')}</span></div></button>`).join('') || empty('Sem resultados. Experimente “praia”, “Malanje” ou “jazz”.')}</div></div>`;
};

/* ---------- entrada ---------- */
const SOCIAIS = [
  ['google', 'Google', '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>'],
  ['facebook', 'Facebook', '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path fill="#fff" d="M15.1 15.5l.5-3.4h-3.3V9.9c0-.9.5-1.8 1.9-1.8h1.5V5.2s-1.4-.2-2.7-.2c-2.7 0-4.5 1.7-4.5 4.7v2.4H5.6v3.4h2.9V24h3.8v-8.5z"/></svg>'],
  ['microsoft', 'Microsoft', '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#F25022" d="M1 1h10.5v10.5H1z"/><path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z"/><path fill="#00A4EF" d="M1 12.5h10.5V23H1z"/><path fill="#FFB900" d="M12.5 12.5H23V23H12.5z"/></svg>'],
];
function loginView(mode = 'in') {
  return `<div class="login"><div class="art"><img src="${I('couple')}" alt="Cataratas da Kalandula, Malanje"><div class="top">${logo('Explore. Descubra. Viva Angola.')}</div><p class="bot">${t('Descubra destinos incríveis, experiências únicas e viva o que <b>Angola</b> tem de melhor.')}</p></div>
  ${I18N.seletor('on-dark login-lang')}<div class="pane"><form data-login="${mode}" novalidate>
   <h1>${t('<span>Bem</span>-vindo(a)!')}</h1><p class="sub">${mode === 'in' ? 'Entre e comece a sua próxima aventura por Angola.' : 'Crie a sua conta em menos de um minuto.'}</p>
   <div class="box">
    ${mode === 'up' ? `<label class="inp"><span class="ii">${ic('user')}</span><input id="l-nome" name="nome" placeholder="Nome completo" autocomplete="name" required></label><label class="inp"><span class="ii">${ic('phone')}</span><input id="l-tel" name="telefone" type="tel" placeholder="Telemóvel (opcional)" autocomplete="tel"></label>` : ''}
    <label class="inp"><span class="ii">${ic('user')}</span><input id="l-email" name="email" type="${mode === 'up' ? 'email' : 'text'}" placeholder="${mode === 'up' ? 'E-mail' : 'E-mail ou telefone'}" autocomplete="username" required></label>
    <label class="inp"><span class="ii">${ic('lock')}</span><input id="l-pass" name="pass" type="password" placeholder="${mode === 'up' ? 'Senha (mín. 8, com letras e números)' : 'Senha'}" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}" required><button type="button" data-showpass aria-label="Mostrar senha" style="color:#888">${ic('eye')}</button></label>
    ${mode === 'in' ? `<div class="row"><span></span><button type="button" data-forgot>Esqueceu a senha?</button></div>` : ''}
    <p class="err" id="l-err" hidden></p>
    <button class="btn btn-red" type="submit" style="justify-content:space-between;border-radius:12px">${mode === 'in' ? 'Entrar' : 'Criar conta'} <span style="color:var(--gold)">→</span></button>
    <div class="or">${mode === 'in' ? 'ou entre com' : 'ou crie conta com'}</div>
    <div class="socials">${SOCIAIS.map(([id, nome, svg]) => `<button type="button" data-social="${id}" aria-label="${mode === 'in' ? 'Entrar' : 'Criar conta'} com ${nome}" title="${nome}">${svg}<span>${nome}</span></button>`).join('')}</div>
   </div>
   <p class="swap">${mode === 'in' ? 'Ainda não tem conta? <button type="button" data-mode="up">Criar conta</button>' : 'Já tem conta? <button type="button" data-mode="in">Entrar</button>'}</p>
   ${mode === 'in' ? `<p class="demo-note"><a href="/privacidade.html" class="link" style="font-size:inherit">Privacidade</a> · <a href="/termos.html" class="link" style="font-size:inherit">Termos</a> · <a href="/creditos.html" class="link" style="font-size:inherit">Créditos das imagens</a> · ${t('Conta de demonstração: <b>{email}</b> · senha <b>{senha}</b>', { email: 'visitante@turismo360.ao', senha: 'angola360' })} <button type="button" class="link" data-demo style="display:inline;font-size:inherit">preencher</button></p>` : ''}
  </form></div></div>`;
}

/* ---------- carregamento de dados ---------- */
async function carregarCatalogo() { S.cat = await API.get('/api/catalogo?lang=' + I18N.lang); }
async function carregarConta() {
  const [eu, favs] = await Promise.all([API.get('/api/auth/eu'), API.get('/api/favoritos')]);
  S.user = eu.utilizador; S.favs = new Set(favs.map(f => f.tipo + ':' + f.item_id));
  Inatividade.ligar(fimPorInatividade, S.inatividade);
  carregarNotifs(); API.get('/api/reservas').then(r => { S.reservas = r; }).catch(() => {});
}
async function carregarNotifs() { try { const n = await API.get('/api/notificacoes'); S.notifs = n.lista; S.naoLidas = n.nao_lidas; updateBell(); sysNotifyNovas(); } catch (e) {} }
function updateBell() { document.querySelectorAll('[data-notif-count]').forEach(b => { b.textContent = S.naoLidas; b.hidden = !S.naoLidas; }); }
async function antesDe(r) {
  if (r === 'pagamentos') { S.carteira = await API.get('/api/carteira'); S.user.saldo = S.carteira.saldo; S.user.pontos = S.carteira.pontos; }
  if (r === 'reservas' || r === 'perfil') S.reservas = await API.get('/api/reservas');
  if (r === 'experiencia') { const id = S.detail || lista('experiencias')[0]?.id; S.avals = await API.get(`/api/avaliacoes/experiencia/${id}`).catch(() => []); }
  if (r === 'pesquisa') S.pesquisa = S.q ? await API.get('/api/pesquisa?q=' + encodeURIComponent(S.q)) : [];
}

/* ---------- desenho ---------- */
const app = document.getElementById('app');
let renderSeq = 0;
async function render() {
  if (S.carregando) { app.innerHTML = `<div class="boot">${LOGO_SVG}<p>A carregar Angola…</p></div>`; return; }
  if (!S.user) { app.innerHTML = loginView(S.loginMode || 'in'); renderK(); if (S.msgLogin) { const er = document.getElementById('l-err'); er.hidden = false; er.textContent = I18N.t(S.msgLogin); } return; }
  const r = route(); const seq = ++renderSeq;
  try { await antesDe(r); } catch (e) { if (e.status !== 401) toast(e.message); }
  if (seq !== renderSeq || !S.user) return;
  const navCur = r === 'experiencia' ? 'experiencias' : r;
  app.innerHTML = `<div class="shell"><aside class="side">${logo()}<nav class="nav" aria-label="Menu principal">${NAV.map(n => n[0] === 'sep' ? `<div class="sep">${n[1]}</div>` : `<button data-go="${n[0]}" ${navCur === n[0] ? 'aria-current="page"' : ''}>${ic(n[1])}${n[2]}</button>`).join('')}${S.user.papel === 'admin' ? `<a class="nav-admin" href="/admin/">${ic('chart')}Administração</a>` : ''}</nav>
   <button class="btn" style="background:rgba(255,255,255,.08);color:#fff;justify-content:flex-start;position:relative" data-notifs>${ic('bell')} Notificações<span class="bell-count" data-notif-count style="top:8px;right:10px">0</span></button><button class="wallet-mini" data-go="pagamentos" style="text-align:left;color:#fff"><small>Saldo na carteira</small><b class="num">${kz(S.user.saldo)}</b><small>${grp(S.user.pontos)} pontos 360</small></button>
   ${I18N.seletor('on-dark')}<div class="powered">Uma solução <img src="${I('sigaf')}" alt="SIGAF"></div></aside>
   <main id="main">${V[r]()}</main>
   <nav class="tabbar" aria-label="Navegação">${[['inicio', 'home', 'Início'], ['destinos', 'compass', 'Explorar']].map(t => `<button data-go="${t[0]}" ${navCur === t[0] ? 'aria-current="page"' : ''}>${ic(t[1])}${t[2]}</button>`).join('')}<button class="scan" data-go="reservas" aria-label="As minhas reservas"><span class="sc">${ic('ticket')}</span></button>${[['mapa', 'map', 'Mapa'], ['perfil', 'user', 'Perfil']].map(t => `<button data-go="${t[0]}" ${navCur === t[0] ? 'aria-current="page"' : ''}>${ic(t[1])}${t[2]}</button>`).join('')}</nav></div>`;
  renderK(); updateBell();
}

/* ---------- modais ---------- */
let lbIndex = 0;
function openModal(html) { closeModal(); const d = document.createElement('div'); d.className = 'scrim'; d.id = 'scrim'; d.innerHTML = html; d.addEventListener('click', e => { if (e.target === d) closeModal(); }); document.body.appendChild(d); const f = d.querySelector('input:not([type=radio]),select,textarea,button'); f && f.focus(); return d; }
function closeModal() { document.getElementById('scrim')?.remove(); document.getElementById('lb')?.remove(); }
const modalHead = t => `<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:20px">${t}</h2><button type="button" class="circle" style="background:var(--surface-2);color:var(--fg)" data-close aria-label="Fechar">${ic('x')}</button></div>`;
function toast(msg) { document.querySelector('.toast')?.remove(); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = ic('check') + `<span>${esc(msg)}</span>`; document.body.appendChild(t); setTimeout(() => t.remove(), 3800); }
function lightbox(i) { const x = item('experiencia', S.detail) || lista('experiencias')[0]; const gal = x.galeria?.length ? x.galeria : [x.imagem]; lbIndex = (i + gal.length) % gal.length; document.getElementById('lb')?.remove(); const d = document.createElement('div'); d.className = 'lb'; d.id = 'lb'; d.innerHTML = `<img src="${gal[lbIndex]}" alt="Foto ${lbIndex + 1}"><button class="circle" data-close aria-label="Fechar">${ic('x')}</button><button class="circle nav" style="left:20px" data-lbnav="-1" aria-label="Anterior">${ic('back')}</button><button class="circle nav" style="right:20px" data-lbnav="1" aria-label="Seguinte">${ic('chev')}</button><p style="position:absolute;bottom:24px;color:#ccc" class="num">${lbIndex + 1} / ${gal.length}</p>`; d.addEventListener('click', e => { if (e.target === d) d.remove(); }); document.body.appendChild(d); }

/* ---------- reserva ---------- */
const PAGAMENTOS = [['Carteira 360', 'wallet'], ['Unitel Money', 'phone'], ['Multicaixa Express', 'bank'], ['Cartão •••• 4587', 'card']];
function configReserva(tipo, it) {
  const H = hojeISO(), d7 = somaDias(H, 7);
  switch (tipo) {
    case 'experiencia': return { pu: it.preco, unit: 'pessoa', ql: 'Pessoas', dl: 'Data da experiência', q0: 1, max: it.grupo_max, d0: d7 };
    case 'alojamento': return { pu: precoAl(it), unit: 'noite', ql: 'Noites', dl: 'Data de entrada', q0: 1, max: 30, d0: d7 };
    case 'evento': return { pu: it.preco, unit: 'bilhete', ql: 'Bilhetes', fixed: it.data, q0: 1, max: Math.min(10, it.lotacao - it.bilhetes_vendidos) };
    case 'restaurante': return { pu: it.preco_medio, unit: 'pessoa', ql: 'Pessoas', dl: 'Data da reserva', q0: 2, max: 20, d0: somaDias(H, 1), hora: 1 };
    case 'viatura': { const r = rentAtual(); return { pu: it.preco_promo || it.preco_dia, unit: 'dia', ql: 'Dias', dl: 'Levantamento', q0: 1, max: 60, d0: r.ini, fim: r.fim, loc: r.loc, carro: 1 }; }
    case 'tradutor': return { pu: it.preco_hora, unit: 'hora', ql: 'Horas', dl: 'Data do serviço', q0: 2, max: 12, d0: somaDias(H, 1) };
  }
}
function book(code) {
  const [tipo, id] = code.split(':'); const it = item(tipo, id); if (!it) return toast('Este item já não está disponível.');
  const c = configReserva(tipo, it); const gratis = c.pu === 0; const H = hojeISO();
  const m = openModal(`<div class="modal" role="dialog" aria-modal="true" aria-label="Reservar"><div class="mh"><img src="${it.imagem}" alt=""><button class="circle" data-close aria-label="Fechar">${ic('x')}</button></div>
  <form class="mb" data-confirm="${code}"><div><span class="pill p-blue">${SING[tipo]}</span><h2 style="font-size:20px;margin-top:6px">${esc(nomeDe(it))}</h2><p class="meta num">${gratis ? 'Entrada gratuita' : kz(c.pu) + ' por ' + c.unit}</p></div>
   ${c.fixed ? `<p class="meta">${ic('cal')}${dlong(c.fixed)} · ${it.hora} · ${esc(it.local)}</p>` : `<div style="display:grid;grid-template-columns:${c.carro || c.hora ? '1fr 1fr' : '1fr'};gap:10px"><label class="field" for="b-date">${c.dl}<input id="b-date" name="data" type="date" required value="${c.d0}" min="${H}"></label>${c.carro ? `<label class="field" for="b-fim">Devolução<input id="b-fim" name="data_fim" type="date" required value="${c.fim}" min="${H}"></label>` : ''}${c.hora ? `<label class="field" for="b-hora">Hora<select id="b-hora" name="hora">${['12:00', '13:00', '14:00', '19:00', '20:00', '21:00'].map(h => `<option ${h === '20:00' ? 'selected' : ''}>${h}</option>`).join('')}</select></label>` : ''}</div>`}
   ${c.carro ? `<label class="field" for="b-loc">Local de levantamento<select id="b-loc" name="local">${LOCAIS.map(l => `<option ${l === c.loc ? 'selected' : ''}>${l}</option>`).join('')}</select></label><p class="meta" id="b-dias"></p>` : `<div class="field">${c.ql}<div class="stepper"><button type="button" data-step="-1" aria-label="Menos">−</button><b id="b-q" class="num">${c.q0}</b><button type="button" data-step="1" aria-label="Mais">+</button></div>${tipo === 'alojamento' ? '<small class="meta" id="b-saida"></small>' : ''}</div>`}
   ${gratis ? '' : `<div class="field">Forma de pagamento<div class="pays">${PAGAMENTOS.map(([mt], n) => `<label><input type="radio" name="pay" value="${mt}" ${n === 0 ? 'checked' : ''}>${mt}</label>`).join('')}</div><small class="meta num">Saldo disponível: ${kz(S.user.saldo)} · Multicaixa Express fica pendente até confirmação do pagamento</small></div>`}
   <div class="total"><span>Total</span><b class="num" id="b-tot"></b></div>
   <p class="err" id="b-err" hidden></p>
   <button class="btn btn-red" type="submit">${gratis ? 'Confirmar inscrição' : 'Confirmar e pagar'}</button>
   <p class="meta" style="justify-content:center">${ic('shield')} Reserva segura · cancelamento gratuito até à véspera</p></form></div>`);
  m._q = c.q0; m._c = c; m._tipo = tipo; m._it = it; atualizaTotal();
}
function atualizaTotal() {
  const m = document.getElementById('scrim'); if (!m?._c) return; const c = m._c;
  let q = m._q;
  if (c.carro) { const a = m.querySelector('#b-date').value, b = m.querySelector('#b-fim').value; q = Math.round((new Date(b) - new Date(a)) / 864e5); m._q = q; m.querySelector('#b-dias').textContent = q > 0 ? `${q} dia${q > 1 ? 's' : ''} de aluguer` : 'A devolução tem de ser depois do levantamento.'; }
  if (m._tipo === 'alojamento') { const d = m.querySelector('#b-date').value; if (d) m.querySelector('#b-saida').textContent = 'Saída a ' + dlong(somaDias(d, q)); }
  m.querySelector('#b-tot').textContent = c.pu === 0 ? 'Grátis' : q > 0 ? kz(c.pu * q) : '—';
}
async function confirmarReserva(f) {
  const m = document.getElementById('scrim'); const er = f.querySelector('#b-err'); const btn = f.querySelector('button[type=submit]');
  const fd = new FormData(f); const [tipo, id] = f.dataset.confirm.split(':');
  er.hidden = true; btn.disabled = true;
  try {
    const r = await API.post('/api/reservas', { tipo, item_id: +id, quantidade: m._q, data: fd.get('data'), data_fim: fd.get('data_fim'), local: fd.get('local'), hora: fd.get('hora'), metodo: fd.get('pay') });
    S.user = r.utilizador; closeModal();
    if (tipo === 'evento') { const e = item('evento', id); if (e) e.bilhetes_vendidos += r.reserva.quantidade; }
    const res = r.reserva;
    toast(res.total ? (res.estado === 'pendente' ? t('Reserva {codigo} criada · pague por Multicaixa Express', { codigo: res.codigo }) : t('Reserva confirmada · {valor} · +{pontos} pontos', { valor: kz(res.total), pontos: res.pontos_ganhos })) : t('Inscrição confirmada. Até lá!'));
    carregarNotifs(); render();
    if (tipo === 'evento') setTimeout(() => kToast({ t: 'ENDA sugere', b: 'Quer convidar alguém para ir consigo? Preparo o convite num instante.', q: 'Convidar amigos' }), 1600);
    K.lastItem = getItem(`${tipo}:${id}`) || K.lastItem;
  } catch (e) {
    er.hidden = false; er.innerHTML = esc(e.message) + (e.status === 402 ? ` <button type="button" class="link" data-topup style="display:inline">Carregar carteira</button>` : '');
    btn.disabled = false;
  }
}
function verBilhete(id) {
  const r = (S.reservas || []).find(x => x.id === +id); if (!r) return;
  const [el, ec] = RES_EST[r.estado];
  openModal(`<div class="modal" role="dialog" aria-modal="true" aria-label="Bilhete"><div class="mb">${modalHead('Comprovativo de reserva')}
   <div class="ticket"><img src="${r.imagem || I('hero')}" alt=""><div class="tk-body"><span class="pill ${ec}">${el}</span><h3>${esc(r.item_nome)}</h3><p class="meta">${ic('cal')}${r.data_inicio ? dlong(r.data_inicio) : ''}${r.data_fim ? ' → ' + dlong(r.data_fim) : ''}</p><p class="meta">${ic('users')}${r.quantidade} ${r.unidade}${r.quantidade > 1 ? 's' : ''} · ${kzOuGratis(r.total)}</p><div class="tk-code"><small>Código da reserva</small><b class="num">${r.codigo}</b></div>${r.estado === 'pendente' ? `<p class="meta" style="margin-top:8px">${t('Pague no Multicaixa Express em <b>Pagamentos → Pagamento por referência</b> com a referência <b class="num">{ref}</b> e o valor de <b class="num">{valor}</b>.', { ref: r.codigo.slice(3), valor: kz(r.total) })}</p>` : '<p class="meta" style="margin-top:8px">Mostre este código ao parceiro no dia da reserva.</p>'}</div></div>
   <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost" data-copy="Reserva ${r.codigo} · ${esc(r.item_nome)}">${ic('share')} Copiar</button>${r.tipo === 'evento' ? `<button class="btn btn-ghost" data-k-remind="evento:${r.item_id}">${ic('bell')} Lembrar-me na véspera</button>` : ''}</div></div></div>`);
}
function pedirCancelamento(id) {
  const r = (S.reservas || []).find(x => x.id === +id); if (!r) return;
  openModal(`<div class="modal" role="dialog" aria-modal="true" aria-label="Cancelar reserva"><div class="mb">${modalHead('Cancelar reserva?')}<p>${esc(r.item_nome)} · <span class="num">${r.codigo}</span></p><p class="meta">${r.metodo_pagamento === 'Multicaixa Express' && r.estado === 'pendente' ? 'Esta reserva ainda não foi paga; não há valores a devolver.' : r.total ? t('Os <b class="num">{valor}</b> são devolvidos de imediato à sua Carteira 360.', { valor: kz(r.total) }) : 'A sua inscrição gratuita será anulada.'}</p><p class="err" id="c-err" hidden></p><div style="display:flex;gap:10px"><button class="btn btn-ghost" data-close style="flex:1">Manter reserva</button><button class="btn btn-red" data-cancelar-ok="${r.id}" style="flex:1">Sim, cancelar</button></div></div></div>`);
}
function abrirTopup() {
  openModal(`<div class="modal" role="dialog" aria-modal="true" aria-label="Adicionar saldo"><form class="mb" data-topupf>${modalHead('Adicionar saldo')}<div class="pays">${[10000, 25000, 50000, 100000].map((v, i) => `<label><input type="radio" name="v" value="${v}" ${i === 1 ? 'checked' : ''}><span class="num">${kz(v)}</span></label>`).join('')}</div><label class="field" for="t-outro">Outro valor (Kz)<input id="t-outro" name="outro" type="number" min="1000" max="2000000" step="500" placeholder="Ex.: 15000"></label><label class="field" for="t-m">Método<select id="t-m" name="metodo"><option>Unitel Money</option><option>Multicaixa Express</option><option>Transferência bancária</option><option>Cartão •••• 4587</option></select></label><p class="err" id="t-err" hidden></p><button class="btn btn-red" type="submit">Carregar carteira</button></form></div>`);
}
function abrirPerfil() {
  const u = S.user;
  openModal(`<div class="modal" role="dialog" aria-modal="true" aria-label="Editar perfil"><form class="mb" data-perfilf>${modalHead('Editar perfil')}<label class="field" for="p-nome">Nome<input id="p-nome" name="nome" value="${esc(u.nome)}" required></label><label class="field" for="p-tel">Telemóvel<input id="p-tel" name="telefone" type="tel" value="${esc(u.telefone || '')}" placeholder="923 000 000"></label><details><summary class="link" style="cursor:pointer">${u.senha_definida === 0 ? 'Definir uma senha' : 'Alterar senha'}</summary><div style="display:grid;gap:10px;margin-top:10px">${u.senha_definida === 0 ? '<p class="meta">Entrou com uma rede social. Pode definir uma senha para entrar também com o e-mail.</p>' : `<label class="field" for="p-sa">Senha actual<input id="p-sa" name="senha_atual" type="password" autocomplete="current-password"></label>`}<label class="field" for="p-sn">Nova senha<input id="p-sn" name="senha_nova" type="password" minlength="8" placeholder="Mín. 8, com letras e números" autocomplete="new-password"></label></div></details><p class="err" id="p-err" hidden></p><button class="btn btn-red" type="submit">Guardar alterações</button></form></div>`);
}
function pedirReserva(code) {
  const [tipo, id] = code.split(':'); const it = item(tipo, id); if (!it) return;
  const H = hojeISO(), q = { alojamento: 'Noites', restaurante: 'Pessoas', viatura: 'Dias' }[tipo] || 'Pessoas';
  openModal(`<div class="modal" role="dialog" aria-modal="true" aria-label="Pedir reserva"><div class="mh"><img src="${it.imagem}" alt=""><button class="circle" data-close aria-label="Fechar">${ic('x')}</button></div>
  <form class="mb" data-pedirf="${code}"><div><span class="pill p-orange">Ainda não é parceiro</span><h2 style="font-size:20px;margin-top:6px">${esc(nomeDe(it))}${it.empresa ? ' · ' + esc(it.empresa) : ''}</h2><p class="meta">${ic('pin')}${esc(it.local || it.local_levantamento || '')}</p></div>
   <p class="meta">Este estabelecimento ainda não aceita reservas e pagamentos online pela Angola 365º. Envie o pedido e a nossa equipa confirma disponibilidade e preço consigo, sem compromisso.</p>
   ${it.site || it.telefone ? `<p class="meta">${it.site ? `<a class="link" href="${esc(it.site)}" target="_blank" rel="noopener">${ic('globe')} Site oficial</a>` : ''} ${it.telefone ? `${ic('phone')} ${esc(it.telefone)}` : ''}</p>` : ''}
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="field" for="p-data">Data<input id="p-data" name="data" type="date" min="${H}" value="${somaDias(H, 7)}" required></label><label class="field" for="p-q">${q}<input id="p-q" name="q" type="number" min="1" max="60" value="${tipo === 'restaurante' ? 2 : 1}" required></label></div>
   <label class="field" for="p-notas">Notas (opcional)<textarea id="p-notas" name="notas" rows="2" maxlength="500" placeholder="Ex.: quarto duplo, cadeira de bebé, horário de levantamento…"></textarea></label>
   <p class="err" id="pr-err" hidden></p><button class="btn btn-red" type="submit">Enviar pedido de reserva</button>${seloFonte(it)}</form></div>`);
}
function abrirSuporte(assunto = '') {
  openModal(`<div class="modal" role="dialog" aria-modal="true" aria-label="Ajuda e suporte"><form class="mb" data-suportef>${modalHead('Ajuda e suporte')}<p class="meta">Respondemos em até 24 horas. Urgências: +244 926 239 938 · projectos@sigafangola.ao</p><label class="field" for="s-a">Assunto<input id="s-a" name="assunto" value="${esc(assunto)}" required maxlength="140"></label><label class="field" for="s-m">Mensagem<textarea id="s-m" name="mensagem" rows="5" required maxlength="3000"></textarea></label><p class="err" id="s-err" hidden></p><button class="btn btn-red" type="submit">Enviar pedido</button></form></div>`);
}
function abrirNotifs() {
  if (S.naoLidas) API.post('/api/notificacoes/lidas').then(() => { S.naoLidas = 0; updateBell(); }).catch(() => {});
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  openModal(`<div class="modal" role="dialog" aria-modal="true" aria-label="Notificações"><div class="mb">${modalHead('Notificações')}
   ${perm === 'default' ? `<div class="card" style="padding:12px 14px;display:flex;gap:10px;align-items:center"><span style="color:var(--red)">${ic('bell')}</span><p style="flex:1;font-size:13.5px">Receba lembretes e sugestões da ENDA mesmo com a app em segundo plano.</p><button class="btn btn-red" style="padding:8px 14px" data-k-perm>Ativar</button></div>` : ''}
   <div class="card">${S.notifs.length ? S.notifs.slice(0, 25).map(n => `<button class="k-notif${n.lida ? '' : ' nova'}" ${n.destino ? `data-go="${n.destino}"` : ''}><span class="k-ni">${ic(n.icone)}</span><div><b>${esc(n.titulo)}</b><p>${esc(n.corpo)}</p><small>${dataSQL(n.criado_em).toLocaleString(I18N.loc, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div></button>`).join('') : '<div class="empty">Ainda sem notificações. A ENDA vai deixar aqui sugestões e lembretes.</div>'}</div>
   <button class="btn btn-navy" data-k-open>${ic('chat')} Falar com a ENDA</button></div></div>`);
  S.notifs.forEach(n => n.lida = 1);
}

/* ---------- eventos ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button,[role="button"],a'); if (!t) return;
  const ds = t.dataset;
  if (ds.fav) {
    e.stopPropagation(); const k = ds.fav, [tipo, id] = k.split(':'); const on = !S.favs.has(k);
    on ? S.favs.add(k) : S.favs.delete(k);
    document.querySelectorAll(`[data-fav="${k}"]`).forEach(b => b.setAttribute('aria-pressed', on)); document.querySelectorAll('.badge-dot.num').forEach(b => b.textContent = S.favs.size);
    try { on ? await API.post('/api/favoritos', { tipo, item_id: +id }) : await API.del(`/api/favoritos/${tipo}/${id}`); toast(on ? 'Guardado nos favoritos' : 'Removido dos favoritos'); if (route() === 'favoritos' && !on) render(); }
    catch (err) { on ? S.favs.delete(k) : S.favs.add(k); document.querySelectorAll(`[data-fav="${k}"]`).forEach(b => b.setAttribute('aria-pressed', !on)); toast(err.message); }
    return;
  }
  if (ds.go) { closeModal(); go(ds.go); return; }
  if (ds.openXp) { S.detail = +ds.openXp; location.hash = 'experiencia/' + ds.openXp; return; }
  if (ds.openDest) { const d = item('destino', ds.openDest); S.f.q_dest = d.nome; S.f.dcat = 'Todos'; go('destinos'); return; }
  if (ds.openRes) { const [tipo, id] = ds.openRes.split(':'); const it = item(tipo, id); const rota = ROTA_DO_TIPO[tipo]; const qk = { destinos: 'q_dest', alojamentos: 'q_al', eventos: 'q_ev', gastronomia: 'q_g', tradutores: 'q_tr' }[rota]; if (qk) S.f[qk] = nomeDe(it); if (rota === 'viaturas') S.f.ccat = it.categoria; go(rota); return; }
  if (ds.chip) { S.f[ds.chip] = ds.v === S.f[ds.chip] && ds.chip === 'ccat' ? '' : ds.v; render(); return; }
  if (ds.focus) { document.getElementById(ds.focus)?.focus(); return; }
  if (ds.book) { book(ds.book); return; }
  if (ds.pedir) { pedirReserva(ds.pedir); return; }
  if (ds.close !== undefined) { closeModal(); return; }
  if (ds.step) { const m = document.getElementById('scrim'); m._q = Math.max(1, Math.min(m._c.max || 30, m._q + +ds.step)); m.querySelector('#b-q').textContent = m._q; atualizaTotal(); return; }
  if (ds.lb !== undefined) { lightbox(+ds.lb); return; }
  if (ds.lbnav) { lightbox(lbIndex + +ds.lbnav); return; }
  if (ds.toast) { toast(ds.toast); return; }
  if (ds.copy !== undefined) { const txt = I18N.t(ds.copy) + ' — Angola 365º · ' + location.origin; navigator.clipboard?.writeText(txt).then(() => toast('Copiado para partilhar'), () => toast(txt)); return; }
  if (ds.hide !== undefined) { S.hideBal = !S.hideBal; render(); return; }
  if (ds.txtab) { S.txTab = ds.txtab; render(); return; }
  if (ds.restab) { S.resTab = ds.restab; render(); return; }
  if (ds.scroll) { document.getElementById(ds.scroll)?.scrollIntoView({ behavior: 'smooth' }); return; }
  if (ds.topup !== undefined) { abrirTopup(); return; }
  if (ds.bilhete) { verBilhete(ds.bilhete); return; }
  if (ds.cancelar) { pedirCancelamento(ds.cancelar); return; }
  if (ds.cancelarOk) { t.disabled = true; try { const r = await API.post(`/api/reservas/${ds.cancelarOk}/cancelar`); S.user = r.utilizador; closeModal(); toast(r.reembolso ? I18N.t('Reserva cancelada · {valor} devolvidos à carteira', { valor: kz(r.reembolso) }) : I18N.t('Reserva cancelada')); carregarNotifs(); await carregarCatalogo(); render(); } catch (err) { const er = document.getElementById('c-err'); er.hidden = false; er.textContent = err.message; t.disabled = false; } return; }
  if (ds.editarPerfil !== undefined) { abrirPerfil(); return; }
  if (ds.suporte !== undefined) { abrirSuporte(ds.suporte); return; }
  if (ds.mode) { S.loginMode = ds.mode; S.msgLogin = null; render(); return; }
  if (ds.demo !== undefined) { document.getElementById('l-email').value = 'visitante@turismo360.ao'; document.getElementById('l-pass').value = 'angola360'; return; }
  if (ds.social) {
    const nome = SOCIAIS.find(x => x[0] === ds.social)?.[1] || ds.social;
    if (S.provedores && !S.provedores.includes(ds.social)) { const er = document.getElementById('l-err'); er.hidden = false; er.style.color = 'var(--muted)'; er.textContent = I18N.t('A entrada com {nome} ainda não foi activada. Use o e-mail por agora.', { nome }); return; }
    t.disabled = true; location.href = `/api/auth/oauth/${ds.social}?lang=${I18N.lang}`; return;
  }
  if (ds.recarregar !== undefined) { location.reload(); return; }
  if (ds.showpass !== undefined) { const p = document.getElementById('l-pass'); p.type = p.type === 'password' ? 'text' : 'password'; return; }
  if (ds.forgot !== undefined) { const er = document.getElementById('l-err'); er.hidden = false; er.style.color = 'var(--green)'; er.textContent = 'Para recuperar a senha contacte o suporte: +244 926 239 938 ou projectos@sigafangola.ao.'; return; }
  if (ds.logout !== undefined) { try { await API.post('/api/auth/sair'); } catch (err) {} sairLocal(); return; }
  if (ds.themeToggle !== undefined) { const r = document.documentElement; const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.dataset.theme = dark ? 'light' : 'dark'; prefs.set('theme', r.dataset.theme); toast(dark ? 'Tema claro activado' : 'Tema escuro activado'); return; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (document.getElementById('lb') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) lightbox(lbIndex + (e.key === 'ArrowRight' ? 1 : -1));
  const t = e.target.closest('[role="button"]'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.click(); }
});
let qt;
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.q && el.dataset.q !== 'global') { S.f['q_' + el.dataset.q] = el.value; clearTimeout(qt); qt = setTimeout(async () => { const pos = el.selectionStart; await render(); const n = document.getElementById(el.id); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 220); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.lang !== undefined) { I18N.definir(el.value); return; }
  if (el.dataset.sel) { S.f[el.dataset.sel] = el.value; render(); }
  if (el.dataset.date) { S.f['d_' + el.dataset.date] = el.value; render(); }
  if (el.closest('[data-confirm]') && (el.type === 'date')) atualizaTotal();
});
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target;
  if (f.dataset.search !== undefined) { const v = f.querySelector('input').value.trim(); if (!v) return; S.q = v; S.f.q_global = v; go('pesquisa'); return; }
  if (f.dataset.rent !== undefined) { const fd = new FormData(f); const r = { loc: fd.get('loc'), ini: fd.get('ini'), fim: fd.get('fim') }; if (r.fim <= r.ini) { toast('A data de devolução tem de ser depois do levantamento.'); return; } S.f.rent = r; S.f.ccat = fd.get('cat'); await render(); document.getElementById('carros')?.scrollIntoView({ behavior: 'smooth' }); return; }
  if (f.dataset.login) {
    const fd = new FormData(f); const er = document.getElementById('l-err'); er.style.color = ''; er.hidden = true; S.msgLogin = null;
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const r = f.dataset.login === 'up'
        ? await API.post('/api/auth/registar', { nome: fd.get('nome'), email: fd.get('email'), telefone: fd.get('telefone'), senha: fd.get('pass'), idioma: I18N.lang })
        : await API.post('/api/auth/entrar', { email: fd.get('email'), senha: fd.get('pass') });
      API.setToken(r.token); await carregarConta(); location.hash = 'inicio'; await render(); boasVindas();
      toast(f.dataset.login === 'up' ? 'Conta criada. Bem-vindo(a)!' : 'Sessão iniciada');
    } catch (err) { er.hidden = false; er.textContent = err.message; btn.disabled = false; }
    return;
  }
  if (f.dataset.confirm) { confirmarReserva(f); return; }
  if (f.dataset.topupf !== undefined) {
    const fd = new FormData(f); const v = +(fd.get('outro') || fd.get('v')); const er = f.querySelector('#t-err');
    try { const r = await API.post('/api/carteira/carregar', { valor: v, metodo: fd.get('metodo') }); S.user = r.utilizador; closeModal(); toast(t('Carteira carregada com {valor}', { valor: kz(v) })); render(); }
    catch (err) { er.hidden = false; er.textContent = err.message; }
    return;
  }
  if (f.dataset.perfilf !== undefined) {
    const fd = new FormData(f); const er = f.querySelector('#p-err'); const d = { nome: fd.get('nome'), telefone: fd.get('telefone') };
    if (fd.get('senha_nova')) { d.senha_atual = fd.get('senha_atual'); d.senha_nova = fd.get('senha_nova'); }
    try { const r = await API.patch('/api/auth/eu', d); S.user = r.utilizador; closeModal(); toast('Perfil actualizado'); render(); }
    catch (err) { er.hidden = false; er.textContent = err.message; }
    return;
  }
  if (f.dataset.suportef !== undefined) {
    const fd = new FormData(f); const er = f.querySelector('#s-err');
    try { await API.post('/api/suporte', { assunto: fd.get('assunto'), mensagem: fd.get('mensagem') }); closeModal(); toast('Pedido enviado. Respondemos em até 24 horas.'); carregarNotifs(); }
    catch (err) { er.hidden = false; er.textContent = err.message; }
    return;
  }
  if (f.dataset.pedirf) {
    const [tipo, id] = f.dataset.pedirf.split(':'); const it = item(tipo, id); const fd = new FormData(f); const er = f.querySelector('#pr-err');
    const unid = { alojamento: 'noite(s)', restaurante: 'pessoa(s)', viatura: 'dia(s)' }[tipo] || '';
    try { await API.post('/api/suporte', { assunto: `Pedido de reserva: ${nomeDe(it)}`, mensagem: `${SING[tipo]}: ${nomeDe(it)}${it.empresa ? ' (' + it.empresa + ')' : ''} · ${it.local || it.local_levantamento || ''}\nData: ${fd.get('data')} · ${fd.get('q')} ${unid}\nNotas: ${fd.get('notas') || '—'}\nContacto do cliente: ${S.user.email}${S.user.telefone ? ' · ' + S.user.telefone : ''}` }); closeModal(); toast('Pedido enviado. Vamos contactá-lo com a disponibilidade e o preço.'); carregarNotifs(); }
    catch (err) { er.hidden = false; er.textContent = err.message; }
    return;
  }
  if (f.dataset.review) {
    const [tipo, id] = f.dataset.review.split(':'); const fd = new FormData(f);
    try { await API.post('/api/avaliacoes', { tipo, item_id: +id, nota: +fd.get('nota'), comentario: fd.get('comentario') }); toast('Obrigado pela sua avaliação!'); await carregarCatalogo(); await render(); document.querySelector('.review-form')?.remove(); }
    catch (err) { toast(err.message); }
  }
});

I18N.aoMudar(async l => {
  closeModal(); document.querySelector('.k-toast')?.remove(); calar();
  try { await carregarCatalogo(); } catch (e) {}
  if (S.user) { API.patch('/api/auth/eu', { idioma: l }).catch(() => {}); K.msgs = []; if (K.open) kBoot(); }
  await render();
});
async function fimPorInatividade() {
  const tk = API.token; S.msgLogin = 'A sessão terminou por inactividade. Entre novamente.';
  if (tk) API.post('/api/auth/sair').catch(() => {});
  closeModal(); sairLocal();
}
function sairLocal() { Inatividade.desligar(); terminarVoz(); E.sessao = null; K.msgs = []; K.open = false; calar(); API.setToken(null); S.user = null; S.favs = new Set(); S.notifs = []; S.naoLidas = 0; S.loginMode = 'in'; location.hash = ''; render(); }
API.onExpira = () => { if (S.user) { S.msgLogin = 'A sua sessão expirou. Entre novamente.'; closeModal(); sairLocal(); } };

/* ---------- arranque ---------- */
(async function iniciar() {
  try { const th = prefs.get('theme', null); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
  // Regresso da entrada com Google, Facebook, Microsoft ou Apple
  const hh = location.hash;
  if (hh.startsWith('#codigo=')) {
    history.replaceState(null, '', location.pathname);
    try { const r = await API.post('/api/auth/oauth/trocar', { codigo: decodeURIComponent(hh.slice(8)) }); API.setToken(r.token); S.posEntrada = true; }
    catch (e) { S.erroEntrada = e.message; }
  }
  else if (hh.startsWith('#erro-entrada=')) { S.erroEntrada = decodeURIComponent(hh.slice(14)); history.replaceState(null, '', location.pathname); }
  API.get('/api/auth/provedores').then(r => { S.provedores = r.ativos; S.inatividade = r.inatividade_s; }).catch(() => {});
  render();
  try { await carregarCatalogo(); } catch (e) { app.innerHTML = `<div class="boot">${LOGO_SVG}<p>${esc(e.message)}</p><button class="btn btn-red" data-recarregar>Tentar de novo</button></div>`; return; }
  if (API.token) { try { await carregarConta(); } catch (e) { API.setToken(null); } }
  S.carregando = false;
  const p = location.hash.slice(1).split('/'); if (p[0] === 'experiencia' && p[1]) S.detail = +p[1];
  await render();
  if (S.erroEntrada && !S.user) { const er = document.getElementById('l-err'); if (er) { er.hidden = false; er.textContent = I18N.t(S.erroEntrada); } }
  if (S.posEntrada && S.user) { toast(I18N.t('Sessão iniciada')); boasVindas(); }
  if (S.user) agendarDicas();
  setInterval(() => { if (S.user && !document.hidden) carregarNotifs(); }, 60000);
})();
