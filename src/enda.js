// ENDA AI — assistente de turismo de Angola.
// Conversa com um modelo de IA através do Vercel AI Gateway, com ferramentas que lêem SÓ os dados da plataforma.
// O âmbito (turismo em Angola) é imposto aqui no servidor, não apenas na interface.
// Sem chave/credencial de IA, responde num modo local (mais simples) com os mesmos dados.
const crypto = require('node:crypto');
const { get, all, run, parseJSON } = require('./db');
const { erro } = require('./http');
const { norm } = require('./sincronizar');

const ASSINATURA = 'ENDA AI — O teu caminho para descobrir Angola.';
const str = (v, max = 300) => (v == null ? '' : String(v)).trim().slice(0, max);
const num = v => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const agoraSQL = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

// ---------- âmbito ----------
const PROVINCIAS = 'luanda|benguela|huila|lubango|namibe|mocamedes|cuanza|kwanza|malanje|huambo|bie|kuito|cabinda|zaire|soyo|uige|lunda|moxico|luena|cunene|ondjiva|cuando|cubango|menongue|bengo|icolo|moxico leste|cassai';
const TURISMO = new RegExp([
  'angola', PROVINCIAS, 'turis', 'touris', 'viag', 'travel', 'voyage', 'viaje', 'ferias', 'holiday', 'vacanc', 'passeio', 'visitar', 'visit', 'conhecer', 'roteiro', 'itinera', 'percurso',
  'hotel', 'hostel', 'alojament', 'dormir', 'ficar', 'stay', 'lodge', 'resort', 'pousada', 'hebergement', 'alojamiento', 'quarto',
  'restaurant', 'comer', 'comida', 'jantar', 'almoc', 'eat', 'food', 'manger', 'cuisine', 'prato', 'dish', 'plat', 'plato', 'gastronom', 'funge', 'muamba', 'mufete', 'calulu', 'moamba', 'kizaca', 'cocada', 'gingub', 'bebida',
  'evento', 'event', 'concert', 'show', 'festival', 'festa', 'carnaval', 'bilhete', 'ticket', 'billet', 'entrada', 'museu', 'museum', 'musee', 'museo', 'praia', 'beach', 'plage', 'playa', 'parque', 'park', 'parc', 'quedas', 'cascata', 'miradouro', 'fortaleza', 'ilha', 'deserto', 'serra', 'natureza', 'safari', 'cultura', 'culture', 'histori', 'monument', 'patrimon',
  'futebol', 'football', 'soccer', 'futbol', 'girabola', 'jogo', 'jogos', 'match', 'partido', 'estadio', 'stadium', 'stade', 'palancas', 'petro', 'agosto', 'clube', 'selecao', 'basquet',
  'perto', 'near', 'proche', 'cerca', 'distanc', 'como chegar', 'chegar', 'get to', 'aller', 'llegar', 'mapa', 'map', 'carte', 'direc', 'transporte', 'transport', 'taxi', 'candongueiro', 'aeroporto', 'airport', 'aluguer', 'rent', 'carro', 'car', 'voo', 'flight',
  'visto', 'visa', 'kwanza', 'moeda', 'currency', 'seguranc', 'safety', 'clima', 'weather', 'tempo', 'guia', 'guide', 'enda', 'kianda', 'reserva', 'booking', 'preco', 'price', 'prix', 'precio', 'onde', 'where', 'ou ', 'donde', 'sugere', 'suggest', 'recomend', 'recommend',
].join('|'));
const FORA = /\b(codigo|programa(r|cao)|javascript|python|java\b|sql|html|css|algoritmo|equa(cao|tion)|integral|derivad|matematic|math|fisica|quimica|trabalho de casa|homework|teste de|exame|redac(ao|cao)|ensaio|essay|poema|poem|cancao|letra da|lyrics|piada|joke|bitcoin|cripto|crypto|acoes|bolsa de valores|invest|forex|eleic|election|partido politico|presidente da republica|diagnos|sintoma|medicament|doenca|receita medica|advogad|processo judicial|namor|horoscop|signo|jogo de azar|aposta|bet\b|hack|senha de|password)/;
const SOCIAL = /^(ol[aá]|oi|bom dia|boa tarde|boa noite|hello|hi|hey|bonjour|salut|hola|buenos|obrigad|thanks|thank you|merci|gracias|tchau|adeus|bye|quem [eé]s|who are you|qui es-tu|qui[eé]n eres|o que (podes|sabes) fazer|what can you do)\b/;
function classificar(msg) {
  const n = norm(msg);
  if (SOCIAL.test(n) && n.length < 60) return 'social';
  const t = TURISMO.test(n), f = FORA.test(n);
  if (f && !t) return 'fora';
  return t ? 'turismo' : 'incerto';
}
const RECUSA = {
  pt: 'Sou a ENDA AI e só posso ajudar com turismo em Angola: destinos, alojamento, restaurantes e gastronomia, eventos, futebol, transporte, mapas e roteiros. Em que posso ajudar na sua viagem?',
  en: "I'm ENDA AI and I can only help with tourism in Angola: destinations, accommodation, restaurants and food, events, football, transport, maps and itineraries. How can I help with your trip?",
  fr: "Je suis ENDA AI et je ne peux aider que pour le tourisme en Angola : destinations, hébergement, restaurants et gastronomie, événements, football, transports, cartes et itinéraires. Comment puis-je aider pour votre voyage ?",
  es: 'Soy ENDA AI y solo puedo ayudar con turismo en Angola: destinos, alojamiento, restaurantes y gastronomía, eventos, fútbol, transporte, mapas e itinerarios. ¿En qué puedo ayudar con su viaje?',
};
const NOME_LINGUA = { pt: 'português (de Angola)', en: 'English', fr: 'français', es: 'español' };

