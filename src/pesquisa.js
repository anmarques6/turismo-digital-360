// Pesquisa diária de eventos e actividades em Angola, com IA, a partir de sites públicos.
//   ia_pagina   — lê uma página pública (ex.: agenda/bilheteira) e a IA extrai os eventos lá escritos
//   ia_noticias — lê um feed RSS público de notícias e a IA identifica anúncios de eventos (confirmados, notícias ou rumores)
// Regras anti-invenção: cada evento tem de ter a ligação de origem presente na página/feed, o título tem de aparecer no texto,
// a data tem de ser válida e futura (até 12 meses). Coordenadas só via OpenStreetMap e dentro do mapa oficial de municípios.
const crypto = require('node:crypto');
const { norm } = require('./sincronizar');
const { CAT } = require('./recursos');
const { localizar } = require('./geo');

const UA = 'Angola365/3.4 (+https://turismo-digital-360.vercel.app; projectos@sigafangola.ao)';
let credencialPedido = null; // token OIDC que a Vercel envia no pedido da tarefa agendada
const definirCredencial = t => { if (t) credencialPedido = t; };
const credencial = () => process.env.AI_GATEWAY_API_KEY || credencialPedido || process.env.VERCEL_OIDC_TOKEN || null;
const hojeAO = () => new Date(Date.now() + 36e5).toISOString().slice(0, 10);

async function obterTexto(url, accept = 'text/html') {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'pt-PT,pt;q=0.9' }, signal: ctl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error(`A fonte respondeu ${r.status}.`);
    return (await r.text()).slice(0, 1_500_000);
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'A fonte não respondeu em 15 segundos.' : e.message); }
  finally { clearTimeout(t); }
}
// Respeita o robots.txt (regras para * ou para o nosso agente)
const cacheRobots = new Map();
async function permitido(url) {
  const u = new URL(url); const base = u.origin;
  if (!cacheRobots.has(base)) {
    let regras = [];
    try {
      const txt = await obterTexto(base + '/robots.txt', 'text/plain'); let aplica = false;
      for (const l of txt.split(/\r?\n/)) {
        const [k, ...v] = l.split(':'); const val = v.join(':').trim(); const key = k.trim().toLowerCase();
        if (key === 'user-agent') aplica = val === '*' || /angola365/i.test(val);
        else if (aplica && key === 'disallow' && val) regras.push(val);
      }
    } catch { regras = []; } // sem robots.txt = sem restrições
    cacheRobots.set(base, regras);
  }
  const caminho = u.pathname + u.search;
  return !cacheRobots.get(base).some(r => caminho.startsWith(r.replace(/\*.*$/, '')));
}
const desHTML = s => String(s).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|article|section)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
function ligacoes(html, base) {
  const L = new Map();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try { const u = new URL(m[1], base); if (!/^https?:$/.test(u.protocol)) continue; const t = desHTML(m[2]).slice(0, 120); if (!L.has(u.href) || t.length > L.get(u.href).length) L.set(u.href, t); } catch { }
  }
  return L;
}
function lerRSS(xml) {
  const tag = (s, t) => { const m = new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, 'i').exec(s); return m ? desHTML(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, '')) : ''; };
  return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => ({ titulo: tag(m[1], 'title'), url: tag(m[1], 'link'), data: tag(m[1], 'pubDate'), fonte: tag(m[1], 'source'), resumo: tag(m[1], 'description').slice(0, 300) })).filter(i => i.titulo && i.url);
}

const INSTRUCOES = `Extrais eventos e actividades turísticas que vão decorrer em Angola a partir de texto de sites públicos.
Devolve APENAS JSON: {"eventos":[{"titulo":"","data":"AAAA-MM-DD","data_fim":"AAAA-MM-DD ou null","hora":"HH:MM ou null","local":"","cidade":"","categoria":"","preco_texto":"ou null","url":"","resumo":"","confianca":""}]}
Regras: usa só o que está escrito no texto; não inventes datas, locais, preços nem ligações. Se a data não estiver escrita, não incluas o evento.
"url" tem de ser exactamente uma das ligações fornecidas. "categoria" é uma de: ${CAT.eventos.join(', ')}.
"confianca": "fonte identificada" (bilheteira/organizador anuncia o evento), "notícia" (notícia afirma que vai acontecer) ou "rumor" (anúncio incerto: "poderá", "está previsto", "fala-se", sem data/local confirmados).
Ignora eventos fora de Angola, já passados ou que não interessam a visitantes (ex.: reuniões políticas, julgamentos).`;

function lerJSON(t) { const i = String(t || '').indexOf('{'), f = String(t || '').lastIndexOf('}'); if (i < 0 || f < i) throw new Error('A IA não devolveu JSON.'); return JSON.parse(t.slice(i, f + 1)); }
async function perguntarIA(conteudo) {
  const tok = credencial(); if (!tok) throw new Error('IA não configurada (defina AI_GATEWAY_API_KEY ou active o OIDC da Vercel).');
  const { pedirIA, escolherModelo } = require('./enda');
  const modelo = process.env.PESQUISA_MODELO || await escolherModelo(tok);
  const j = await pedirIA('/chat/completions', tok, { model: modelo, temperature: 0, max_tokens: 3000, messages: [{ role: 'system', content: INSTRUCOES }, { role: 'user', content: conteudo }] }, 45000);
  return lerJSON(j?.choices?.[0]?.message?.content).eventos || [];
}

