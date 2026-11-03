/* =========================================================
   ANGOLA 365º — COMO VIAJAR
   Origem (GPS ou escolha) → destino → tipo de deslocação → autocarros, voos ou carro → «Continuar na plataforma»
   com os dados já preenchidos quando a transportadora o permite → As minhas viagens → organizar a estadia.
   Nunca mostra horários, preços ou lugares sem confirmação; nunca dá uma viagem por reservada sem o operador.
   Carregado depois de parceiro.js.
   ========================================================= */
ROUTES.push('viajar', 'viagens');
NAV.splice(NAV.findIndex(n => n[0] === 'viaturas'), 0, ['viajar', 'compass', 'Como viajar']);
NAV.splice(NAV.findIndex(n => n[0] === 'reservas') + 1, 0, ['viagens', 'ticket', 'As minhas viagens']);

const amanha = () => new Date(Date.now() + 864e5 + 36e5).toISOString().slice(0, 10);
const VJ = { origem: null, destino: null, form: { tipo_viagem: 'ida', data_ida: amanha(), data_volta: '', passageiros: 1 }, res: null, cat: null, ordem: 'melhor', erro: null, ref: null, lista: null };
const tv = s => I18N.t(s);
const MODO = { preenchido: ['Abre a pesquisa já preenchida', 'p-green'], preenchido_a_confirmar: ['Preenchimento automático em teste', 'p-orange'], site: ['Abre o site oficial', 'p-blue'] };
const COB = { rota_registada: 'Rota registada', provincias_servidas: 'Serve as duas províncias', a_confirmar: 'Confirme se faz esta rota' };
const EST_V = { pesquisa: 'p-blue', redireccionada: 'p-purple', reserva_pendente: 'p-orange', reserva_confirmada: 'p-green', reserva_cancelada: 'p-red' };
const hm = m => m == null ? '' : `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`;

// Entrada a partir de qualquer ficha (botão «Autocarro ou voo» / «Como viajar»)
function abrirComoViajar(dest) {
  closeModal(); VJ.destino = dest; VJ.res = null; VJ.erro = null; VJ.cat = null;
  if (!VJ.origem && S.pos) VJ.origem = { lat: S.pos.lat, lon: S.pos.lon, nome: S.pos.nome || tv('A minha localização') };
  if (!VJ.form.data_ida) VJ.form.data_ida = amanha();
  location.hash = 'viajar'; scrollTo(0, 0);
}
abrirViagem = d => abrirComoViajar({ lat: d.lat, lon: d.lon, nome: d.nome });

async function pesquisarViagem() {
  if (!VJ.origem || !VJ.destino) return;
  VJ.carregando = true; VJ.erro = null;
  try { VJ.res = await API.post('/api/viagens/pesquisar', { origem: VJ.origem, destino: VJ.destino, ...VJ.form, data_ida: VJ.form.data_ida || null, data_volta: VJ.form.tipo_viagem === 'ida_volta' ? VJ.form.data_volta || null : null });
    VJ.cat ||= VJ.res.rodoviario.length ? 'rodoviario' : VJ.res.aereo.length ? 'aereo' : 'carro'; VJ.lista = null; }
  catch (e) { VJ.erro = e.message; VJ.res = null; } finally { VJ.carregando = false; }
}
const _antesDeVJ = antesDe;
antesDe = async r => {
  if (r === 'viajar') { if (!VJ.ref) VJ.ref = await API.get('/api/viagens/referencia'); if (VJ.origem && VJ.destino && !VJ.res && !VJ.erro) await pesquisarViagem(); }
  if (r === 'viagens') VJ.lista = await API.get('/api/viagens');
  return _antesDeVJ(r);
};