// ---------- ferramentas ----------
const TIPOS = ['destinos', 'experiencias', 'alojamentos', 'restaurantes', 'eventos', 'pratos', 'viaturas'];
const FERRAMENTAS = [
  { name: 'pesquisar_catalogo', description: 'Procura na plataforma destinos, experiências, alojamentos, restaurantes, eventos, pratos típicos ou viaturas de aluguer. Use para qualquer pergunta sobre lugares, preços publicados, contactos ou detalhes.', parameters: { type: 'object', properties: { texto: { type: 'string', description: 'palavras a procurar (nome, cidade, categoria); vazio = todos' }, tipo: { type: 'string', enum: TIPOS }, provincia: { type: 'string' }, limite: { type: 'integer', minimum: 1, maximum: 12 } } } },
  { name: 'lugares_perto', description: 'Lista lugares da plataforma perto de uma posição, ordenados por distância em linha recta. Sem lat/lon usa a posição partilhada pelo utilizador.', parameters: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' }, raio_km: { type: 'number' }, tipos: { type: 'array', items: { type: 'string', enum: ['destino', 'experiencia', 'alojamento', 'restaurante', 'evento'] } } } } },
  { name: 'eventos', description: 'Eventos futuros publicados (com fonte, estado e grau de confiança). Datas AAAA-MM-DD.', parameters: { type: 'object', properties: { desde: { type: 'string' }, ate: { type: 'string' }, categoria: { type: 'string' }, provincia: { type: 'string' }, texto: { type: 'string' } } } },
  { name: 'jogos', description: 'Jogos de futebol (calendário e resultados) com estádio e fonte. Datas AAAA-MM-DD.', parameters: { type: 'object', properties: { desde: { type: 'string' }, ate: { type: 'string' }, competicao: { type: 'string' }, clube: { type: 'string' }, provincia: { type: 'string' }, estado: { type: 'string', enum: ['agendado', 'terminado', 'adiado', 'cancelado', 'ao vivo'] } } } },
  { name: 'pratos_e_onde_comer', description: 'Explica um prato típico angolano (ingredientes, fonte) e indica restaurantes da plataforma associados a esse prato.', parameters: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] } },
  { name: 'pesquisar_morada', description: 'Procura uma morada ou lugar em Angola no OpenStreetMap (para coordenadas de lugares que não estão na plataforma).', parameters: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] } },
  { name: 'como_chegar', description: 'Dá ligações de navegação (Google Maps, Waze, OpenStreetMap) e a distância a partir da posição do utilizador para um lugar da plataforma ou coordenadas.', parameters: { type: 'object', properties: { nome: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } } } },
  { name: 'planear_roteiro', description: 'Cria uma proposta de roteiro com lugares reais da plataforma (manhã, tarde, jantar por dia), agrupados por proximidade.', parameters: { type: 'object', properties: { cidade: { type: 'string' }, dias: { type: 'integer', minimum: 1, maximum: 7 }, interesses: { type: 'array', items: { type: 'string' } }, orcamento: { type: 'number' }, pessoas: { type: 'integer' } } } },
  { name: 'listar_roteiros', description: 'Lista os roteiros guardados pelo utilizador.', parameters: { type: 'object', properties: {} } },
  { name: 'guardar_roteiro', description: 'Guarda um roteiro novo ou substitui um existente (indique id para editar). Só guarde quando o utilizador pedir.', parameters: { type: 'object', properties: { id: { type: 'integer' }, titulo: { type: 'string' }, cidade: { type: 'string' }, dias: { type: 'integer' }, itens: { type: 'array', items: { type: 'object', properties: { dia: { type: 'integer' }, periodo: { type: 'string' }, tipo: { type: 'string' }, item_id: { type: 'integer' }, nome: { type: 'string' }, nota: { type: 'string' } }, required: ['dia', 'nome'] } } }, required: ['titulo', 'itens'] } },
  { name: 'fora_do_ambito', description: 'Chame quando o pedido NÃO é sobre turismo, viagens, cultura, gastronomia, eventos, futebol ou deslocações em Angola.', parameters: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] } },
].map(f => ({ type: 'function', function: f }));

