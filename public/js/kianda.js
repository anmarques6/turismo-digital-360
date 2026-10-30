/* =========================================================
   ENDA AI — assistente de turismo (conversa com IA no servidor, voz contínua, convites, lembretes)
   As respostas vêm de /api/enda (dados reais da plataforma); acções da app (convites, saldo, reservas) tratadas aqui.
   Carregado antes de app.js (só usa funções de app.js dentro de funções).
   ========================================================= */
const NORM = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const K = { open: false, voice: true, msgs: [], lastItem: null, rec: null, listening: false };
try { const v = JSON.parse(localStorage.getItem('td360_kvoice')); if (v !== null) K.voice = v; } catch (e) {}

/* ---------- fala ---------- */
let VOZ = null;
function pickVoice() { try { const vs = speechSynthesis.getVoices(); VOZ = null; for (const l of I18N.vozes) { VOZ = vs.find(v => v.lang.replace('_', '-').toLowerCase().startsWith(l.toLowerCase())); if (VOZ) break; } } catch (e) {} }
try { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } catch (e) {}
I18N.aoMudar(pickVoice);
let falaSeguranca = null;
function falar(txt) {
  if (!('speechSynthesis' in window)) { fimDaFala(); return; }
  try {
    speechSynthesis.cancel(); clearTimeout(falaSeguranca);
    const limpo = String(txt).replace(/<[^>]+>/g, ' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 1200);
    const u = new SpeechSynthesisUtterance(limpo); u.lang = VOZ ? VOZ.lang : I18N.vozes[0]; if (VOZ) u.voice = VOZ; u.rate = 1.02;
    let acabou = false; const fim = () => { if (acabou) return; acabou = true; clearTimeout(falaSeguranca); setSpeaking(false); fimDaFala(); };
    u.onstart = () => { setSpeaking(true); if (VS.ativo) vozEstado('SPEAKING'); };
    u.onend = u.onerror = fim;
    // alguns navegadores não avisam o fim da fala: margem de segurança pelo tamanho do texto
    falaSeguranca = setTimeout(fim, 2500 + limpo.length * 75);
    if (VS.ativo) vozEstado('SPEAKING');
    speechSynthesis.speak(u);
  } catch (e) { fimDaFala(); }
}
function calar() { clearTimeout(falaSeguranca); try { speechSynthesis.cancel(); } catch (e) {} setSpeaking(false); }
function setSpeaking(on) { document.querySelectorAll('.k-avatar').forEach(a => a.classList.toggle('talking', on)); }
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const temMic = !!SR;

/* ---------- voz contínua: máquina de estados ----------
   INACTIVE → REQUESTING_PERMISSION → LISTENING → PROCESSING → SPEAKING → (contínua) LISTENING …
   PAUSED e ERROR param tudo; TERMINATING liberta o microfone e volta a INACTIVE.
   O microfone fica sempre desligado enquanto a ENDA pensa ou fala, para não se ouvir a si própria. */
const VS = { estado: 'INACTIVE', ativo: false, continuo: true, rec: null, falhas: 0, info: '' };
try { const c = JSON.parse(localStorage.getItem('a365_kcontinuo')); if (c !== null) VS.continuo = c; } catch (e) {}
const ESTADO_TXT = { INACTIVE: 'Assistente de turismo · IA', REQUESTING_PERMISSION: 'A pedir acesso ao microfone…', LISTENING: 'A ouvir…', PROCESSING: 'A pensar…', SPEAKING: 'A falar… (toque no microfone para interromper)', PAUSED: 'Em pausa', ERROR: 'Microfone indisponível', TERMINATING: 'A terminar…' };
function vozEstado(e, info = '') {
  VS.estado = e; VS.info = info;
  const st = document.querySelector('[data-k-estado]'); if (st) st.textContent = t(ESTADO_TXT[e]);
  const mic = document.querySelector('.k-mic'); if (mic) { mic.dataset.estado = e; mic.classList.toggle('on', e === 'LISTENING'); mic.setAttribute('aria-label', t(e === 'LISTENING' ? 'Parar de ouvir' : e === 'SPEAKING' ? 'Interromper e falar' : 'Falar ao microfone')); }
  const inp = document.getElementById('k-input'); if (inp) inp.placeholder = t(e === 'LISTENING' ? 'A ouvir…' : e === 'PROCESSING' ? 'A pensar…' : 'Pergunte à ENDA…');
  const av = document.querySelector('[data-k-aviso-voz]'); if (av) { av.hidden = !info; av.textContent = info; }
  document.body.dataset.vozEnda = e;
}
async function iniciarVoz() {
  if (!temMic) { kSay(t('O seu navegador não deixa usar o microfone aqui. Escreva a pergunta, que eu respondo na mesma.')); return; }
  VS.ativo = true; VS.falhas = 0; vozEstado('REQUESTING_PERMISSION');
  try { if (navigator.mediaDevices?.getUserMedia) { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(x => x.stop()); } }
  catch (e) { VS.ativo = false; vozEstado('ERROR', t(e.name === 'NotFoundError' ? 'Não encontrei nenhum microfone neste dispositivo.' : 'Não tenho autorização para usar o microfone. Pode escrever a pergunta, ou autorizar o microfone nas definições do navegador.')); return; }
  escutar();
}
function escutar() {
  if (!VS.ativo || !K.open) return terminarVoz();
  calar(); VS.rec?.abort();
  const R = new SR(); R.lang = I18N.vozes[0]; R.interimResults = true; R.continuous = false; R.maxAlternatives = 1; VS.rec = R;
  let final = '';
  R.onstart = () => vozEstado('LISTENING');
  R.onresult = e => { let tx = ''; for (const r of e.results) tx += r[0].transcript; const inp = document.getElementById('k-input'); if (inp) inp.value = tx; Inatividade.marcar(); if (e.results[e.results.length - 1].isFinal) final = tx; };
  R.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { VS.ativo = false; vozEstado('ERROR', t('Não tenho autorização para usar o microfone. Pode escrever a pergunta, ou autorizar o microfone nas definições do navegador.')); }
    else if (e.error === 'audio-capture') { VS.ativo = false; vozEstado('ERROR', t('Não encontrei nenhum microfone neste dispositivo.')); }
    else if (e.error === 'network') { VS.ativo = false; vozEstado('ERROR', t('O reconhecimento de voz precisa de internet. Verifique a ligação e tente de novo.')); }
  };
  R.onend = () => {
    if (VS.rec === R) VS.rec = null;
    if (!VS.ativo || VS.estado !== 'LISTENING') return; // pausa, erro, interrupção ou fim
    if (final.trim()) { VS.falhas = 0; kPergunta(final); return; }
    if (VS.continuo && ++VS.falhas < 3) { setTimeout(() => VS.ativo && VS.estado === 'LISTENING' && escutar(), 250); return; }
    VS.falhas = 0;
    if (VS.continuo) { VS.ativo = false; vozEstado('PAUSED', t('Pausei porque não ouvi nada. Toque no microfone para continuar a conversa.')); }
    else { VS.ativo = false; vozEstado('INACTIVE'); }
  };
  try { R.start(); } catch (e) { VS.ativo = false; vozEstado('ERROR', t('Não consegui ligar o microfone. Tente de novo.')); }
}
// chamada quando a resposta acabou (falada ou só escrita)
function fimDaFala() {
  if (!VS.ativo) return;
  if (VS.estado !== 'SPEAKING' && VS.estado !== 'PROCESSING') return;
  Inatividade.marcar();
  if (VS.continuo && K.open) setTimeout(() => { if (VS.ativo && (VS.estado === 'SPEAKING' || VS.estado === 'PROCESSING')) escutar(); }, 400);
  else { VS.ativo = false; vozEstado('INACTIVE'); }
}
function pausarVoz() { VS.ativo = false; VS.rec?.abort(); VS.rec = null; calar(); vozEstado('PAUSED'); }
function terminarVoz() { if (VS.estado === 'INACTIVE' && !VS.rec) return; vozEstado('TERMINATING'); VS.ativo = false; try { VS.rec?.abort(); } catch (e) {} VS.rec = null; calar(); vozEstado('INACTIVE'); }
function botaoMic() {
  switch (VS.estado) {
    case 'LISTENING': VS.rec?.stop(); break;                      // pára e envia o que ouviu
    case 'SPEAKING': calar(); VS.ativo = true; escutar(); break;  // interromper a ENDA e falar
    case 'PROCESSING': case 'REQUESTING_PERMISSION': case 'TERMINATING': break;
    default: iniciarVoz();
  }
}
const ouvir = botaoMic;