/* ---------- escolha da origem e do destino ---------- */
const provOpts = sel => Object.keys(VJ.ref?.capitais || {}).sort((a, b) => a.localeCompare(b, 'pt')).map(p => `<option ${p === sel ? 'selected' : ''}>${esc(p)}</option>`).join('');
function blocoPonto(qual) {
  const p = VJ[qual], r = VJ.res?.[qual];
  const nome = r ? `${r.nome}${r.municipio && r.municipio !== r.nome ? ' · ' + r.municipio : ''}, ${r.provincia}` : p?.nome || '';
  if (p) return `<div class="vj-ponto"><span class="vj-ic">${ic(qual === 'origem' ? 'compass' : 'pin')}</span><div style="flex:1;min-width:0"><small>${tv(qual === 'origem' ? 'De' : 'Para')}</small><b>${esc(nome)}</b>${r?.aproximado ? `<small class="meta">${tv('centro da cidade (aproximado)')}</small>` : ''}</div><button type="button" class="link" data-vj-mudar="${qual}">${tv('Mudar')}</button></div>`;
  const dests = qual === 'destino' ? lista('destinos').filter(d => d.latitude != null).sort((a, b) => a.nome.localeCompare(b.nome, 'pt')) : [];
  return `<div class="vj-ponto vj-escolher"><span class="vj-ic">${ic(qual === 'origem' ? 'compass' : 'pin')}</span><div style="flex:1;min-width:0;display:grid;gap:8px"><small>${tv(qual === 'origem' ? 'De onde parte?' : 'Para onde vai?')}</small>
   ${qual === 'origem' ? `<button type="button" class="btn btn-navy" data-vj-gps>${ic('compass')} ${tv('Usar a minha localização')}</button>` : `<select data-vj-dest aria-label="${tv('Destino turístico')}"><option value="">${tv('Escolha um destino turístico')}</option>${dests.map(d => `<option value="${d.id}">${esc(d.nome)} · ${esc(d.provincia || '')}</option>`).join('')}</select>`}
   <select data-vj-prov="${qual}" aria-label="${tv('Província')}"><option value="">${tv(qual === 'origem' ? 'ou escolha a província de partida' : 'ou escolha só a província')}</option>${provOpts()}</select></div></div>`;
}
function formViagem() {
  const f = VJ.form;
  return `<form class="vj-form" data-vj-form>
   <div class="vj-tipo" role="radiogroup" aria-label="${tv('Tipo de viagem')}"><label><input type="radio" name="tipo_viagem" value="ida" ${f.tipo_viagem === 'ida' ? 'checked' : ''}> ${tv('Só ida')}</label><label><input type="radio" name="tipo_viagem" value="ida_volta" ${f.tipo_viagem === 'ida_volta' ? 'checked' : ''}> ${tv('Ida e volta')}</label></div>
   <label class="field">${tv('Partida')}<input type="date" name="data_ida" min="${hojeISO()}" value="${esc(f.data_ida)}"></label>
   <label class="field" ${f.tipo_viagem === 'ida_volta' ? '' : 'hidden'}>${tv('Regresso')}<input type="date" name="data_volta" min="${esc(f.data_ida || hojeISO())}" value="${esc(f.data_volta)}"></label>
   <label class="field">${tv('Passageiros')}<input type="number" name="passageiros" min="1" max="20" value="${f.passageiros}"></label>
   <button class="btn btn-red" type="submit" ${VJ.origem && VJ.destino ? '' : 'disabled'}>${ic('search')} ${tv('Pesquisar')}</button></form>`;
}