function criarExecutor(ctx, req, sessao, lang) {
  const { listarPublico, hoje, ferramentas: F } = ctx;
  const fontes = new Map(), itens = [];
  const fonte = (nome, url) => { if (url && /^https?:\/\//.test(url) && !fontes.has(url)) fontes.set(url, { nome: str(nome, 80) || new URL(url).hostname, url }); };
  const cartao = (tipo, i) => { if (itens.length < 10 && !itens.some(x => x.tipo === tipo && x.id === i.id)) itens.push({ tipo, id: i.id, nome: i.nome || i.titulo, imagem: i.imagem || null, lat: i.latitude ?? i.lat ?? null, lon: i.longitude ?? i.lon ?? null, navegacao: (i.latitude ?? i.lat) != null ? F.linksNavegacao(i.latitude ?? i.lat, i.longitude ?? i.lon, i.nome || i.titulo) : null }); };
  const pos = () => sessao.contexto.posicao || null;
  const resumo = (tabela, i) => {
    const o = { id: i.id, nome: i.nome || i.titulo, provincia: i.provincia, local: i.local || i.endereco, categoria: i.categoria || i.tipo || i.especialidade };
    for (const k of ['preco', 'preco_noite', 'preco_medio', 'preco_dia', 'preco_entrada', 'nivel_preco', 'data', 'data_fim', 'hora', 'estado', 'confianca', 'telefone', 'site', 'horario', 'rating', 'descricao', 'ingredientes', 'regiao', 'organizador', 'bilhetes_url', 'coord_estado', 'verificado_em', 'parceiro']) if (i[k] != null && i[k] !== '') o[k] = k === 'descricao' ? str(i[k], 220) : i[k];
    if (i.latitude != null) { o.lat = i.latitude; o.lon = i.longitude; const p = pos(); if (p) o.distancia_km = Math.round(F.distanciaKm(p.lat, p.lon, i.latitude, i.longitude) * 10) / 10; }
    const f = i.fonte_url || i.fonte || i.coord_fonte; if (f) { o.fonte = f; fonte(i.fonte_nome || (tabela === 'pratos' ? 'Wikipédia' : null), f); }
    if (i.bilhetes_url) fonte(i.fonte_nome || 'Bilhetes', i.bilhetes_url);
    cartao(tabela.replace(/s$/, '').replace(/oe$/, 'ao'), i);
    return o;
  };
  const filtroTexto = (L, texto, prov) => {
    const palavras = norm(texto).split(/\W+/).filter(w => w.length > 2 && !PARAGEM.has(w));
    return L.filter(i => {
      const h = norm(JSON.stringify([i.nome, i.titulo, i.local, i.provincia, i.categoria, i.tipo, i.especialidade, i.descricao, i.municipio, i.endereco, i.etiqueta, i.ingredientes]));
      return (!prov || norm(i.provincia || i.local || '').includes(norm(prov)) || h.includes(norm(prov))) && (!palavras.length || palavras.some(w => h.includes(w)));
    });
  };
  const impl = {
    async pesquisar_catalogo({ texto = '', tipo, provincia, limite = 6 }) {
      const tabelas = TIPOS.includes(tipo) ? [tipo] : TIPOS;
      const out = {};
      for (const t of tabelas) { const L = filtroTexto(await listarPublico(t, lang), texto, provincia).slice(0, Math.min(12, limite)); if (L.length) out[t] = L.map(i => resumo(t, i)); }
      return Object.keys(out).length ? out : { resultado: 'sem dados na plataforma para este pedido' };
    },
    async lugares_perto({ lat, lon, raio_km = 15, tipos }) {
      const p = lat != null && lon != null ? { lat, lon } : pos();
      if (!p) return { erro: 'O utilizador ainda não partilhou a localização. Peça-lhe para tocar em «Usar a minha localização» ou indicar o bairro/cidade.' };
      const L = (await F.itensGeo(lang, listarPublico, tipos?.length ? tipos : undefined)).map(i => ({ ...i, distancia_km: Math.round(F.distanciaKm(p.lat, p.lon, i.lat, i.lon) * 10) / 10 })).filter(i => i.distancia_km <= Math.min(300, raio_km)).sort((a, b) => a.distancia_km - b.distancia_km).slice(0, 10);
      L.forEach(i => { cartao(i.tipo, i); if (i.coord_fonte) fonte('OpenStreetMap', i.coord_fonte); });
      return L.length ? { nota: 'distâncias em linha recta', lugares: L.map(({ imagem, parceiro, ...r }) => r) } : { resultado: `nenhum lugar da plataforma a menos de ${raio_km} km` };
    },
    async eventos({ desde, ate, categoria, provincia, texto = '' }) {
      let L = await listarPublico('eventos', lang);
      if (desde) L = L.filter(e => (e.data_fim || e.data) >= desde); if (ate) L = L.filter(e => e.data <= ate);
      if (categoria) L = L.filter(e => norm(e.categoria).includes(norm(categoria)));
      L = filtroTexto(L, texto, provincia).slice(0, 10);
      return L.length ? { hoje: hoje(), eventos: L.map(e => resumo('eventos', e)) } : { resultado: 'sem eventos publicados para estes critérios' };
    },
    async jogos(q) {
      const L = (await F.jogosFiltrados({ ...q, desde: q.desde || (q.estado === 'terminado' ? undefined : hoje()), ordem: q.estado === 'terminado' ? 'desc' : 'asc', limite: 15 })).slice(0, 12);
      L.forEach(j => { fonte(j.fonte_nome, j.fonte_url); if (j.latitude != null) cartao('estadio', { id: j.estadio_id, nome: j.estadio_nome, latitude: j.latitude, longitude: j.longitude }); });
      return L.length ? { jogos: L.map(j => ({ data_hora: j.data_hora + ' (hora de Angola)', competicao: j.competicao, jornada: j.jornada, casa: j.casa, fora: j.fora, estadio: j.estadio_nome || j.estadio, cidade: j.estadio_cidade, estado: j.estado, resultado: j.golos_casa != null ? `${j.golos_casa}-${j.golos_fora}` : null, confianca: j.confianca, bilhetes_url: j.bilhetes_url, fonte: j.fonte_nome })) } : { resultado: 'sem jogos registados para estes critérios' };
    },
    async pratos_e_onde_comer({ texto }) {
      const P = filtroTexto(await listarPublico('pratos', lang), texto).slice(0, 3);
      if (!P.length) return { resultado: 'este prato não está na plataforma' };
      const R = await listarPublico('restaurantes', lang); const rel = await all('SELECT prato_id, restaurante_id, fonte FROM pratos_restaurantes');
      return { pratos: P.map(p => ({ ...resumo('pratos', p), historia: str(p.historia, 400), onde_comer: rel.filter(x => x.prato_id === p.id).map(x => { const r = R.find(y => y.id === x.restaurante_id); if (!r) return null; if (x.fonte) fonte('Fonte do restaurante', x.fonte); return resumo('restaurantes', r); }).filter(Boolean) })) };
    },
    async pesquisar_morada({ texto }) {
      try { const L = (await F.nominatim(str(texto, 120))).slice(0, 4); L.forEach(l => fonte('OpenStreetMap', l.fonte)); return L.length ? { lugares: L, atribuicao: '© OpenStreetMap' } : { resultado: 'não encontrado no OpenStreetMap' }; }
      catch { return { erro: 'serviço de moradas indisponível' }; }
    },
    async como_chegar({ nome, lat, lon }) {
      let alvo = lat != null && lon != null ? { nome: nome || 'destino', lat, lon } : null;
      if (!alvo && nome) { const L = filtroTexto(await F.itensGeo(lang, listarPublico), nome); if (L[0]) alvo = L[0]; }
      if (!alvo && nome) { const e = (await all('SELECT * FROM estadios WHERE ativo = 1 AND latitude IS NOT NULL')).find(x => norm(x.nome + ' ' + (x.aliases || '')).includes(norm(nome))); if (e) alvo = { nome: e.nome, lat: e.latitude, lon: e.longitude, coord_estado: e.coord_estado, coord_fonte: e.coord_fonte }; }
      if (!alvo) return { resultado: 'lugar sem coordenadas confirmadas na plataforma; sugira pesquisar_morada' };
      cartao(alvo.tipo || 'lugar', { id: alvo.id || 0, nome: alvo.nome, lat: alvo.lat, lon: alvo.lon }); if (alvo.coord_fonte) fonte('OpenStreetMap', alvo.coord_fonte);
      const p = pos();
      return { nome: alvo.nome, coord_estado: alvo.coord_estado, navegacao: F.linksNavegacao(alvo.lat, alvo.lon, alvo.nome), distancia_km_linha_recta: p ? Math.round(F.distanciaKm(p.lat, p.lon, alvo.lat, alvo.lon) * 10) / 10 : null, nota: p ? 'o percurso real por estrada é maior; as ligações mostram o caminho e o tempo' : 'sem localização do utilizador: as ligações calculam o percurso a partir de onde ele estiver' };
    },
    async planear_roteiro(a) {
      const r = await F.planearRoteiro({ cidade: a.cidade, dias: a.dias, interesses: a.interesses || [], orcamento: a.orcamento, pessoas: a.pessoas || 1 }, lang, listarPublico);
      r.itens.forEach(i => cartao(i.tipo, { id: i.item_id, nome: i.nome, lat: i.lat, lon: i.lon }));
      return r;
    },
    async listar_roteiros() { return { roteiros: (await all('SELECT id, titulo, cidade, dias, itens FROM roteiros WHERE utilizador_id = ? ORDER BY atualizado_em DESC LIMIT 10', req.user.id)).map(r => ({ ...r, itens: parseJSON(r.itens, []) })) }; },
    async guardar_roteiro(a) {
      const itensR = (a.itens || []).slice(0, 60).map(i => ({ dia: Math.max(1, Math.min(14, Number(i.dia) || 1)), periodo: str(i.periodo, 20), tipo: str(i.tipo, 20), item_id: num(i.item_id), nome: str(i.nome, 160), nota: str(i.nota, 300) }));
      const titulo = str(a.titulo, 120) || 'Roteiro'; const dias = Math.max(1, Math.min(14, num(a.dias) || Math.max(1, ...itensR.map(i => i.dia))));
      let r;
      if (a.id) r = await get(`UPDATE roteiros SET titulo = ?, cidade = COALESCE(?, cidade), dias = ?, itens = ?, atualizado_em = ? WHERE id = ? AND utilizador_id = ? RETURNING id, titulo`, titulo, str(a.cidade, 60) || null, dias, JSON.stringify(itensR), agoraSQL(), num(a.id), req.user.id);
      else { if ((await get('SELECT COUNT(*)::int AS n FROM roteiros WHERE utilizador_id = ?', req.user.id)).n >= 50) return { erro: 'máximo de 50 roteiros atingido' }; r = await get('INSERT INTO roteiros (utilizador_id, titulo, cidade, dias, itens, interesses) VALUES (?,?,?,?,?,?) RETURNING id, titulo', req.user.id, titulo, str(a.cidade, 60) || null, dias, JSON.stringify(itensR), '[]'); }
      if (!r) return { erro: 'roteiro não encontrado' };
      sessao.acoes.push({ tipo: 'roteiro_guardado', id: r.id }); return { guardado: true, id: r.id, titulo: r.titulo };
    },
    async fora_do_ambito({ motivo }) { sessao.foraAmbito = str(motivo, 200) || true; return { ok: true }; },
  };
  return {
    fontes: () => [...fontes.values()].slice(0, 8), itens: () => itens,
    async executar(nome, args) {
      if (!impl[nome]) return { erro: 'ferramenta desconhecida' };
      try { const r = await impl[nome](args || {}); sessao.chamadas.push({ nome, vazio: !!(r.resultado || r.erro) }); return r; }
      catch (e) { sessao.chamadas.push({ nome, erro: e.message }); return { erro: 'falha ao ler os dados: ' + e.message.slice(0, 120) }; }
    },
  };
}
const PARAGEM = new Set('que qual quais quem onde como para pelo pela com sem uma umas uns por mais menos the and for with what where which how are near tem ter ver vai sao esta este isso isto voce podes pode quero queria gostava diz diga sugere sugira mostra mostre algum alguma alguns sobre angola dos das nos nas aos meu minha hoje amanha semana proximo proxima perto aqui melhor melhores bom boa'.split(' '));

// ---------- modelo de IA (Vercel AI Gateway, compatível com OpenAI) ----------
const GATEWAY = () => (process.env.AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh/v1').replace(/\/$/, '');
const credencialIA = req => process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN || null;
let cacheModelo = null;
async function pedirIA(caminho, token, corpo, ms = 30000) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(GATEWAY() + caminho, { method: corpo ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined, signal: ctl.signal });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = null; }
    if (!r.ok) throw new Error(`IA respondeu ${r.status}: ${(j?.error?.message || t).slice(0, 200)}`);
    return j;
  } finally { clearTimeout(tm); }
}
async function escolherModelo(token) {
  if (process.env.ENDA_MODELO) return process.env.ENDA_MODELO;
  if (cacheModelo && Date.now() - cacheModelo.t < 6 * 36e5) return cacheModelo.id;
  const L = ((await pedirIA('/models', token, null, 10000))?.data || []).filter(m => !m.type || m.type === 'language').map(m => m.id);
  const pref = [/anthropic\/claude.*haiku/, /google\/gemini.*flash(?!.*lite)/, /openai\/gpt.*mini/, /anthropic\/claude.*sonnet/];
  const id = pref.map(re => L.filter(x => re.test(x)).sort().pop()).find(Boolean) || L[0];
  if (!id) throw new Error('Nenhum modelo disponível no AI Gateway');
  cacheModelo = { id, t: Date.now() }; return id;
}
function instrucoes(lang, hoje, sessao, user) {
  const p = sessao.contexto.posicao;
  return `És a ENDA AI, assistente de turismo da plataforma Angola 365º. Assinatura: «${ASSINATURA}»
Hoje é ${hoje} (hora de Angola, UTC+1). Responde em ${NOME_LINGUA[lang]}. O utilizador chama-se ${str(user.nome, 40).split(' ')[0]}.
${p ? `Localização partilhada pelo utilizador: ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)} (precisão ~${Math.round(p.precisao || 0)} m).` : 'O utilizador não partilhou a localização.'}
REGRAS:
1. Âmbito: só turismo e viagens em Angola (destinos, cultura e história para visitantes, alojamento, restaurantes, gastronomia, eventos, futebol, transportes, mapas, segurança e dicas de viagem, roteiros). Para qualquer outro assunto chama a ferramenta fora_do_ambito e não respondas ao pedido.
2. Usa SEMPRE as ferramentas para dados concretos. Nunca inventes lugares, preços, horários, datas, contactos, resultados, bilhetes ou coordenadas. Se a ferramenta não devolver dados, diz claramente que a plataforma não tem essa informação e sugere onde confirmar.
3. Distingue o que está confirmado do que é aproximado: "coord_estado: aproximada", "confianca: por confirmar" e eventos/jogos de fontes não oficiais devem ser assinalados.
4. Bilhetes: só indica ligações bilhetes_url que vierem dos dados. Distâncias são em linha recta; o percurso real é maior.
5. Para conhecimento geral sobre Angola (cultura, história, costumes, documentos de viagem) podes responder com prudência, sem números nem regras exactas que possam ter mudado, e recomenda confirmar em fonte oficial.
6. Sê conversacional, caloroso e conciso (máx. ~150 palavras salvo roteiros). Usa listas curtas quando ajudar. Mantém o contexto da conversa ("lá", "esse", "perto dali").
7. Não escrevas URLs completos no texto; as fontes e os botões de navegação são mostrados à parte pela aplicação.
8. Guarda ou altera roteiros só quando o utilizador pedir explicitamente.`;
}