/* ---------- ENDA AI (servidor) ---------- */
const E = { sessao: null, pensando: false };
function md(txt) { // texto simples da IA → HTML seguro (negrito e listas)
  const L = esc(String(txt || '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n/);
  let out = '', lista = false;
  for (const l of L) {
    const m = /^\s*(?:[-•*]|\d+[.)])\s+(.*)/.exec(l);
    if (m) { if (!lista) { out += '<ul class="k-lista">'; lista = true; } out += `<li>${m[1]}</li>`; continue; }
    if (lista) { out += '</ul>'; lista = false; }
    if (l.trim()) out += (out && !out.endsWith('</ul>') ? '<br>' : '') + l;
  }
  return out + (lista ? '</ul>' : '');
}
const TIPO_TXT = { destino: 'Destino', experiencia: 'Experiência', alojamento: 'Alojamento', restaurante: 'Restaurante', evento: 'Evento', prato: 'Prato', viatura: 'Viatura', estadio: 'Estádio', lugar: 'Lugar' };
function extrasENDA(r) {
  let h = '';
  if (r.aviso) h += `<p class="k-aviso">${esc(t(r.aviso))}</p>`;
  if (r.itens?.length) h += r.itens.slice(0, 6).map(i => {
    const reservavel = ['experiencia', 'evento', 'alojamento', 'restaurante', 'viatura'].includes(i.tipo) && item(i.tipo, i.id);
    return `<div class="k-card">${i.imagem ? `<img src="${esc(i.imagem)}" alt="">` : `<span class="k-card-ic">${ic(i.tipo === 'estadio' ? 'run' : 'pin')}</span>`}<div><b translate="no">${esc(i.nome || '')}</b><small>${t(TIPO_TXT[i.tipo] || 'Lugar')}</small><div class="k-acts">${i.navegacao ? `<a href="${esc(i.navegacao.google)}" target="_blank" rel="noopener">${ic('pin')}Google Maps</a><a href="${esc(i.navegacao.waze)}" target="_blank" rel="noopener">${ic('car')}Waze</a><button data-mapa-foco="${i.lat},${i.lon}">${ic('globe')}${t('Ver no mapa')}</button>` : ''}${reservavel ? `<button data-k-explain="${i.tipo}:${i.id}">${ic('chat')}${t('Detalhes')}</button>` : ''}</div></div></div>`;
  }).join('');
  if (r.fontes?.length) h += `<p class="k-fontes">${t('Fontes:')} ${r.fontes.map(f => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nome)}</a>`).join(' · ')}</p>`;
  return h;
}
async function perguntarENDA(texto) {
  E.pensando = true; renderK();
  try {
    const p = S.pos ? { lat: S.pos.lat, lon: S.pos.lon, precisao: S.pos.precisao } : undefined;
    const r = await API.post('/api/enda', { mensagem: texto, sessao: E.sessao, lang: I18N.lang, posicao: p });
    E.sessao = r.sessao; E.pensando = false;
    for (const a of r.acoes || []) if (a.tipo === 'roteiro_guardado') { S.roteiros = null; toast(t('Roteiro guardado em «Roteiros».')); }
    kSay(md(r.resposta), { html2: extrasENDA(r), chips: r.modo === 'ambito' ? ['Sugere-me um passeio', 'Eventos esta semana', 'Próximos jogos'] : [], semTraduzir: r.modo === 'ia' });
  } catch (e) {
    E.pensando = false;
    kSay(esc(t(e.message || 'Não consegui responder agora. Tente de novo dentro de momentos.')));
  }
}

/* ---------- motor de intenções ---------- */
const PALAVRAS_FRACAS = ['luanda', 'angola', 'festival', 'show', '2026', '2027', 'nossa', 'senhora', 'agosto', 'petro', 'nacional', 'campeonato'];
function ITENS() {
  const out = [];
  for (const d of lista('destinos')) out.push({ k: 'destino', id: d.id, nome: d.nome, cat: d.categoria, prov: d.provincia || '', img: d.imagem, rating: d.rating, txt: d.descricao, alias: (d.palavras_chave || '').split(',').map(NORM).map(s => s.trim()).filter(Boolean).concat(NORM(d.nome)) });
  for (const x of lista('experiencias')) out.push({ k: 'experiencia', id: x.id, nome: x.titulo, cat: x.categoria, prov: x.local, img: x.imagem, rating: x.rating, preco: x.preco, txt: x.descricao, alias: [NORM(x.titulo)] });
  for (const e of lista('eventos')) out.push({ k: 'evento', id: e.id, nome: e.titulo, cat: e.categoria, prov: e.local, img: e.imagem, preco: e.preco, data: e.data, hora: e.hora, txt: e.descricao || e.local, alias: [NORM(e.titulo), ...NORM(e.titulo).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !PALAVRAS_FRACAS.includes(w))] });
  for (const r of lista('restaurantes')) out.push({ k: 'restaurante', id: r.id, nome: r.nome, cat: 'Gastronomia', prov: r.local, img: r.imagem, rating: r.rating, preco: r.preco_medio, parceiro: r.parceiro, txt: r.descricao, alias: [NORM(r.nome)] });
  for (const a of lista('alojamentos')) out.push({ k: 'alojamento', id: a.id, nome: a.nome, cat: 'Alojamento', prov: a.local, img: a.imagem, rating: a.rating, preco: precoAl(a), parceiro: a.parceiro, txt: t('{tipo} com {comodidades}.', { tipo: t(a.tipo), comodidades: (a.comodidades || []).map(c => t(c)).join(', ').toLowerCase() }), alias: [NORM(a.nome)] });
  for (const p of lista('pratos')) out.push({ k: 'prato', id: p.id, nome: p.nome, cat: 'Gastronomia', prov: '', img: p.imagem, rating: p.rating, txt: p.historia || p.descricao, alias: [NORM(p.nome), NORM(p.nome).split(' ')[0]].filter(a => a.length > 4) });
  return out;
}
function acharItem(q) { const n = NORM(q); let best = null, score = 0; for (const it of ITENS()) for (const a of it.alias) if (a.length > 3 && n.includes(a) && a.length > score) { best = it; score = a.length; } return best; }
const CATS = { beach: 'Praias', plage: 'Praias', playa: 'Praias', nature: 'Natureza', naturaleza: 'Natureza', waterfall: 'Natureza', cascade: 'Natureza', cascada: 'Natureza', culture: 'Cultura', history: 'Cultura', histoire: 'Cultura', museum: 'Cultura', musee: 'Cultura', museo: 'Cultura', adventure: 'Aventura', aventure: 'Aventura', hike: 'Aventura', hiking: 'Aventura', randonnee: 'Aventura', senderismo: 'Aventura', trail: 'Aventura', city: 'Cidades', ville: 'Cidades', ciudad: 'Cidades', food: 'Gastronomia', eat: 'Gastronomia', manger: 'Gastronomia', nourriture: 'Gastronomia', cuisine: 'Gastronomia', dinner: 'Gastronomia', diner: 'Gastronomia', lunch: 'Gastronomia', dejeuner: 'Gastronomia', cena: 'Gastronomia', almuerzo: 'Gastronomia', music: 'Música', musique: 'Música', concierto: 'Música', football: 'Esportes', soccer: 'Esportes', futbol: 'Esportes', sport: 'Esportes', deporte: 'Esportes', business: 'Negócios', affaires: 'Negócios', sleep: 'Alojamento', stay: 'Alojamento', accommodation: 'Alojamento', hebergement: 'Alojamento', alojamiento: 'Alojamento', hostal: 'Alojamento', praia: 'Praias', praias: 'Praias', mar: 'Praias', natureza: 'Natureza', cascata: 'Natureza', cataratas: 'Natureza', cultura: 'Cultura', historia: 'Cultura', museu: 'Cultura', aventura: 'Aventura', trilho: 'Aventura', caminhada: 'Aventura', cidade: 'Cidades', comida: 'Gastronomia', comer: 'Gastronomia', gastronomia: 'Gastronomia', restaurante: 'Gastronomia', jantar: 'Gastronomia', almoco: 'Gastronomia', musica: 'Música', concerto: 'Música', jazz: 'Música', futebol: 'Esportes', desporto: 'Esportes', negocios: 'Negócios', dormir: 'Alojamento', hotel: 'Alojamento', alojamento: 'Alojamento', ficar: 'Alojamento' };
function catDe(n) { for (const w of Object.keys(CATS)) if (new RegExp('\\b' + w).test(n)) return CATS[w]; return null; }
function provDe(n) { for (const p of ['luanda', 'malanje', 'benguela', 'namibe', 'huila', 'lubango']) if (n.includes(p)) return p; return null; }
function orcamento(n) { const m = n.match(/(?:ate|menos de|maximo|orcamento de|up to|under|max|budget of|less than|jusqu'a|moins de|budget de|hasta|presupuesto de)\s*([\d.,]+)\s*(mil|k|000)?/); if (!m) return null; let v = parseFloat(m[1].replace(/\./g, '').replace(',', '.')); if (m[2] || v < 1000) v *= 1000; return v; }

function kPergunta(texto) {
  texto = String(texto || '').trim(); if (!texto) return;
  K.msgs.push({ de: 'eu', html: esc(texto) });
  const inp = document.getElementById('k-input'); if (inp) inp.value = '';
  if (VS.ativo) { VS.rec?.abort(); vozEstado('PROCESSING'); }
  Inatividade.marcar(); renderK(); setTimeout(() => responder(texto), 120);
}
const SUG_INI = ['O que há perto de mim?', 'Eventos esta semana', 'Próximos jogos', 'Onde comer mufete?', 'Roteiro de 2 dias em Luanda'];
const TC = c => t(c).toLowerCase(); // nome da categoria na língua actual
const cap = p => p.charAt(0).toUpperCase() + p.slice(1);
// Palavras-chave das intenções em português, inglês, francês e espanhol (sem acentos)
const INT = {
  ola: /^(ola|oi|bom dia|boa tarde|boa noite|hey|hello|hi|good (morning|afternoon|evening)|bonjour|salut|bonsoir|hola|buenos dias|buenas)\b/,
  obrigado: /obrigad|valeu|\btop\b|perfeito|thank|cheers|merci|parfait|gracias|perfect/,
  convite: /convid|convite|chamar|enviar a|partilh|whatsapp|invite|share|inviter|partager|invitar|compartir/,
  lembrar: /lembr|avis|alarme|notific|remind|rappel|recuerda|recordar/,
  reservas: /minhas reservas|meus bilhetes|reservei|o que tenho|my (bookings|reservations|tickets)|mes (reservations|billets)|mis (reservas|entradas)/,
  saldo: /saldo|carteira|pontos|balance|wallet|points|solde|portefeuille|cartera|puntos/,
  carregar: /carregar|top up|top-up|recharger|recargar/,
  roteiro: /roteiro|itinerario|plano|programa|fim de semana|[0-9] ?dias|tres dias|dois dias|itinerary|plan\b|weekend|[0-9][ -]?days?|three days|two days|programme|week-end|[0-9] jours|trois jours|deux jours|fin de semana|dos dias/,
  reservar: /reserv|comprar|bilhete|marcar|\bbook|buy|ticket|acheter|billet|entrada/,
  eventos: /evento|agenda|concerto|festival|o que ha|acontece|espetaculo|jogo|event|concert|what'?s on|happening|\bshow|match|spectacle|concierto|partido/,
  sugerir: /sugere|sugest|recomend|onde ir|o que fazer|visitar|passeio|conhecer|surpreende|aconselh|restaurante|experiencia|suggest|recommend|where to go|what to do|visit|tour|trip|outing|suggere|recommande|ou aller|que faire|visiter|balade|sortie|sugier|recomienda|donde ir|que hacer|paseo|excursion|restaurant|experience/,
  este: /primeiro|esse|este|desse|deste|first|this|that|premier|cette|\bce\b|primero|\bese\b/,
  explica: /explic|conta|fala|sobre|explain|tell|about|raconte|parle|cuenta|habla/,
  tempo: /tempo|clima|chuva|calor|weather|rain|\bhot\b|season|meteo|temps|pluie|chaleur|saison|tiempo|lluvia|estacion/,
  ajuda: /ajuda|o que sabes|o que podes|como funciona|help|what can you|how does|aide|que peux|comment (ca|cela) marche|ayuda|que puedes|como funciona/,
};
function responder(texto) {
  const n = NORM(texto), nome = (S.user?.nome || '').split(' ')[0];
  const item = acharItem(n), cat = catDe(n), prov = provDe(n), orc = orcamento(n);
  if (INT.convite.test(n) || INT.lembrar.test(n) || INT.reservas.test(n) || INT.saldo.test(n) || INT.carregar.test(n) || (INT.reservar.test(n) && (item || K.lastItem) && !/onde|where|ou |donde|perto|near/.test(n))) {} else return perguntarENDA(texto);
  if (INT.ola.test(n)) return kSay(t('Olá{nome}! Sou a ENDA, a sua guia. Posso sugerir lugares, explicar a história de cada ponto, montar um roteiro ou preparar um convite para os seus amigos. Por onde começamos?', { nome: nome ? ' ' + esc(nome) : '' }), { chips: SUG_INI });
  if (INT.obrigado.test(n)) return kSay(t('Com todo o gosto! Se quiser, preparo um convite para partilhar este plano com alguém.'), { chips: ['Convidar amigos', 'Sugere-me outro lugar'] });
  if (INT.convite.test(n)) { const alvo = item || K.lastItem || ITENS().find(i => i.k === 'evento' && /jazz/i.test(i.nome)) || ITENS().find(i => i.k === 'evento'); return abrirConvite(alvo); }
  if (INT.lembrar.test(n)) { const alvo = item || K.lastItem; if (alvo) return criarLembrete(alvo); return kSay(t('Diga-me de que evento ou experiência quer ser lembrado, por exemplo «lembra-me do Jazz Festival».')); }
  if (INT.reservas.test(n)) return minhasReservas();
  if (INT.saldo.test(n)) return kSay(t('Tem <b>{saldo}</b> na Carteira 360 e <b>{pontos} pontos</b>. Cada 100 Kz gastos dão 1 ponto.', { saldo: kz(S.user.saldo), pontos: grp(S.user.pontos) }), { chips: ['Carregar carteira', 'As minhas reservas'] });
  if (INT.carregar.test(n)) { abrirTopup(); return kSay(t('Abri o carregamento da carteira.')); }
  if (INT.roteiro.test(n)) return roteiro(n, prov);
  if (INT.reservar.test(n) && (item || K.lastItem)) { const it = item || K.lastItem; if (!['destino', 'prato'].includes(it.k) && it.parceiro === 0) { kSay(t('{nome} ainda não aceita reservas online. Vou abrir o pedido de reserva — a nossa equipa confirma consigo.', { nome: esc(it.nome) })); setTimeout(() => pedirReserva(`${it.k}:${it.id}`), 600); return; }
    if (!['destino', 'prato'].includes(it.k)) { kSay(t('Vou abrir a reserva de <b>{nome}</b>.', { nome: esc(it.nome) })); setTimeout(() => book(`${it.k}:${it.id}`), 600); return; } return kSay(t('{nome} não se reserva directamente; posso sugerir uma experiência guiada ou um restaurante.', { nome: esc(it.nome) }), { chips: ['Sugere-me uma experiência'] }); }
  if (INT.eventos.test(n)) return listarEventos(cat);
  if (cat === 'Alojamento' && (!item || item.k !== 'alojamento')) return sugerirAlojamento(prov, orc);
  if (item) return explicar(item);
  if (INT.sugerir.test(n) || cat || prov || orc) return sugerir(cat, prov, orc, n);
  if (INT.este.test(n) && K.lastItem && INT.explica.test(n)) return explicar(K.lastItem);
  if (INT.tempo.test(n)) return kSay(t('Angola tem duas estações: a das chuvas, de outubro a abril, quente e húmida, e o cacimbo, de maio a setembro, mais seco e fresco. Para cataratas, a época das chuvas é a mais espetacular; para praias e trilhos, prefira o cacimbo.'));
  if (INT.ajuda.test(n)) return kSay(t('Posso: sugerir lugares por gosto, província ou orçamento; explicar a história de cada ponto; montar roteiros de 1 a 3 dias; mostrar a agenda de eventos; abrir reservas; dizer o seu saldo; preparar convites por WhatsApp, SMS ou e-mail; e lembrá-lo antes de um evento. Experimente falar comigo pelo microfone.'), { chips: SUG_INI });
  return kSay(t('Ainda não sei responder a isso, mas posso ajudar com lugares, eventos, roteiros e convites. Experimente uma destas:'), { chips: SUG_INI });
}

function cartao(it) {
  const extra = it.k === 'evento' ? `${dfmt(it.data)} · ${it.hora}` : (it.preco ? t('A partir de {preco}', { preco: kz(it.preco) }) : it.prov);
  const reservavel = !['destino', 'prato'].includes(it.k) && it.parceiro !== 0;
  return `<div class="k-card"><img src="${it.img}" alt=""><div><b>${esc(it.nome)}</b><small>${esc(extra || '')}</small><div class="k-acts"><button data-k-explain="${it.k}:${it.id}">${ic('chat')}${t('Explica')}</button>${reservavel ? `<button data-book="${it.k}:${it.id}">${ic('ticket')}${t('Reservar')}</button>` : `${['alojamento','restaurante','viatura'].includes(it.k) ? `<button data-pedir="${it.k}:${it.id}">${ic('chat')}${t('Pedir reserva')}</button>` : `<button data-k-go="${it.k}:${it.id}">${ic('pin')}${t('Ver')}</button>`}`}<button data-k-invite="${it.k}:${it.id}">${ic('share')}${t('Convidar')}</button></div></div></div>`;
}
function getItem(code) { const [k, id] = code.split(':'); return ITENS().find(i => i.k === k && i.id === Number(id)); }

function explicar(it) {
  K.lastItem = it; let tx;
  if (it.k === 'destino') { const d = item('destino', it.id); tx = `${esc(d.historia || d.descricao)}${d.quando_ir ? `<br><br><b>${t('Quando ir:')}</b> ${esc(d.quando_ir)}` : ''}${d.dica ? `<br><b>${t('Dica da ENDA:')}</b> ${esc(d.dica)}` : ''}`; }
  else if (it.k === 'experiencia') { const x = item('experiencia', it.id); tx = `${esc(x.descricao_longa || x.descricao)} ` + t('Duração: {dur}. Grupos de {min} a {max} pessoas. Idiomas: {idiomas}. Custa a partir de {preco} por pessoa.', { dur: esc(x.duracao), min: x.grupo_min, max: x.grupo_max, idiomas: esc(x.idiomas), preco: kz(x.preco) }); }
  else if (it.k === 'evento') { const e = item('evento', it.id); const livres = e.lotacao - e.bilhetes_vendidos; tx = t('{nome} acontece em {local}, no dia {data} às {hora}.', { nome: esc(it.nome), local: esc(it.prov), data: dfmt(it.data), hora: it.hora }) + ' ' + (e.descricao ? esc(e.descricao) + ' ' : '') + (it.preco ? t('Os bilhetes começam em {preco}.', { preco: kz(it.preco) }) : t('A entrada é gratuita.')) + (livres < 100 ? ' ' + t('Atenção: restam só {n} lugares.', { n: livres }) : ''); }
  else if (it.k === 'prato') tx = `${esc(it.txt)} ${t('Quer que lhe sugira um restaurante para provar?')}`;
  else tx = `${esc(it.nome)}: ${esc(it.txt)}`;
  kSay(tx, { html2: cartao(it), chips: [it.k === 'evento' ? 'Lembra-me deste evento' : it.k === 'prato' ? 'Sugere-me um restaurante' : 'Monta-me um roteiro', 'Convidar amigos', 'Sugere-me algo parecido'] });
}
function sugerir(cat, prov, orc, n) {
  let L = ITENS().filter(i => !['evento', 'prato', 'alojamento'].includes(i.k));
  if (cat) L = L.filter(i => i.cat === cat || (cat === 'Natureza' && i.cat === 'Aventura'));
  if (prov) L = L.filter(i => NORM(i.prov).includes(prov));
  if (orc) L = L.filter(i => !i.preco || i.preco <= orc);
  if (/famil|crianca|child|kids|enfant|nino/.test(n)) L = L.filter(i => !/tigres|trilh/i.test(NORM(i.nome)));
  if (/romant|casal|namor|couple|pareja/.test(n)) L = L.filter(i => /mussulo|ilha|mar|sabores|tasca/.test(NORM(i.nome)) || i.cat === 'Praias');
  if (!L.length) return kSay(t('Não encontrei nada com esses critérios. Quer que alargue a pesquisa a todo o país?'), { chips: ['Sugere-me um passeio', 'Eventos este mês'] });
  L = L.sort((a, b) => (b.rating || 4.5) - (a.rating || 4.5) + (Math.random() - .5) * .3).slice(0, 3);
  K.lastItem = L[0];
  const para = cat ? t('Para {cat}', { cat: TC(cat) }) : t('Para si');
  const intro = para + (prov ? ' ' + t('em {prov}', { prov: cap(prov) }) : '') + (orc ? ', ' + t('até {valor}', { valor: kz(orc) }) : '') + ', ' + t('eu escolheria estes. O meu favorito é {nome}', { nome: esc(L[0].nome) }) + (L[0].rating ? ', ' + t('com {n} estrelas', { n: L[0].rating }) : '') + '.';
  kSay(intro, { html2: L.map(cartao).join(''), chips: ['Explica o primeiro', 'Roteiro de 2 dias', 'Convidar amigos'] });
}
function sugerirAlojamento(prov, orc) {
  let L = ITENS().filter(i => i.k === 'alojamento');
  if (prov) L = L.filter(i => NORM(i.prov).includes(prov));
  if (orc) L = L.filter(i => i.preco != null && i.preco <= orc);
  if (!L.length) L = ITENS().filter(i => i.k === 'alojamento');
  L = L.sort((a, b) => b.rating - a.rating).slice(0, 3); K.lastItem = L[0];
  kSay((prov ? t('Para dormir em {prov}, recomendo:', { prov: cap(prov) }) : t('Para dormir, recomendo:')) + ' ' + L.map(a => `${esc(a.nome)} (${a.preco != null ? kz(a.preco) + t('/noite') : esc(a.prov)})`).join('; ') + '.', { html2: L.map(cartao).join(''), chips: ['Reservar o primeiro', 'Roteiro de 2 dias'] });
}
function listarEventos(cat) {
  let L = lista('eventos').filter(e => !cat || e.categoria === cat).slice(0, 3);
  if (!L.length) L = lista('eventos').slice(0, 3);
  if (!L.length) return kSay(t('Não há eventos agendados de momento. Volte a perguntar daqui a uns dias!'));
  const it = L.map(e => getItem('evento:' + e.id)); K.lastItem = it[0];
  kSay((cat ? t('Os próximos eventos de {cat} são:', { cat: TC(cat) }) : t('Os próximos eventos são:')) + ' ' + L.map(e => t('{nome} a {data}', { nome: esc(e.titulo), data: dfmt(e.data) })).join('; ') + '. ' + t('Posso lembrá-lo na véspera ou preparar um convite.'), { html2: it.map(cartao).join(''), chips: ['Lembra-me do primeiro', 'Convidar amigos para o Jazz'] });
}
async function minhasReservas() {
  try {
    const R = (await API.get('/api/reservas')).filter(r => ['confirmada', 'pendente'].includes(r.estado) && (r.data_inicio || '') >= hojeISO()).slice(0, 4);
    if (!R.length) return kSay(t('Não tem reservas futuras. Quer uma sugestão para este fim de semana?'), { chips: ['Sugere-me um passeio', 'Eventos este mês'] });
    kSay(t(R.length > 1 ? 'Tem {n} reservas pela frente:' : 'Tem {n} reserva pela frente:', { n: R.length }) + ' ' + R.map(r => t('{nome} a {data}', { nome: esc(r.item_nome), data: dfmt(r.data_inicio) }) + (r.estado === 'pendente' ? ' (' + t('a aguardar pagamento') + ')' : '')).join('; ') + '.', { html2: `<div class="k-acts"><button data-go="reservas">${ic('ticket')}${t('Ver as minhas reservas')}</button></div>`, chips: ['Convidar amigos', 'Roteiro de 2 dias'] });
  } catch (e) { kSay(t('Não consegui consultar as suas reservas agora. Tente de novo dentro de momentos.')); }
}
function roteiro(n, prov) {
  const dias = /3|tres|three|trois/.test(n) ? 3 : /2|dois|two|deux|\bdos\b|fim de semana|weekend|week-end|fin de semana/.test(n) ? 2 : 1;
  const X = q => lista('experiencias').find(x => NORM(x.titulo).includes(q)), Rr = q => lista('restaurantes').find(r => NORM(r.nome).includes(q)), D = q => lista('destinos').find(d => NORM(d.nome).includes(q));
  const XI = id => lista('experiencias').find(x => x.id === id);
  const planos = [
    [['Manhã', D('cidade alta')?.nome || t('Cidade Alta e Fortaleza de São Miguel')], ['Tarde', XI(6) || X('city tour')], ['Noite', Rr('mar') || Rr('naval')]],
    [['Manhã', t('Travessia de barco para o Mussulo')], ['Tarde', XI(4) || X('por do sol')], ['Noite', Rr('vigia') || Rr('origami')]],
    [['Madrugada', t('Partida para Malanje (cerca de 5 h)')], ['Manhã', XI(1) || X('kalandula')], ['Tarde', D('pungo')?.nome || 'Pedras Negras de Pungo Andongo']],
  ];
  const usar = (prov === 'malanje' ? [planos[2], planos[2], planos[2]] : planos).slice(0, dias);
  const rot = v => typeof v === 'string' ? v : v ? (v.titulo ? v.titulo : t('Jantar: {nome}', { nome: v.nome })) : '—';
  let html = '<div class="k-roteiro">'; let fala = t(dias > 1 ? 'Aqui está um roteiro de {n} dias.' : 'Aqui está um roteiro de {n} dia.', { n: dias }) + ' ';
  usar.forEach((d, i) => { html += `<div class="k-dia"><b>${t('Dia {n}', { n: i + 1 })}</b>${d.map(([h, v]) => `<div><span>${t(h)}</span>${esc(rot(v))}</div>`).join('')}</div>`; fala += `${t('Dia {n}', { n: i + 1 })}: ${d.map(x => rot(x[1])).join(', ')}. `; });
  html += '</div>';
  const custo = usar.flat().reduce((s, [, v]) => s + (v && typeof v === 'object' ? (v.preco || v.preco_medio || 0) : 0), 0);
  fala += t('O custo estimado por pessoa nas atividades pagas é de {valor}, sem alojamento.', { valor: kz(custo) });
  const primeiraXp = usar.flat().map(x => x[1]).find(v => v && v.titulo); if (primeiraXp) K.lastItem = getItem('experiencia:' + primeiraXp.id);
  kSay(fala, { html2: html, chips: ['Sugere-me onde dormir', 'Convidar amigos', 'Explica as Quedas de Calandula'] });
}

/* ---------- convites ---------- */
function textoConvite(it) {
  const quem = (S.user?.nome || '').split(' ')[0] || t('Eu'); const site = location.origin;
  if (it.k === 'evento') return t('Olá! {quem} está a convidar-te para «{nome}», no dia {data} às {hora}, em {local}.', { quem, nome: it.nome, data: dfmt(it.data), hora: it.hora, local: it.prov }) + ' ' + (it.preco ? t('Bilhetes a partir de {preco}.', { preco: kz(it.preco) }) : t('Entrada gratuita!')) + ' ' + t('Vens comigo? Vê tudo na app Angola 365º: {site}', { site });
  return t('Olá! {quem} quer levar-te a conhecer «{nome}»{local}.', { quem, nome: it.nome, local: it.prov ? ' (' + it.prov + ')' : '' }) + ' ' + (it.preco ? t('Fica a partir de {preco} por pessoa.', { preco: kz(it.preco) }) + ' ' : '') + t('Bora? Descobre mais na app Angola 365º: {site}', { site });
}
function abrirConvite(it) {
  if (!it) return kSay(t('De que lugar ou evento é o convite?'), { chips: ['Convidar amigos para o Jazz'] });
  K.lastItem = it; const tx = textoConvite(it);
  kSay(t('Preparei o convite para <b>{nome}</b>. Pode editar o texto e escolher como enviar.', { nome: esc(it.nome) }), { html2: `<div class="k-convite"><label for="k-conv-txt" class="sr">${t('Texto do convite')}</label><textarea id="k-conv-txt" rows="5">${esc(tx)}</textarea><input id="k-conv-tel" type="tel" inputmode="tel" placeholder="${t('Telemóvel do convidado (opcional), ex.: 923 000 000')}"><div class="k-acts wrap"><button data-k-send="wa">${ic('whats')}WhatsApp</button><button data-k-send="sms">${ic('chat')}SMS</button><button data-k-send="mail">${ic('receipt')}E-mail</button><button data-k-send="share">${ic('share')}${t('Partilhar')}</button><button data-k-send="copy">${ic('check')}${t('Copiar')}</button></div></div>` }, false);
  falar(t('Preparei o convite para {nome}. Escolha como o quer enviar.', { nome: it.nome }));
}
function enviarConvite(modo) {
  const tx = document.getElementById('k-conv-txt')?.value || ''; let tel = (document.getElementById('k-conv-tel')?.value || '').replace(/\D/g, '');
  if (tel && tel.length === 9) tel = '244' + tel;
  const enc = encodeURIComponent(tx); let url = null; const assunto = t('Convite · Angola 365º');
  if (modo === 'wa') url = `https://wa.me/${tel}?text=${enc}`;
  if (modo === 'sms') url = `sms:${tel ? '+' + tel : ''}?&body=${enc}`;
  if (modo === 'mail') url = `mailto:?subject=${encodeURIComponent(assunto)}&body=${enc}`;
  if (modo === 'share') { if (navigator.share) { navigator.share({ title: assunto, text: tx }).then(() => convFeito('partilhado'), () => {}); return; } modo = 'copy'; }
  if (modo === 'copy') { (navigator.clipboard?.writeText(tx) || Promise.reject()).then(() => toast(t('Convite copiado. Cole-o onde quiser.')), () => { const a = document.getElementById('k-conv-txt'); a.select(); toast(t('Selecionei o texto: copie com Ctrl+C.')); }); return; }
  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  convFeito(modo === 'wa' ? 'aberto no WhatsApp' : modo === 'sms' ? 'aberto nas mensagens' : 'aberto no e-mail');
}
function convFeito(como) {
  const it = K.lastItem;
  API.post('/api/notificacoes', { titulo: t('Convite preparado'), corpo: t('O convite para {nome} foi {como}.', { nome: it?.nome || t('o passeio'), como: t(como) }), icone: 'share' }).then(carregarNotifs).catch(() => {});
  kSay(t('Convite pronto a enviar. Quer que o lembre na véspera?'), { chips: ['Lembra-me deste evento', 'Sugere-me outro lugar'] });
}