/* ---------- resultados ---------- */
function ordenar(L) {
  const n = v => v == null ? Infinity : v; const M = { preenchido: 0, preenchido_a_confirmar: 1, site: 2 }; const C = { rota_registada: 0, provincias_servidas: 1, a_confirmar: 2 };
  const h0 = o => n(o.horarios[0] ? +o.horarios[0].replace(':', '') : null);
  const f = { melhor: (a, b) => M[a.modo] - M[b.modo] || C[a.cobertura] - C[b.cobertura], preco: (a, b) => n(a.preco) - n(b.preco), duracao: (a, b) => n(a.duracao_min) - n(b.duracao_min), horario: (a, b) => h0(a) - h0(b) }[VJ.ordem];
  return [...L].sort(f);
}
function cartaoOperador(o) {
  const [ml, mc] = MODO[o.modo];
  const dado = (rot, v) => `<div class="vj-dado"><small>${tv(rot)}</small><b>${v}</b></div>`;
  const conf = o.verificado_em ? `<small class="meta">${tv('Confirmado')} ${dfmt(o.verificado_em)}${o.fonte ? ` · <a href="${esc(o.fonte)}" target="_blank" rel="noopener">${tv('fonte')}</a>` : ''}</small>` : '';
  return `<article class="card vj-op"><div class="vj-op-top">${o.logotipo ? `<img class="vj-logo" src="${esc(o.logotipo)}" alt="">` : `<span class="vj-logo vj-ini">${esc(o.nome.slice(0, 2).toUpperCase())}</span>`}<div style="flex:1;min-width:0"><h3>${esc(o.nome)}</h3><span class="pill ${mc}">${tv(ml)}</span> <span class="meta">${tv(COB[o.cobertura])}</span></div></div>
   ${o.preco != null || o.horarios.length || o.duracao_min ? `<div class="vj-dados">${dado('Preço', o.preco != null ? kz(o.preco) + ' / ' + tv('pessoa') : `<span class="vj-nd">${tv('Por confirmar')}</span>`)}${dado('Horários', o.horarios.length ? esc(o.horarios.join(' · ')) : `<span class="vj-nd">${tv('Por confirmar')}</span>`)}${dado('Duração', o.duracao_min ? hm(o.duracao_min) : `<span class="vj-nd">${tv('Por confirmar')}</span>`)}</div>${conf}` : `<p class="vj-nd">${ic('clock')} ${tv('Preços, horários e lugares: consulte na transportadora (ainda não confirmados connosco).')}</p>`}
   ${o.terminais.length ? `<p class="meta">${ic('pin')}${o.terminais.map(t => esc(t.nome)).join(' · ')}</p>` : ''}
   ${o.rotas.filter(r => r.via).map(r => `<p class="meta">${ic('compass')}${tv('Percurso')}: ${esc(r.via)}</p>`).join('')}
   ${o.aviso ? `<p class="aviso-viagem">${ic('clock')} ${esc(o.aviso)}</p>` : ''}
   ${o.limitacoes ? `<details class="meta"><summary>${tv('Condições e limitações')}</summary><p>${esc(o.limitacoes)}</p>${o.descricao ? `<p>${esc(o.descricao)}</p>` : ''}</details>` : ''}
   <div class="vj-op-bt"><button class="btn btn-red" data-vj-continuar="${o.id}">${tv('CONTINUAR NA PLATAFORMA')} ${ic('chev')}</button>${o.telefone ? `<a class="btn btn-ghost" href="tel:${esc(o.telefone.replace(/\s/g, ''))}">${ic('phone')} ${tv('Ligar')}</a>` : ''}${o.whatsapp ? `<a class="btn btn-ghost" href="https://wa.me/${esc(o.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">${ic('chat')} WhatsApp</a>` : ''}</div></article>`;
}
// Lugares do catálogo perto da linha entre a origem e o destino (paragens sugeridas)
function noPercurso(O, D) {
  const L = [...lista('restaurantes').map(i => ['restaurante', i]), ...lista('alojamentos').map(i => ['alojamento', i]), ...lista('destinos').map(i => ['destino', i])].filter(([, i]) => i.latitude != null);
  const kx = 111 * Math.cos(((O.lat + D.lat) / 2) * Math.PI / 180), ky = 111;
  const ax = O.lon * kx, ay = O.lat * ky, bx = D.lon * kx, by = D.lat * ky, len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
  const out = [];
  for (const [tipo, i] of L) {
    const px = i.longitude * kx, py = i.latitude * ky; const t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2;
    if (t < 0.1 || t > 0.9) continue;
    const dx = ax + t * (bx - ax) - px, dy = ay + t * (by - ay) - py; const dist = Math.hypot(dx, dy);
    if (dist < 15) out.push({ tipo, i, t, dist });
  }
  const por = {}; return out.sort((a, b) => a.t - b.t).filter(x => (por[x.tipo] = (por[x.tipo] || 0) + 1) <= 4).slice(0, 10);
}
function painelCarro(R) {
  const c = R.carro, O = R.origem, D = R.destino;
  if (!c.possivel) return `<p class="aviso-viagem">${ic('clock')} ${tv(c.motivo)}</p>`;
  const P = noPercurso(O, D), mid = [(O.lat + D.lat) / 2, (O.lon + D.lon) / 2];
  return `<div class="vj-dados vj-carro">${[['Distância por estrada', `≈ ${grp(c.estrada_km_estimada)} km`], ['Tempo de condução', `≈ ${hm(c.tempo_min_estimado)}`], ['Combustível', `≈ ${grp(c.consumo_litros_estimado)} ${tv('litros')}`]].map(([a, b]) => `<div class="vj-dado"><small>${tv(a)} · <span class="pill p-orange">${tv('estimativa')}</span></small><b class="num">${b}</b></div>`).join('')}</div>
   <p class="meta">${tv(c.pressupostos)}</p>
   <div class="vj-links"><a class="btn btn-navy" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&origin=${O.lat},${O.lon}&destination=${D.lat},${D.lon}&travelmode=driving">${ic('map')} ${tv('Percurso no Google Maps')}</a><a class="btn btn-ghost" target="_blank" rel="noopener" href="https://waze.com/ul?ll=${D.lat},${D.lon}&navigate=yes">${ic('car')} Waze</a><a class="btn btn-ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent('bombas de combustível')}/@${mid[0].toFixed(4)},${mid[1].toFixed(4)},9z">${ic('gauge')} ${tv('Postos de combustível')}</a><a class="btn btn-ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent('oficina mecânica')}/@${mid[0].toFixed(4)},${mid[1].toFixed(4)},9z">${ic('headset')} ${tv('Assistência mecânica')}</a></div>
   <h3 class="pn-sub">${ic('car')} ${tv('Sem carro próprio')}</h3>
   <div class="vj-links"><button class="btn btn-ghost" data-go="viaturas">${ic('car')} ${tv('Alugar uma viatura')}</button><button class="btn btn-ghost" data-vj-motorista>${ic('user')} ${tv('Viatura com motorista')}</button></div>
   <h3 class="pn-sub">${ic('pin')} ${tv('Paragens no percurso')}</h3>
   ${P.length ? `<div class="vj-paragens">${P.map(x => `<button class="vj-par" ${x.tipo === 'destino' ? `data-go="destinos"` : `data-open-res="${x.tipo}:${x.i.id}"`}><img src="${esc(x.i.imagem)}" alt="" loading="lazy"><span><b>${esc(x.i.nome)}</b><small>${tv({ restaurante: 'Restaurante', alojamento: 'Alojamento', destino: 'Destino' }[x.tipo])} · ${esc(x.i.municipio || x.i.provincia || '')} · ${tv('a')} ${Math.round(x.dist)} km ${tv('da linha recta')}</small></span></button>`).join('')}</div>` : `<p class="meta">${tv('Ainda não há lugares registados perto deste percurso.')}</p>`}`;
}
function painelLocal(R) {
  const D = R.destino;
  return `<p class="meta">${tv('Deslocação dentro da mesma província: táxi por aplicação, carro próprio ou alugado.')}</p><div class="vj-links"><button class="btn btn-red" data-taxi ${dadosLugar(D.lat, D.lon, D.nome, D.municipio || '', D.provincia)}>${ic('car')} ${tv('Chamar táxi')}</button><a class="btn btn-ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${D.lat},${D.lon}">${ic('map')} Google Maps</a><button class="btn btn-ghost" data-go="viaturas">${ic('car')} ${tv('Alugar uma viatura')}</button></div>`;
}
function continuidade(R) {
  const p = R.destino.provincia;
  const al = lista('alojamentos').filter(a => a.provincia === p).length, rs = lista('restaurantes').filter(a => a.provincia === p).length, xp = lista('experiencias').filter(a => a.provincia === p).length, ds = lista('destinos').filter(a => a.provincia === p).length;
  return `<section class="section card vj-cont"><h2>${tv('Organize a estadia em')} ${esc(p)}</h2><p class="meta">${tv('Depois do transporte: onde ficar, onde comer, o que visitar e o regresso.')}</p>
   <div class="vj-cont-grid"><button data-vj-ir="al:${esc(p)}">${ic('bed')}<b>${tv('Alojamento')}</b><small>${al} ${tv('opções')}</small></button><button data-vj-ir="rest:${esc(p)}">${ic('food')}<b>${tv('Restaurantes e pratos típicos')}</b><small>${rs} ${tv('opções')}</small></button><button data-vj-ir="dest:${esc(p)}">${ic('pin')}<b>${tv('Atracções')}</b><small>${ds} ${tv('destinos')}</small></button><button data-go="experiencias">${ic('palm')}<b>${tv('Experiências e guias')}</b><small>${xp} ${tv('na província')}</small></button><button data-k-ask="${esc(tv('Planeia um roteiro em {p} para a minha viagem').replace('{p}', p))}">${ic('chat')}<b>${tv('Roteiro com a ENDA')}</b><small>${tv('dia a dia')}</small></button><button data-vj-regresso>${ic('back')}<b>${tv('Planear o regresso')}</b><small>${esc(R.destino.provincia)} → ${esc(R.origem.provincia)}</small></button></div></section>`;
}
function resultados() {
  const R = VJ.res; if (!R) return '';
  const tabs = R.interprovincial ? [['rodoviario', 'car', 'Autocarros', R.rodoviario.length], ['aereo', 'globe', 'Voos', R.aereo.length], ['carro', 'map', 'De carro', null]] : [['local', 'car', 'Táxi e local', null], ['carro', 'map', 'De carro', null]];
  if (!tabs.some(t => t[0] === VJ.cat)) VJ.cat = tabs[0][0];
  const L = VJ.cat === 'rodoviario' ? R.rodoviario : VJ.cat === 'aereo' ? R.aereo : null;
  return `<section class="section"><h2 class="vj-titulo">${esc(tv(R.titulo).toUpperCase())}</h2><p><span class="pill ${R.interprovincial ? 'p-purple' : 'p-green'}">${tv(R.interprovincial ? 'Viagem interprovincial' : 'Dentro da mesma província')}</span> <span class="meta">${esc(R.origem.provincia)} → ${esc(R.destino.provincia)} · ${tv('linha recta')} ${grp(R.carro.linha_recta_km ?? Math.round(distKm(R.origem.lat, R.origem.lon, R.destino.lat, R.destino.lon)))} km</span></p>
   ${R.so_ar_mar ? `<p class="aviso-viagem">${ic('clock')} ${tv('Cabinda não tem ligação terrestre directa ao resto de Angola: viaje de avião ou de barco. Luanda–Cabinda: bilhetes vendidos só pela TAAG.')}</p>` : ''}
   <div class="vj-tabs" role="tablist">${tabs.map(([k, i, l, n]) => `<button role="tab" aria-selected="${VJ.cat === k}" data-vj-cat="${k}">${ic(i)} ${tv(l)}${n != null ? ` <span class="num">${n}</span>` : ''}</button>`).join('')}</div>
   ${L ? `${VJ.cat === 'aereo' ? `<div class="vj-aero"><div>${ic('globe')}<small>${tv('Partida')}</small><b>${esc(R.aeroportos.origem)}</b></div><div>${ic('pin')}<small>${tv('Chegada')}</small><b>${esc(R.aeroportos.destino)}</b></div></div>` : ''}
     <div class="vj-ordem"><label class="sort">${tv('Ordenar')} <select data-vj-ordem><option value="melhor" ${VJ.ordem === 'melhor' ? 'selected' : ''}>${tv('Melhor opção disponível')}</option><option value="preco" ${VJ.ordem === 'preco' ? 'selected' : ''}>${tv('Menor preço')}</option><option value="duracao" ${VJ.ordem === 'duracao' ? 'selected' : ''}>${tv('Menor duração')}</option><option value="horario" ${VJ.ordem === 'horario' ? 'selected' : ''}>${tv('Horário mais cedo')}</option></select></label><span class="meta">${tv('Preços e horários só aparecem quando confirmados pela transportadora.')}</span></div>
     <div class="vj-lista">${ordenar(L).map(cartaoOperador).join('') || empty(tv(VJ.cat === 'aereo' ? 'Sem voos domésticos registados entre estas províncias. Veja a viagem de carro ou de autocarro.' : 'Sem autocarros registados para esta ligação. Veja os voos ou a viagem de carro.'))}</div>`
     : VJ.cat === 'local' ? painelLocal(R) : painelCarro(R)}
  </section>${continuidade(R)}`;
}
V.viajar = () => {
  const sub = tv('Autocarros interprovinciais, voos domésticos e viagens de carro');
  return pageHead(tv('Como viajar'), sub, I('kalandula')) + `<div class="wrap"><section class="card vj-busca section">${blocoPonto('origem')}${blocoPonto('destino')}${formViagem()}</section>
   ${VJ.erro ? `<p class="erro-box">${esc(VJ.erro)}</p>` : ''}${VJ.carregando ? `<p class="meta">${tv('A pesquisar…')}</p>` : resultados()}</div>`;
};