// ---------- modo local (sem IA) ----------
const TXT = {
  semdados: { pt: 'Não encontrei essa informação na plataforma. Pode reformular, indicar a cidade, ou perguntar por destinos, alojamento, restaurantes, eventos ou jogos.', en: "I couldn't find that on the platform. Try naming the city, or ask about destinations, stays, restaurants, events or matches.", fr: "Je n'ai pas trouvé cette information sur la plateforme. Précisez la ville ou demandez des destinations, hébergements, restaurants, événements ou matchs.", es: 'No encontré esa información en la plataforma. Indique la ciudad o pregunte por destinos, alojamiento, restaurantes, eventos o partidos.' },
  ola: { pt: 'Olá! Sou a ENDA AI. Posso sugerir destinos, onde ficar e comer, eventos, jogos de futebol, como chegar e montar roteiros. O que procura?', en: "Hi! I'm ENDA AI. I can suggest destinations, places to stay and eat, events, football matches, directions and itineraries. What are you looking for?", fr: "Bonjour ! Je suis ENDA AI. Destinations, hébergement, restaurants, événements, football, itinéraires : que cherchez-vous ?", es: '¡Hola! Soy ENDA AI. Destinos, alojamiento, restaurantes, eventos, fútbol, cómo llegar e itinerarios: ¿qué busca?' },
  achei: { pt: 'Encontrei isto na plataforma:', en: 'Here is what I found on the platform:', fr: 'Voici ce que j’ai trouvé sur la plateforme :', es: 'Esto es lo que encontré en la plataforma:' },
  semPos: { pt: 'Para ver o que está perto, toque em «Usar a minha localização» no mapa ou diga-me o bairro/cidade.', en: 'To see what is nearby, tap "Use my location" on the map or tell me the neighbourhood/city.', fr: 'Pour voir ce qui est proche, touchez « Utiliser ma position » sur la carte ou indiquez le quartier/la ville.', es: 'Para ver lo cercano, toque «Usar mi ubicación» en el mapa o dígame el barrio/ciudad.' },
  limite: { pt: '(Modo básico: o assistente de IA não está configurado, respondo só com pesquisas directas.)', en: '(Basic mode: the AI assistant is not configured, I answer with direct searches only.)', fr: '(Mode basique : l’assistant IA n’est pas configuré.)', es: '(Modo básico: el asistente de IA no está configurado.)' },
};
const linha = o => {
  if (o.casa) return `• ${o.data_hora.replace(' (hora de Angola)', '')} — ${o.casa} x ${o.fora}${o.resultado ? ` (${o.resultado})` : ''}${o.estadio ? ` · ${o.estadio}` : ''}${o.confianca && o.confianca !== 'confirmado' ? ` · ${o.confianca}` : ''}`;
  const preco = o.preco != null ? ` · ${o.preco ? Number(o.preco).toLocaleString('pt-PT') + ' Kz' : 'grátis'}` : o.preco_noite ? ` · ${Number(o.preco_noite).toLocaleString('pt-PT')} Kz/noite` : o.preco_medio ? ` · ~${Number(o.preco_medio).toLocaleString('pt-PT')} Kz` : '';
  return `• **${o.nome}**${o.data ? ` — ${o.data}${o.hora ? ' ' + o.hora : ''}` : ''}${o.local || o.provincia ? ` · ${o.local || o.provincia}` : ''}${o.distancia_km != null ? ` · ${o.distancia_km} km` : ''}${preco}`;
};
async function respostaLocal(msg, lang, ex, sessao) {
  const n = norm(msg); const H = new Date(); const iso = d => d.toISOString().slice(0, 10);
  const cidade = (n.match(new RegExp(`\\b(${PROVINCIAS})\\b`)) || [])[1];
  let r, cab = TXT.achei[lang];
  if (/futebol|football|soccer|futbol|jogo|match|partido|girabola|palancas|estadio|stadium|resultado/.test(n)) r = await ex.executar('jogos', { estado: /resultado|result/.test(n) ? 'terminado' : undefined, clube: (n.match(/\b(petro|agosto|interclube|sagrada|bravos|wiliete|kabuscorp|academica|desportivo|santa rita|luanda city|recreativo)\b/) || [])[1] });
  else if (/perto|near|proche|cerca|a minha volta|around/.test(n)) r = sessao.contexto.posicao ? await ex.executar('lugares_perto', { raio_km: 20 }) : { erro: TXT.semPos[lang] };
  else if (/como chegar|get to|directions|aller a|llegar|caminho|navegar/.test(n)) r = await ex.executar('como_chegar', { nome: msg.replace(/.*(chegar|get to|aller a|llegar a?|ao|à|a)\s+/i, '') });
  else if (/roteiro|itinera|plano de viagem|plan/.test(n)) r = await ex.executar('planear_roteiro', { cidade, dias: Number((n.match(/(\d)\s*(dia|day|jour|dia)/) || [])[1]) || 2 });
  else if (/evento|event|concert|show|festival|agenda|fim de semana|weekend/.test(n)) r = await ex.executar('eventos', { desde: iso(H), provincia: cidade, texto: /fim de semana|weekend/.test(n) ? '' : msg });
  else if (/prato|dish|plat|comida tipica|funge|muamba|mufete|calulu|moamba|kizaca|gastronom/.test(n)) r = await ex.executar('pratos_e_onde_comer', { texto: msg });
  else if (/hotel|alojament|dormir|ficar|stay|lodge|resort|hebergement|alojamiento/.test(n)) r = await ex.executar('pesquisar_catalogo', { tipo: 'alojamentos', provincia: cidade, texto: '' });
  else if (/restaurant|comer|jantar|almoc|eat|manger/.test(n)) r = await ex.executar('pesquisar_catalogo', { tipo: 'restaurantes', provincia: cidade, texto: '' });
  else if (/carro|car|aluguer|rent|viatura/.test(n)) r = await ex.executar('pesquisar_catalogo', { tipo: 'viaturas', texto: '' });
  else r = await ex.executar('pesquisar_catalogo', { texto: msg, provincia: cidade, limite: 4 });
  if (r.erro) return r.erro;
  if (r.resultado) return TXT.semdados[lang];
  const L = r.jogos || r.eventos || r.lugares || r.itens || r.pratos || Object.values(r).flat().filter(x => x && typeof x === 'object');
  if (r.navegacao) return `**${r.nome}**${r.distancia_km_linha_recta != null ? ` — ${r.distancia_km_linha_recta} km` : ''}. ${r.nota}.`;
  if (r.pratos) return r.pratos.map(p => `**${p.nome}** — ${p.descricao || ''}${p.ingredientes?.length ? `\n${p.ingredientes.join(', ')}` : ''}${p.onde_comer?.length ? '\n' + p.onde_comer.map(linha).join('\n') : ''}`).join('\n\n');
  if (r.itens && r.itens[0]?.periodo) return r.itens.map(i => `• Dia ${i.dia} · ${i.periodo}: **${i.nome}**${i.km_anterior != null ? ` (${i.km_anterior} km)` : ''}`).join('\n') + `\n${r.nota}`;
  return `${cab}\n${L.slice(0, 8).map(linha).join('\n')}`;
}