/* ---------- lembretes (guardados no servidor) ---------- */
async function criarLembrete(it) {
  try {
    const r = await API.post('/api/lembretes', { tipo: it.k, item_id: it.id });
    carregarNotifs();
    const pedir = 'Notification' in window && Notification.permission === 'default';
    kSay(t(r.repetido ? 'Já tinha um lembrete para <b>{nome}</b> em {quando}.' : 'Combinado. Lembro-o de <b>{nome}</b> em {quando}.', { nome: esc(r.nome), quando: t(r.quando_txt) }) + (pedir ? ' ' + t('Para receber o aviso também no telemóvel, ative as notificações do navegador.') : ''), { html2: pedir ? '<div class="k-acts"><button data-k-perm>' + ic('bell') + t('Ativar notificações') + '</button></div>' : '', chips: ['Convidar amigos', 'Eventos este mês'] });
  } catch (e) { kSay(t('Não consegui criar o lembrete:') + ' ' + esc(t(e.message))); }
}
// Mostra notificação do sistema quando chega um lembrete novo e a app está em segundo plano
let ultimaNotifVista = 0;
function sysNotifyNovas() {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
    for (const n of S.notifs.filter(n => !n.lida && n.id > ultimaNotifVista)) new Notification(t(n.titulo), { body: t(n.corpo), icon: '/img/sigaf.webp' });
  } catch (e) {} finally { ultimaNotifVista = Math.max(ultimaNotifVista, ...S.notifs.map(n => n.id), 0); }
}