/* ---------- continuar na plataforma ---------- */
function resumoTexto(o) {
  const R = VJ.res, f = VJ.form;
  return [`${tv('Transportadora')}: ${o.nome}`, `${tv('Origem')}: ${R.origem.nome} (${R.origem.provincia})`, `${tv('Destino')}: ${R.destino.nome} (${R.destino.provincia})`, `${tv('Tipo de viagem')}: ${tv(f.tipo_viagem === 'ida_volta' ? 'Ida e volta' : 'Só ida')}`,
    f.data_ida ? `${tv('Partida')}: ${f.data_ida}` : '', f.tipo_viagem === 'ida_volta' && f.data_volta ? `${tv('Regresso')}: ${f.data_volta}` : '', `${tv('Passageiros')}: ${f.passageiros}`].filter(Boolean).join('\n');
}
function abrirContinuar(id) {
  const R = VJ.res; const o = [...R.rodoviario, ...R.aereo].find(x => x.id === id); if (!o) return;
  const nota = { preenchido: 'A plataforma abre com estes dados já preenchidos. Complete o que faltar e pague na transportadora.', preenchido_a_confirmar: 'Tentamos abrir a pesquisa já preenchida. Se a página não mostrar a sua viagem, use o resumo abaixo.', site: 'Esta transportadora não aceita preenchimento automático: copie o resumo e complete a pesquisa no site oficial.' }[o.modo];
  const f = VJ.form, campos = { origem: 'Origem', destino: 'Destino', data_ida: 'Partida', data_volta: 'Regresso', tipo_viagem: 'Tipo de viagem' };
  openModal(`<div class="modal" role="dialog" aria-modal="true" aria-label="${tv('Resumo da viagem')}"><div class="mb">${modalHead(tv('Resumo da viagem'))}
   <dl class="vj-resumo"><dt>${tv('Transportadora')}</dt><dd>${esc(o.nome)}</dd><dt>${tv('Origem')}</dt><dd>${esc(R.origem.nome)} · ${esc(R.origem.provincia)}</dd><dt>${tv('Destino')}</dt><dd>${esc(R.destino.nome)} · ${esc(R.destino.provincia)}</dd><dt>${tv('Viagem')}</dt><dd>${tv(f.tipo_viagem === 'ida_volta' ? 'Ida e volta' : 'Só ida')}${f.data_ida ? ' · ' + dfmt(f.data_ida) : ''}${f.tipo_viagem === 'ida_volta' && f.data_volta ? ' → ' + dfmt(f.data_volta) : ''}</dd><dt>${tv('Passageiros')}</dt><dd>${f.passageiros}</dd></dl>
   <p class="${o.modo === 'site' ? 'aviso-viagem' : 'vj-nota'}">${tv(nota)}${o.preenchido.length ? ' ' + tv('Preenchido') + ': ' + o.preenchido.map(k => tv(campos[k])).join(', ') + '.' : ''}</p>
   <p class="meta">${tv('A reserva e o pagamento fazem-se na plataforma da transportadora. A viagem fica guardada em «As minhas viagens».')}</p>
   <div class="vj-op-bt"><button class="btn btn-red" data-vj-ir-plataforma="${o.id}">${tv('CONTINUAR NA PLATAFORMA')} ${ic('chev')}</button><button class="btn btn-ghost" data-vj-copiar="${o.id}">${ic('check')} ${tv('Copiar resumo')}</button></div></div></div>`);
}