const IMAGEM = { 'Música': '/img/ev_jazz.jpg', Festivais: '/img/ev_festival.jpg', Cultura: '/img/ev_festa.jpg', Esportes: '/img/ev_kite.jpg', Gastronomia: '/img/f_churrasco.jpg', Turismo: '/img/luanda.jpg', 'Família': '/img/ev_festa.jpg', 'Negócios': '/img/ev_forum.jpg' };
// Valida o que a IA devolveu contra o texto original
function validar(lista, texto, urls, padrao) {
  const H = hojeAO(), limite = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10), T = norm(texto);
  const out = [];
  for (const e of Array.isArray(lista) ? lista : []) {
    const titulo = String(e.titulo || '').trim().slice(0, 200); if (titulo.length < 4) continue;
    const palavras = norm(titulo).split(/\W+/).filter(w => w.length > 3);
    if (palavras.length && palavras.filter(w => T.includes(w)).length < Math.ceil(palavras.length / 2)) continue; // título não está no texto: descartado
    const data = /^\d{4}-\d{2}-\d{2}$/.test(e.data) && !isNaN(Date.parse(e.data)) ? e.data : null; if (!data) continue;
    const fim = /^\d{4}-\d{2}-\d{2}$/.test(e.data_fim || '') && e.data_fim >= data ? e.data_fim : null;
    if ((fim || data) < H || data > limite) continue;
    let url = String(e.url || '').trim(); if (!urls.has(url)) url = padrao; if (!url) continue;
    const confianca = ['fonte identificada', 'notícia', 'rumor'].includes(e.confianca) ? e.confianca : 'rumor';
    out.push({ uid: 'ia:' + crypto.createHash('sha1').update(norm(titulo) + '|' + data).digest('hex').slice(0, 20), titulo, inicio: { data, hora: /^\d{2}:\d{2}$/.test(e.hora || '') ? e.hora : '00:00' }, fim: fim ? { data: fim } : null,
      local: String(e.local || '').trim().slice(0, 200) || null, cidade: String(e.cidade || '').trim().slice(0, 60) || null, categoria: CAT.eventos.includes(e.categoria) ? e.categoria : 'Cultura',
      preco_texto: e.preco_texto ? String(e.preco_texto).slice(0, 80) : null, url, descricao: String(e.resumo || '').trim().slice(0, 600) || null, confianca, imagem: IMAGEM[e.categoria] || '/img/ev_festival.jpg' });
  }
  return out;
}

function adaptadores({ nominatim }) {
  // coordenadas: só pelo OpenStreetMap e só se o ponto ficar dentro do mapa oficial
  async function geocodificar(e) {
    if (!e.local) return;
    try {
      const L = await nominatim([e.local, e.cidade].filter(Boolean).join(', '));
      const l = L.find(x => localizar(x.lat, x.lon)); if (!l) return;
      const loc = localizar(l.lat, l.lon);
      Object.assign(e, { lat: l.lat, lon: l.lon, coord_estado: 'aproximada', coord_fonte: l.fonte, municipio: loc.municipio, provincia: loc.provincia });
    } catch { }
  }
  return {
    async ia_pagina(fonte) {
      // {MMAAAA} no endereço = mês corrente (hora de Angola), ex.: VerAngola /va/pt/102026/eventos/
      const H = hojeAO(); fonte = { ...fonte, endpoint: String(fonte.endpoint).replace('{MMAAAA}', H.slice(5, 7) + H.slice(0, 4)) };
      if (!(await permitido(fonte.endpoint))) throw new Error('O robots.txt do site não permite a recolha desta página.');
      const html = await obterTexto(fonte.endpoint); const links = ligacoes(html, fonte.endpoint); const texto = desHTML(html).slice(0, 24000);
      const lista = [...links].filter(([u]) => new URL(u).host === new URL(fonte.endpoint).host).slice(0, 250);
      const eventos = validar(await perguntarIA(`Página: ${fonte.endpoint}\nHoje: ${hojeAO()}\n\nTEXTO:\n${texto}\n\nLIGAÇÕES (url — texto):\n${lista.map(([u, t]) => `${u} — ${t}`).join('\n')}`), texto + ' ' + lista.map(x => x[1]).join(' '), new Set(lista.map(x => x[0])), fonte.endpoint);
      for (const e of eventos.slice(0, 30)) { e.bilhetes_url = e.confianca === 'fonte identificada' ? e.url : null; await geocodificar(e); }
      return { eventos: eventos.slice(0, 30) };
    },
    async ia_noticias(fonte) {
      if (!(await permitido(fonte.endpoint))) throw new Error('O robots.txt do site não permite a recolha deste feed.');
      const itens = lerRSS(await obterTexto(fonte.endpoint, 'application/rss+xml, application/xml, text/xml')).slice(0, 60);
      if (!itens.length) return { eventos: [] };
      const txt = itens.map(i => `${i.titulo} (${i.fonte || ''}, ${i.data}) — ${i.resumo}\nurl: ${i.url}`).join('\n\n');
      const eventos = validar(await perguntarIA(`Feed de notícias. Hoje: ${hojeAO()}\nCada notícia termina com a sua ligação; usa essa ligação em "url".\n\n${txt}`), txt, new Set(itens.map(i => i.url)), null);
      for (const e of eventos.slice(0, 25)) { if (e.confianca === 'fonte identificada') e.confianca = 'notícia'; await geocodificar(e); }
      return { eventos: eventos.slice(0, 25) };
    },
  };
}

module.exports = { adaptadores, definirCredencial, validar, lerRSS, ligacoes, desHTML, permitido };