/* ---------- sugestões proactivas ---------- */
function DICAS() {
  const ev = lista('eventos')[0], mus = lista('experiencias').find(x => x.id === 4 || /mussulo/i.test(x.titulo)), of = lista('alojamentos').filter(a => a.oferta_pct && a.parceiro !== 0).sort((a, b) => b.oferta_pct - a.oferta_pct)[0];
  return [
    ev && { t: 'ENDA sugere', b: t('{nome} está a chegar ({data}). Quer que prepare um convite para os seus amigos?', { nome: ev.titulo, data: dfmt(ev.data) }), q: 'Convidar amigos' },
    mus && { t: 'ENDA sugere', b: t('Fim de semana à vista: que tal um pôr do sol no Mussulo? Experiência a partir de {preco}.', { preco: kz(mus.preco) }), q: 'Explica o Mussulo' },
    { t: 'Sabia que…', b: 'As Quedas de Calandula têm mais de 100 metros de altura. Peça-me a história completa.', q: 'Explica as Quedas de Calandula' },
    of && { t: 'Oferta ativa', b: t('{pct}% de desconto no {nome} esta semana.', { pct: of.oferta_pct, nome: of.nome }), q: 'Sugere-me onde dormir' },
  ].filter(Boolean);
}
let dicaIdx = 0, dicaTimer = null;
function agendarDicas() { clearInterval(dicaTimer); dicaTimer = setInterval(() => { const L = DICAS(); if (!S.user || K.open || document.hidden || dicaIdx >= L.length) return; kToast(L[dicaIdx++]); }, 90000); }
function kToast(d) { document.querySelector('.k-toast')?.remove(); if (K.open) return; const el = document.createElement('div'); el.className = 'k-toast'; el.setAttribute('role', 'status'); el.innerHTML = `<span class="k-avatar sm" aria-hidden="true">${KIANDA_SVG}</span><div><b>${esc(t(d.t))}</b><p>${esc(t(d.b))}</p><div class="k-acts"><button data-k-ask="${esc(d.q)}">${t('Falar com a ENDA')}</button><button data-k-close-toast>${t('Agora não')}</button></div></div>`; document.body.appendChild(el); setTimeout(() => el.remove(), 14000); }
function boasVindas() { setTimeout(() => kToast({ t: 'Olá! Sou a ENDA AI', b: 'Pergunte-me o que há perto, eventos, jogos ou peça um roteiro — por voz ou por escrito.', q: 'O que há perto de mim?' }), 1800); agendarDicas(); }