/* ---------- AS MINHAS VIAGENS ---------- */
V.viagens = () => {
  const L = VJ.lista || [];
  return pageHead(tv('As minhas viagens'), tv('Pesquisas, redireccionamentos e reservas de transporte'), I('luanda')) + `<div class="wrap section">
   <p class="meta">${tv('Uma pesquisa não é uma reserva. Uma viagem só aparece como confirmada depois de a transportadora a confirmar.')}</p>
   <div class="vj-lista">${L.map(v => `<article class="card vj-viagem"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><span class="pill ${EST_V[v.estado]}">${tv(v.estado_rotulo)}</span><h3>${esc(v.origem_provincia)} → ${esc(v.destino_provincia)}</h3><p class="meta">${esc(v.origem_nome)} → ${esc(v.destino_nome)}</p></div><small class="meta">${dataSQL(v.criado_em).toLocaleDateString(I18N.loc)}</small></div>
     <p class="meta">${ic('cal')}${v.data_ida ? dfmt(v.data_ida) : tv('sem data')}${v.tipo_viagem === 'ida_volta' && v.data_volta ? ' → ' + dfmt(v.data_volta) : ''} · ${ic('users')}${v.passageiros}${v.transportadora ? ` · ${ic('car')}${esc(v.transportadora)}` : ''}</p>
     ${v.referencia ? `<p class="meta">${tv('Referência')}: <b class="num">${esc(v.referencia)}</b>${v.estado === 'reserva_pendente' ? ' · ' + tv('a aguardar confirmação da transportadora') : ''}</p>` : ''}
     <div class="vj-op-bt"><button class="btn btn-ghost" data-vj-repetir="${v.id}">${ic('search')} ${tv('Pesquisar de novo')}</button>${v.transportadora_id && ['redireccionada', 'reserva_pendente'].includes(v.estado) ? `<button class="btn btn-navy" data-vj-ref="${v.id}">${ic('ticket')} ${tv(v.referencia ? 'Alterar referência' : 'Já reservei: registar referência')}</button>` : ''}${!['reserva_confirmada', 'reserva_cancelada'].includes(v.estado) && v.estado !== 'pesquisa' ? `<button class="btn btn-ghost" data-vj-cancelar="${v.id}">${tv('Cancelar')}</button>` : ''}${v.estado !== 'reserva_confirmada' ? `<button class="circle" data-vj-apagar="${v.id}" aria-label="${tv('Apagar')}">${ic('trash')}</button>` : ''}</div></article>`).join('') || empty(tv('Ainda não pesquisou viagens. Abra um destino e toque em «Como viajar».'))}</div>
   <p style="text-align:center;margin-top:20px"><button class="btn btn-red" data-go="viajar">${ic('compass')} ${tv('Planear uma viagem')}</button></p></div>`;
};