// ---------- rota ----------
const pedidosUtilizador = new Map();
function registar(ctx) {
  const { api, auth, corpo, lingua, hoje } = ctx;
  api.post('/api/enda', corpo, async req => {
    await auth(req);
    const agora = Date.now(); const l = (pedidosUtilizador.get(req.user.id) || []).filter(t => agora - t < 10 * 6e4);
    if (l.length >= Number(process.env.ENDA_LIMITE || 40)) erro(429, 'Muitas perguntas seguidas. Aguarde alguns minutos.');
    l.push(agora); pedidosUtilizador.set(req.user.id, l);
    const b = req.dados || {}; const lang = lingua(b.lang); const msg = str(b.mensagem, 1000);
    if (!msg) erro(400, 'Escreva a sua pergunta.');

    // sessão de conversa (apagada ao fim de 24 h)
    let id = /^[\w-]{16,64}$/.test(b.sessao || '') ? b.sessao : null;
    const s = id ? await get('SELECT * FROM enda_sessoes WHERE id = ? AND utilizador_id = ?', id, req.user.id) : null;
    if (!s) id = crypto.randomBytes(16).toString('hex');
    const sessao = { mensagens: parseJSON(s?.mensagens, []), contexto: parseJSON(s?.contexto, {}), chamadas: [], acoes: [], foraAmbito: false };
    const lat = num(b.posicao?.lat), lon = num(b.posicao?.lon);
    if (lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) sessao.contexto.posicao = { lat, lon, precisao: num(b.posicao.precisao) || null };
    if (b.posicao === null) delete sessao.contexto.posicao;

    const ex = criarExecutor(ctx, req, sessao, lang);
    const registo = (tipo, resposta, detalhe) => run('INSERT INTO enda_registos (utilizador_id, tipo, pergunta, resposta, detalhe) VALUES (?,?,?,?,?)', req.user.id, tipo, msg.slice(0, 500), str(resposta, 800), str(detalhe, 500));
    let resposta, modo = 'ia', aviso = null;
    const classe = classificar(msg);

    if (classe === 'fora') { resposta = RECUSA[lang]; modo = 'ambito'; await registo('fora_ambito', resposta, 'filtro do servidor'); }
    else {
      const token = credencialIA(req);
      if (token) {
        try {
          const modelo = await escolherModelo(token);
          const conversa = [{ role: 'system', content: instrucoes(lang, hoje(), sessao, req.user) }, ...sessao.mensagens.slice(-12), { role: 'user', content: msg }];
          for (let volta = 0; volta < 6; volta++) {
            const j = await pedirIA('/chat/completions', token, { model: modelo, messages: conversa, tools: FERRAMENTAS, tool_choice: 'auto', temperature: 0.3, max_tokens: 900 });
            const m = j?.choices?.[0]?.message; if (!m) throw new Error('resposta vazia do modelo');
            if (m.tool_calls?.length && volta < 5) {
              conversa.push({ role: 'assistant', content: m.content || null, tool_calls: m.tool_calls });
              for (const c of m.tool_calls) { let a = {}; try { a = JSON.parse(c.function.arguments || '{}'); } catch { } conversa.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(await ex.executar(c.function.name, a)).slice(0, 12000) }); }
              if (sessao.foraAmbito) break;
              continue;
            }
            resposta = str(m.content, 4000); break;
          }
          if (sessao.foraAmbito) { resposta = RECUSA[lang]; modo = 'ambito'; await registo('fora_ambito', resposta, 'modelo: ' + sessao.foraAmbito); }
          if (!resposta) throw new Error('o modelo não concluiu a resposta');
        } catch (e) {
          console.error('[ENDA]', e.message);
          await registo('erro', null, e.message);
          sessao.chamadas = []; resposta = null; aviso = 'O assistente de IA está temporariamente indisponível; respondi com uma pesquisa directa.';
        }
      }
      if (!resposta) { modo = 'local'; resposta = classe === 'social' ? TXT.ola[lang] : await respostaLocal(msg, lang, ex, sessao); if (!token) aviso = TXT.limite[lang]; }
      if (modo !== 'ambito' && sessao.chamadas.length && sessao.chamadas.every(c => c.vazio || c.erro)) await registo('sem_dados', resposta, sessao.chamadas.map(c => c.nome + (c.erro ? ':' + c.erro : '')).join(', '));
    }

    sessao.mensagens.push({ role: 'user', content: msg }, { role: 'assistant', content: resposta });
    const msgs = JSON.stringify(sessao.mensagens.slice(-16));
    if (s) await run('UPDATE enda_sessoes SET mensagens = ?, contexto = ?, atualizado_em = ? WHERE id = ?', msgs, JSON.stringify(sessao.contexto), agoraSQL(), id);
    else await run('INSERT INTO enda_sessoes (id, utilizador_id, mensagens, contexto, atualizado_em) VALUES (?,?,?,?,?)', id, req.user.id, msgs, JSON.stringify(sessao.contexto), agoraSQL());
    return { resposta, sessao: id, modo, aviso, fontes: modo === 'ambito' ? [] : ex.fontes(), itens: modo === 'ambito' ? [] : ex.itens(), acoes: sessao.acoes };
  });
  api.delete('/api/enda/sessao/:id', async req => { await auth(req); await run('DELETE FROM enda_sessoes WHERE id = ? AND utilizador_id = ?', req.params.id, req.user.id); });
  api.get('/api/enda/estado', async req => ({ ia: !!credencialIA(req), assinatura: ASSINATURA }));
}

module.exports = { registar, classificar, RECUSA, ASSINATURA, pedirIA, escolherModelo, credencialIA };