/* ---------- interface ---------- */
const KIANDA_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#2A0A10"/><path d="M8 30c5-3 9-3 13 0s9 3 13 0 7-2 6-1v8a19 19 0 0 1-32 0z" fill="#C8102E"/><path d="M10 36c4-2 8-2 12 0s9 2 12 0 4-1 4-1" stroke="#F2A900" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="24" cy="19" r="7" fill="#F2A900"/><g class="k-eyes"><circle cx="21.5" cy="18.5" r="1.2" fill="#2A0A10"/><circle cx="26.5" cy="18.5" r="1.2" fill="#2A0A10"/></g><path class="k-mouth" d="M21.5 22q2.5 2 5 0" stroke="#2A0A10" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
function kSay(html, opts = {}, speak = true) { K.msgs.push({ de: 'k', html, html2: opts.html2 || '', chips: opts.chips || [], semTraduzir: !!opts.semTraduzir }); if (K.msgs.length > 60) K.msgs.splice(0, K.msgs.length - 60); renderK(); if (speak && (K.voice || VS.ativo)) falar(html.replace(/<br>|<\/li>/g, '. ')); else fimDaFala(); }
function kBoot() { if (K.msgs.length) return; const nome = (S.user?.nome || '').split(' ')[0]; K.msgs.push({ de: 'k', html: t('Olá{nome}! Sou a <b>ENDA AI</b>. Pergunte-me por destinos, onde ficar e comer, eventos, jogos, como chegar ou peça um roteiro — por voz ou por escrito.', { nome: nome ? ' ' + esc(nome) : '' }) + '<br><small class="k-assin">' + t('ENDA AI — O teu caminho para descobrir Angola.') + '</small>', chips: SUG_INI }); }
const SPK = '<svg class="i" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>';
function renderK() {
  let el = document.getElementById('kianda');
  if (!el) { el = document.createElement('div'); el.id = 'kianda'; document.body.appendChild(el); }
  if (!S.user) { el.innerHTML = ''; return; }
  const vozOn = '<svg class="i" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', vozOff = '<svg class="i" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9 5 6M22 9l-5 6"/></svg>';
  el.innerHTML = `<button class="k-fab${K.open ? ' open' : ''}" data-k-toggle aria-expanded="${K.open}" aria-label="ENDA AI"><span class="k-avatar">${KIANDA_SVG}</span><span class="k-fab-l">ENDA AI<small>${t('Guia IA')}</small></span></button>
  ${K.open ? `<section class="k-panel" role="dialog" aria-label="ENDA AI">
   <header class="k-head"><span class="k-avatar">${KIANDA_SVG}</span><div><b>ENDA AI</b><small data-k-estado aria-live="polite">${t(ESTADO_TXT[VS.estado])}</small></div>
    <button class="k-ic" data-k-continuo aria-pressed="${VS.continuo}" title="${t(VS.continuo ? 'Conversa contínua ligada' : 'Conversa contínua desligada')}" aria-label="${t('Conversa contínua')}"><svg class="i" viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/></svg></button>
    ${VS.ativo ? `<button class="k-ic" data-k-pausa aria-label="${t('Pausar a conversa por voz')}"><svg class="i" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg></button>` : ''}
    <button class="k-ic" data-k-voice aria-pressed="${K.voice}" aria-label="${t(K.voice ? 'Desligar voz' : 'Ligar voz')}" title="${t(K.voice ? 'Voz ligada' : 'Voz desligada')}">${K.voice ? vozOn : vozOff}</button>
    <button class="k-ic" data-k-toggle aria-label="${t('Fechar')}">${ic('x')}</button></header>
   <p class="k-aviso-voz" data-k-aviso-voz ${VS.info ? '' : 'hidden'}>${esc(VS.info)}</p>
   <div class="k-msgs" id="k-msgs">${K.msgs.map(m => `<div class="k-msg ${m.de}">${m.de === 'k' ? `<div class="k-bubble"${m.semTraduzir ? ' translate="no"' : ''}>${m.html}<button class="k-play" data-k-say="${esc(m.html.replace(/<[^>]+>/g, ' '))}" aria-label="${t('Ouvir')}">${SPK}</button></div>${m.html2 || ''}${m.chips?.length ? `<div class="k-chips">${m.chips.map(c => `<button data-k-ask="${esc(t(c))}" translate="no">${esc(t(c))}</button>`).join('')}</div>` : ''}` : `<div class="k-bubble" translate="no">${m.html}</div>`}</div>`).join('')}
    ${E.pensando ? `<div class="k-msg k"><div class="k-bubble k-pensa" aria-live="polite"><span></span><span></span><span></span> ${t('A ENDA está a pensar…')}</div></div>` : ''}</div>
   <form class="k-form" data-k-form><button type="button" class="k-mic${VS.estado === 'LISTENING' ? ' on' : ''}" data-estado="${VS.estado}" data-k-mic aria-label="${t('Falar ao microfone')}" ${temMic ? '' : `title="${t('Microfone indisponível neste navegador')}"`}><svg class="i" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button><input id="k-input" autocomplete="off" maxlength="1000" placeholder="${t('Pergunte à ENDA…')}" aria-label="${t('Mensagem para a ENDA')}"><button class="k-send" aria-label="${t('Enviar')}"><svg class="i" viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-3-7z"/></svg></button></form>
   <p class="k-rodape">${t('ENDA AI — O teu caminho para descobrir Angola.')}</p>
  </section>` : ''}`;
  const m = document.getElementById('k-msgs'); if (m) m.scrollTop = m.scrollHeight;
}
function kOpen(q) { document.querySelector('.k-toast')?.remove(); K.open = true; kBoot(); renderK(); if (q) kPergunta(q); else setTimeout(() => document.getElementById('k-input')?.focus(), 50); }