/* ---------- acções ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.vjMudar) { VJ[d.vjMudar] = null; VJ.res = null; render(); return; }
  if (d.vjGps !== undefined) { b.disabled = true; const r = await pedirLocalizacao(); b.disabled = false; if (r.erro) { toast(tv(r.erro)); return; } VJ.origem = { lat: r.lat, lon: r.lon, nome: tv('A minha localização') }; VJ.res = null; render(); return; }
  if (d.vjCat) { VJ.cat = d.vjCat; render(); return; }
  if (d.vjContinuar) return abrirContinuar(+d.vjContinuar);
  if (d.vjCopiar) { const o = [...VJ.res.rodoviario, ...VJ.res.aereo].find(x => x.id === +d.vjCopiar); try { await navigator.clipboard.writeText(resumoTexto(o)); toast(tv('Resumo copiado.')); } catch (er) { toast(tv('Não foi possível copiar.')); } return; }
  if (d.vjIrPlataforma) {
    const w = window.open('about:blank', '_blank'); // aberta já no toque, para não ser bloqueada
    try { const r = await API.post(`/api/viagens/${VJ.res.viagem_id}/continuar`, { transportadora_id: +d.vjIrPlataforma }); if (w) { w.opener = null; w.location.href = r.url; } else location.href = r.url; closeModal(); toast(tv('Guardado em «As minhas viagens».')); }
    catch (er) { w?.close(); toast(er.message); } return;
  }
  if (d.vjMotorista !== undefined) { const D = VJ.res.destino; abrirTaxi({ lat: D.lat, lon: D.lon, nome: D.nome, end: '', prov: D.provincia }); return; }
  if (d.vjIr) { const [k, p] = d.vjIr.split(':'); S.f['p_' + k] = p; location.hash = { al: 'alojamentos', rest: 'gastronomia', dest: 'destinos' }[k]; return; }
  if (d.vjRegresso !== undefined) { const R = VJ.res; VJ.origem = { lat: R.destino.lat, lon: R.destino.lon, nome: R.destino.nome }; VJ.destino = { lat: R.origem.lat, lon: R.origem.lon, nome: R.origem.nome }; if (VJ.form.data_volta) { VJ.form.data_ida = VJ.form.data_volta; VJ.form.data_volta = ''; } VJ.form.tipo_viagem = 'ida'; VJ.res = null; VJ.cat = null; await pesquisarViagem(); render(); scrollTo(0, 0); return; }
  if (d.vjRepetir) { const v = VJ.lista.find(x => x.id === +d.vjRepetir); VJ.origem = { lat: v.origem_lat, lon: v.origem_lon, nome: v.origem_nome }; VJ.destino = v.destino_tipo && v.destino_item_id ? { tipo: v.destino_tipo, id: v.destino_item_id } : { lat: v.destino_lat, lon: v.destino_lon, nome: v.destino_nome };
    Object.assign(VJ.form, { tipo_viagem: v.tipo_viagem, data_ida: v.data_ida && v.data_ida >= hojeISO() ? v.data_ida : amanha(), data_volta: v.data_volta || '', passageiros: v.passageiros }); VJ.res = null; VJ.cat = v.categoria || null; location.hash = 'viajar'; return; }
  if (d.vjRef) { const v = VJ.lista.find(x => x.id === +d.vjRef);
    openModal(`<div class="modal" role="dialog" aria-modal="true"><form class="mb" data-vj-reff="${v.id}">${modalHead(tv('Referência da reserva'))}<p class="meta">${tv('Escreva a referência ou o código do bilhete que a transportadora lhe deu. A viagem fica «reserva pendente» até a transportadora a confirmar.')}</p><label class="field">${tv('Referência')}<input name="referencia" required minlength="3" maxlength="60" value="${esc(v.referencia || '')}"></label><p class="err" hidden></p><button class="btn btn-red" type="submit">${tv('Guardar')}</button></form></div>`); return; }
  if (d.vjCancelar) { try { await API.patch('/api/viagens/' + d.vjCancelar, { acao: 'cancelar' }); toast(tv('Viagem cancelada.')); render(); } catch (er) { toast(er.message); } return; }
  if (d.vjApagar) { if (b.dataset.confirmar !== '1') { b.dataset.confirmar = '1'; b.classList.add('pn-confirmar'); toast(tv('Toque outra vez para apagar.')); setTimeout(() => { b.dataset.confirmar = ''; b.classList.remove('pn-confirmar'); }, 4000); return; } try { await API.del('/api/viagens/' + d.vjApagar); render(); } catch (er) { toast(er.message); } }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.matches('[data-vj-dest]') && t.value) { VJ.destino = { tipo: 'destino', id: +t.value }; VJ.res = null; render(); }
  if (t.matches('[data-vj-prov]') && t.value) { VJ[t.dataset.vjProv] = { provincia: t.value }; VJ.res = null; render(); }
  if (t.matches('[data-vj-ordem]')) { VJ.ordem = t.value; render(); }
  if (t.matches('[data-vj-form] [name=tipo_viagem]')) { VJ.form.tipo_viagem = t.value; render(); }
});
document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.matches('[data-vj-form]')) { e.preventDefault(); const fd = new FormData(f); Object.assign(VJ.form, { tipo_viagem: fd.get('tipo_viagem') || 'ida', data_ida: fd.get('data_ida') || '', data_volta: fd.get('data_volta') || '', passageiros: Math.max(1, Math.min(20, +fd.get('passageiros') || 1)) }); VJ.res = null; await pesquisarViagem(); render(); return; }
  if (f.matches('[data-vj-reff]')) { e.preventDefault(); try { await API.patch('/api/viagens/' + f.dataset.vjReff, { acao: 'referencia', referencia: f.referencia.value }); closeModal(); toast(tv('Referência guardada.')); render(); } catch (er) { const p = f.querySelector('.err'); p.hidden = false; p.textContent = er.message; } }
});