/* eventos da ENDA (fase de captura, antes dos eventos gerais) */
document.addEventListener('click', e => {
  const btn = e.target.closest('button,[role="button"]'); if (!btn) return; const d = btn.dataset;
  const parar = () => e.stopImmediatePropagation();
  if (d.kToggle !== undefined) { document.querySelector('.k-toast')?.remove(); K.open = !K.open; if (K.open) kBoot(); else terminarVoz(); renderK(); if (K.open) setTimeout(() => document.getElementById('k-input')?.focus(), 50); return parar(); }
  if (d.kAsk) { const q = t(d.kAsk); document.querySelector('.k-toast')?.remove(); closeModal(); if (!K.open) kOpen(q); else kPergunta(q); return parar(); }
  if (d.kMic !== undefined) { botaoMic(); setTimeout(renderK, 0); return parar(); }
  if (d.kPausa !== undefined) { pausarVoz(); renderK(); return parar(); }
  if (d.kContinuo !== undefined) { VS.continuo = !VS.continuo; try { localStorage.setItem('a365_kcontinuo', JSON.stringify(VS.continuo)); } catch (er) {} renderK(); toast(t(VS.continuo ? 'Conversa contínua ligada: depois de responder, volto a ouvir.' : 'Conversa contínua desligada.')); return parar(); }
  if (d.kVoice !== undefined) { K.voice = !K.voice; try { localStorage.setItem('td360_kvoice', JSON.stringify(K.voice)); } catch (er) {} if (!K.voice) { calar(); if (VS.estado === 'SPEAKING') fimDaFala(); } renderK(); return parar(); }
  if (d.kSay) { falar(d.kSay); return parar(); }
  if (d.kExplain) { const it = getItem(d.kExplain); if (it) { if (!K.open) kOpen(); K.msgs.push({ de: 'eu', html: t('Explica-me {nome}', { nome: esc(it.nome) }) }); explicar(it); } return parar(); }
  if (d.kInvite) { const it = getItem(d.kInvite); if (!K.open) kOpen(); abrirConvite(it); return parar(); }
  if (d.kRemind) { const it = getItem(d.kRemind); closeModal(); if (!K.open) kOpen(); if (it) criarLembrete(it); return parar(); }
  if (d.kGo) { const it = getItem(d.kGo); if (it?.k === 'destino') { S.f.q_dest = it.nome; S.f.dcat = 'Todos'; go('destinos'); } else if (it?.k === 'prato') go('gastronomia'); return parar(); }
  if (d.kSend) { enviarConvite(d.kSend); return parar(); }
  if (d.kPerm !== undefined) { if ('Notification' in window) { Notification.requestPermission().then(p => { toast(t(p === 'granted' ? 'Notificações ativadas' : 'As notificações não foram autorizadas')); if (p === 'granted') new Notification('Angola 365º', { body: t('A ENDA vai avisá-lo de eventos e sugestões.'), icon: '/img/sigaf.webp' }); closeModal(); }).catch(() => toast('Este navegador não permite notificações aqui.')); } else toast('Este navegador não suporta notificações.'); return parar(); }
  if (d.kCloseToast !== undefined) { btn.closest('.k-toast')?.remove(); return parar(); }
  if (d.notifs !== undefined) { abrirNotifs(); return parar(); }
  if (d.kOpen !== undefined) { closeModal(); kOpen(); return parar(); }
}, true);
document.addEventListener('submit', e => { if (e.target.dataset.kForm !== undefined) { e.preventDefault(); e.stopImmediatePropagation(); kPergunta(document.getElementById('k-input').value); } }, true);
