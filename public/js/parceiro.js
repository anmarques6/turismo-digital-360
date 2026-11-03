/* =========================================================
   ANGOLA 365º — Área do parceiro (operadores turísticos)
   O parceiro regista o negócio (dados, localização, preços). O tipo de negócio escolhe sozinho o catálogo,
   os campos do formulário e os valores fixos. A administração aprova antes de publicar.
   Carregado depois de a365.js.
   ========================================================= */
ROUTES.push('negocio');
NAV.splice(NAV.findIndex(n => n[0] === 'perfil') + 1, 0, ['sep', 'Parceiros'], ['negocio', 'brief', 'Área do parceiro']);

const PN = { esq: null, painel: null, passo: 'tipo', tipo: null, novo: false, geo: {} };
const PN_EST = { em_revisao: ['Em revisão', 'p-orange'], aprovado: ['Aprovado · publicado', 'p-green'], rejeitado: ['A corrigir', 'p-red'], suspenso: ['Suspenso', 'p-red'] };
const PN_RES = { pendente: ['Pagamento pendente', 'p-orange'], confirmada: ['Confirmada', 'p-green'], concluida: ['Concluída', 'p-blue'], cancelada: ['Cancelada', 'p-red'] };
const tr_ = s => I18N.t(s);

/* ---------- formulário gerado a partir do esquema ---------- */
function pnCampo(pref, k, c, v) {
  const id = `${pref}-${k}`, nm = `${pref}_${k}`, req = c.req ? ' required' : '', lab = `<span>${esc(tr_(c.label))}${c.req ? ' <b style="color:var(--red)">*</b>' : ''}</span>`;
  if (v === undefined || v === null) v = c.def ?? '';
  switch (c.t) {
    case 'textarea': return `<label class="field pn-full" for="${id}">${lab}<textarea id="${id}" name="${nm}" rows="3"${req}>${esc(v)}</textarea></label>`;
    case 'list': return `<label class="field pn-full" for="${id}">${lab}<textarea id="${id}" name="${nm}" rows="3" data-pn-lista placeholder="${esc(tr_('Um por linha'))}">${esc(Array.isArray(v) ? v.join('\n') : v)}</textarea></label>`;
    case 'int': case 'num': return `<label class="field" for="${id}">${lab}<input id="${id}" name="${nm}" type="number" inputmode="${c.t === 'int' ? 'numeric' : 'decimal'}" ${c.min != null ? `min="${c.min}"` : ''} ${c.max != null ? `max="${c.max}"` : ''} step="${c.step || 1}" value="${esc(v)}"${req}></label>`;
    case 'select': return `<label class="field" for="${id}">${lab}<select id="${id}" name="${nm}"${req}>${c.req ? '' : '<option value=""></option>'}${c.opts.map(o => `<option ${String(v) === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    case 'bool': return `<label class="lembrar pn-full" style="font-weight:600"><input type="checkbox" name="${nm}" data-pn-bool ${Number(v) ? 'checked' : ''}> ${esc(tr_(c.label))}</label>`;
    case 'date': return `<label class="field" for="${id}">${lab}<input id="${id}" name="${nm}" type="date" value="${esc(v)}"${req}></label>`;
    case 'time': return `<label class="field" for="${id}">${lab}<input id="${id}" name="${nm}" type="time" value="${esc(v)}"${req}></label>`;
    case 'image': return `<div class="field pn-full"><span>${lab}</span><input type="hidden" name="${nm}" value="${esc(v)}"><div class="pn-fotos" data-pn-prev="${nm}">${v ? `<img src="${esc(v)}" alt="">` : ''}</div><label class="btn btn-ghost pn-foto-btn">${ic('camera')} ${tr_(v ? 'Trocar fotografia' : 'Carregar fotografia')}<input type="file" accept="image/png,image/jpeg,image/webp" data-pn-foto="${nm}" hidden></label></div>`;
    case 'images': { const L = Array.isArray(v) ? v : []; return `<div class="field pn-full"><span>${lab}</span><input type="hidden" name="${nm}" data-pn-json value="${esc(JSON.stringify(L))}"><div class="pn-fotos" data-pn-prev="${nm}">${L.map(u => `<img src="${esc(u)}" alt="">`).join('')}</div><label class="btn btn-ghost pn-foto-btn">${ic('camera')} ${tr_('Acrescentar fotografias')}<input type="file" accept="image/png,image/jpeg,image/webp" multiple data-pn-foto="${nm}" data-pn-varias hidden></label></div>`; }
    default: return `<label class="field" for="${id}">${lab}<input id="${id}" name="${nm}" type="${k === 'email' ? 'email' : k === 'telefone' ? 'tel' : k === 'site' || k.endsWith('_url') ? 'url' : 'text'}" value="${esc(v)}"${req}></label>`;
  }
}
// Bloco da localização: GPS do telemóvel, pesquisa de endereço ou coordenadas
function pnLocal(pref, v = {}, opcional) {
  return `<fieldset class="pn-local pn-full"><legend>${ic('pin')} ${tr_(opcional ? 'Localização (vazio = a do negócio)' : 'Localização do negócio')}${opcional ? '' : ' <b style="color:var(--red)">*</b>'}</legend>
   <label class="field" for="${pref}-endereco">${tr_('Endereço (rua, bairro ou ponto de referência)')}<input id="${pref}-endereco" name="${pref}_endereco" value="${esc(v.endereco || '')}" ${opcional ? '' : 'required'}></label>
   ${pref === 'n' ? `<label class="field" for="n-bairro">${tr_('Bairro')}<input id="n-bairro" name="n_bairro" value="${esc(v.bairro || '')}"></label>` : ''}
   <div class="pn-geo-acoes"><button type="button" class="btn btn-navy" data-pn-gps="${pref}">${ic('compass')} ${tr_('Usar a minha localização actual')}</button>
    <span class="pn-ou">${tr_('ou')}</span><input type="search" data-pn-geo-q="${pref}" placeholder="${esc(tr_('Pesquisar o endereço ou o nome do lugar'))}" aria-label="${esc(tr_('Pesquisar endereço'))}"><button type="button" class="btn btn-ghost" data-pn-geo-btn="${pref}">${ic('search')}</button></div>
   <div data-pn-geo-res="${pref}"></div>
   <div class="pn-coords"><label class="field" for="${pref}-lat">Latitude<input id="${pref}-lat" name="${pref}_latitude" type="number" step="0.0000001" min="-18.1" max="-4.3" value="${v.latitude ?? ''}" ${opcional ? '' : 'required'}></label><label class="field" for="${pref}-lon">Longitude<input id="${pref}-lon" name="${pref}_longitude" type="number" step="0.0000001" min="11.6" max="24.1" value="${v.longitude ?? ''}" ${opcional ? '' : 'required'}></label></div>
   <p class="meta" data-pn-onde="${pref}">${v.municipio ? `${ic('pin')} ${esc(v.municipio)}${v.provincia ? ', ' + esc(v.provincia) : ''}` : tr_('O município e a província são definidos pelo mapa oficial de Angola.')}</p></fieldset>`;
}
// Campos do produto (catálogo do tipo de negócio). `principal`: produto criado com o negócio (o nome é o do negócio)
function pnCamposProduto(tabela, tipoNeg, v = {}, principal) {
  const C = PN.esq.campos[tabela], nomeK = PN.esq.recursos[tabela].campoNome;
  const tipoLivre = ['apartamentos', 'villa'].includes(tipoNeg);
  const ks = Object.keys(C).filter(k => !(principal && k === nomeK) && !(principal === 'novo' && k === 'imagem') && !(k === 'tipo' && !tipoLivre) && !['endereco', 'latitude', 'longitude'].includes(k));
  const geo = 'latitude' in C;
  return ks.map(k => pnCampo('p', k, C[k], v[k])).join('') + (geo && !principal ? pnLocal('p', v, true) : '');
}
function pnLer(form, pref) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || !el.name.startsWith(pref + '_')) continue; const k = el.name.slice(pref.length + 1);
    if (el.dataset.pnBool !== undefined) o[k] = el.checked ? 1 : 0;
    else if (el.dataset.pnLista !== undefined) o[k] = el.value.split('\n').map(x => x.trim()).filter(Boolean);
    else if (el.dataset.pnJson !== undefined) { try { o[k] = JSON.parse(el.value || '[]'); } catch (e) { o[k] = []; } }
    else o[k] = el.value.trim();
  }
  return o;
}

/* ---------- vista ---------- */
const pnPreco = p => { const t = p._tabela, v = t === 'alojamentos' ? [p.preco_noite, 'noite'] : t === 'restaurantes' ? [p.preco_medio, 'pessoa'] : t === 'viaturas' ? [p.preco_dia, 'dia'] : t === 'tradutores' ? [p.preco_hora, 'hora'] : [p.preco, t === 'eventos' ? 'bilhete' : 'pessoa']; return v[0] == null ? tr_('Sob consulta') : v[0] === 0 ? tr_('Grátis') : `${kz(v[0])} / ${tr_(v[1])}`; };
function vTipos() {
  const G = {}; for (const [k, t] of Object.entries(PN.esq.tipos)) (G[t.grupo] ||= []).push([k, t]);
  return `<section class="section"><div class="sec-head"><h2>${tr_('1. Que tipo de negócio tem?')}</h2></div><p class="meta" style="margin-bottom:14px">${tr_('O tipo de negócio define automaticamente onde aparece no Angola 365º e o que lhe vamos pedir.')}</p>
   ${Object.entries(G).map(([g, L]) => `<h3 class="pn-grupo">${esc(tr_(g))}</h3><div class="pn-tipos">${L.map(([k, t]) => `<button type="button" class="card pn-tipo" data-pn-tipo="${k}">${ic(t.icone)}<b>${esc(tr_(t.nome))}</b><small>${esc(tr_(PN.esq.recursos[t.tabela].titulo))}${t.unico ? '' : ' · ' + tr_('vários produtos')}</small></button>`).join('')}</div>`).join('')}</section>`;
}
function vFormNegocio(n = null) {
  const tipo = n ? n.tipo_negocio : PN.tipo, T = PN.esq.tipos[tipo], R = PN.esq.recursos[T.tabela];
  const u = S.user, v = n || PN.pre || {};
  return `<form class="card pn-form section" data-pn-negocio="${n ? n.id : ''}" novalidate>
   <div class="pn-form-top">${ic(T.icone)}<div><h2>${n ? tr_('Editar negócio') : tr_('2. Dados do negócio')}</h2><p class="meta">${esc(tr_(T.nome))} · ${tr_('aparece em')} <b>${esc(tr_(R.titulo))}</b></p></div>${n || PN.reclamar ? '' : `<button type="button" class="link" data-pn-voltar>${tr_('Mudar o tipo')}</button>`}</div>
   ${PN.reclamar && !n ? `<p class="aviso-viagem pn-full">${ic('badge')} ${tr_('Está a pedir a propriedade da ficha')} <b>«${esc(PN.reclamar.nome)}»</b>. ${tr_('Confirme ou corrija os dados. A equipa Angola 365º verifica que é o dono (por telefone ou e-mail do estabelecimento) antes de lhe entregar a ficha.')}</p>` : ''}<div class="pn-grid">
    ${pnCampo('n', 'nome', { t: 'text', label: 'Nome do negócio', req: 1 }, v.nome)}
    ${pnCampo('n', 'telefone', { t: 'text', label: 'Telefone de contacto', req: 1 }, v.telefone ?? u.telefone)}
    ${pnCampo('n', 'email', { t: 'text', label: 'E-mail do negócio' }, v.email ?? u.email)}
    ${pnCampo('n', 'site', { t: 'text', label: 'Site ou rede social (https://…)' }, v.site)}
    ${pnCampo('n', 'nif', { t: 'text', label: 'NIF (opcional)' }, v.nif)}
    ${pnCampo('n', 'descricao', { t: 'textarea', label: 'Apresentação do negócio' }, v.descricao)}
    ${pnCampo('n', 'imagem', { t: 'image', label: 'Fotografia principal' }, v.imagem)}
    ${pnLocal('n', v)}
    ${!n && T.unico ? `<h3 class="pn-full pn-sub">${ic('wallet')} ${tr_('3. Preços e detalhes')}</h3>${pnCamposProduto(T.tabela, tipo, PN.pre?.produto || {}, 'novo')}` : ''}
   </div>
   <p class="erro-box" data-pn-err hidden></p>
   <div class="pn-acoes"><button class="btn btn-red" type="submit">${ic('check')} ${n ? tr_('Guardar alterações') : tr_('Enviar para aprovação')}</button>${n || PN.painel?.negocios.length ? `<button type="button" class="btn btn-ghost" data-pn-cancelar>${tr_('Cancelar')}</button>` : ''}</div>
   ${n ? '' : `<p class="meta">${tr_('A nossa equipa confirma os dados e publica o seu negócio, normalmente em 1 a 2 dias úteis. Recebe uma notificação quando estiver publicado.')}</p>`}
  </form>`;
}
function vPainel() {
  const P = PN.painel, R = P.resumo;
  return `<div class="stats section"><div><b class="num">${P.negocios.length}</b><small>${tr_('Negócios')}</small></div><div><b class="num">${R.publicados}/${R.produtos}</b><small>${tr_('Produtos publicados')}</small></div><div><b class="num">${R.reservas}</b><small>${tr_('Reservas')}</small></div><div><b class="num" style="color:var(--gold)">${kz(R.receita)}</b><small>${tr_('Vendas confirmadas')}</small></div></div>
  ${P.negocios.map(n => { const T = PN.esq.tipos[n.tipo_negocio] || {}, [el, ec] = PN_EST[n.estado], Rr = PN.esq.recursos[T.tabela] || {}; const prods = P.produtos.filter(p => p.negocio_id === n.id);
    return `<section class="card pn-neg section"><div class="pn-neg-top">${n.imagem ? `<img src="${esc(n.imagem)}" alt="">` : `<span class="pn-neg-ic">${ic(T.icone || 'brief')}</span>`}<div style="flex:1;min-width:0"><span class="pill ${ec}">${tr_(el)}</span><h2>${esc(n.nome)}</h2><p class="meta">${esc(tr_(T.nome || n.tipo_negocio))} · ${ic('pin')}${esc([n.endereco, n.municipio, n.provincia].filter(Boolean).join(', '))}</p><p class="meta">${ic('phone')}${esc(n.telefone || '')}${n.email ? ' · ' + esc(n.email) : ''}</p></div>
     <div class="pn-neg-bt"><button class="btn btn-ghost" data-pn-editar-neg="${n.id}">${ic('edit')} ${tr_('Editar negócio')}</button>${n.estado !== 'suspenso' ? `<button class="btn btn-navy" data-pn-novo-prod="${n.id}">${ic('plus')} ${tr_('Adicionar')} ${esc(tr_(Rr.singular || 'produto').toLowerCase())}</button>` : ''}</div></div>
     ${n.reclama_nome ? `<p class="meta">${ic('badge')} ${tr_('Pedido de propriedade da ficha')} <b>«${esc(n.reclama_nome)}»</b>${n.estado === 'aprovado' ? ' · ' + tr_('atribuída') : ''}</p>` : ''}
     ${n.estado === 'em_revisao' ? `<p class="aviso-viagem">${ic('clock')} ${tr_('Em revisão pela equipa Angola 365º. Os produtos ficam visíveis no site assim que o negócio for aprovado.')}</p>` : ''}
     ${n.nota_admin && n.estado !== 'aprovado' ? `<p class="erro-box">${ic('chat')} <b>${tr_('Mensagem da administração:')}</b> ${esc(n.nota_admin)}${n.estado === 'rejeitado' ? ' — ' + tr_('corrija e guarde o negócio para voltar à revisão.') : ''}</p>` : ''}
     <h3 class="pn-sub">${esc(tr_(Rr.titulo || 'Produtos'))} <small class="meta">(${prods.length})</small></h3>
     <div class="pn-prods">${prods.map(p => `<article class="pn-prod"><img src="${esc(p.imagem)}" alt="" loading="lazy"><div style="flex:1;min-width:0"><b>${esc(p._nome)}</b><p class="meta">${esc([p.tipo || p.categoria, p.data ? dfmt(p.data) + ' ' + (p.hora || '') : ''].filter(Boolean).join(' · '))}</p><p class="meta num"><b>${pnPreco(p)}</b></p><span class="pill ${p.ativo ? 'p-green' : 'p-orange'}">${p.ativo ? tr_('Publicado') : n.estado === 'aprovado' ? tr_('Escondido') : tr_('Aguarda aprovação')}</span></div>
       <div class="pn-prod-bt"><button class="circle" data-pn-editar-prod="${p._tabela}:${p.id}" aria-label="${tr_('Editar')}">${ic('edit')}</button>${n.estado === 'aprovado' ? `<button class="circle" data-pn-ver="${p._tabela}:${p.id}:${p.ativo ? 0 : 1}" aria-label="${tr_(p.ativo ? 'Esconder' : 'Publicar')}" title="${tr_(p.ativo ? 'Esconder' : 'Publicar')}">${ic('eye')}</button>` : ''}<button class="circle" data-pn-apagar="${p._tabela}:${p.id}" aria-label="${tr_('Apagar')}">${ic('trash')}</button></div></article>`).join('') || `<p class="meta">${tr_('Ainda sem produtos. Toque em «Adicionar» para criar o primeiro.')}</p>`}</div></section>`; }).join('')}
  <section class="section"><div class="sec-head"><h2>${tr_('Reservas recebidas')}</h2></div>${P.reservas.length ? `<div class="pn-res">${P.reservas.map(r => { const [l, c] = PN_RES[r.estado] || [r.estado, 'p-blue']; return `<article class="card pn-r"><div><span class="pill ${c}">${tr_(l)}</span><h3>${esc(r.item_nome)}</h3><p class="meta">${ic('cal')}${r.data_inicio ? dfmt(r.data_inicio) : ''}${r.data_fim ? ' → ' + dfmt(r.data_fim) : ''} · ${r.quantidade} ${tr_(r.unidade)}${r.quantidade > 1 ? 's' : ''} · <b class="num">${kzOuGratis(r.total)}</b></p><p class="meta">${ic('user')}<b>${esc(r.cliente_nome)}</b>${r.cliente_telefone ? ` · <a href="tel:${esc(r.cliente_telefone)}">${esc(r.cliente_telefone)}</a>` : ''} · <a href="mailto:${esc(r.cliente_email)}">${esc(r.cliente_email)}</a></p><p class="meta num">${tr_('Código')} <b>${esc(r.codigo)}</b></p></div>${r.estado === 'confirmada' ? `<button class="btn btn-ghost" data-pn-concluir="${r.id}">${ic('check')} ${tr_('Marcar como concluída')}</button>` : ''}</article>`; }).join('')}</div>` : empty(tr_('Ainda não recebeu reservas. Quando um cliente reservar, recebe uma notificação.'))}</section>
  <p style="text-align:center;margin:26px 0"><button class="btn btn-ghost" data-pn-outro>${ic('plus')} ${tr_('Registar outro negócio')}</button></p>`;
}
V.negocio = () => {
  const P = PN.painel; if (!PN.esq || !P) return pageHead(tr_('Área do parceiro'), '', I('luanda')) + `<div class="wrap section"><p class="meta">${tr_('A carregar…')}</p></div>`;
  const novo = PN.novo || !P.negocios.length;
  const intro = !P.negocios.length ? `<div class="banner b-navy section"><span class="b-ico">${ic('brief')}</span><div class="txt"><h3>${tr_('Tem um hotel, restaurante, rent-a-car ou agência?')}</h3><p>${tr_('Registe o seu negócio no Angola 365º: indique a localização e os preços, receba reservas e pagamentos de turistas de Angola e do mundo.')}</p></div></div>` : '';
  return pageHead(tr_('Área do parceiro'), P.negocios.length ? tr_('Os seus negócios, produtos e reservas') : tr_('Registe o seu negócio no Angola 365º'), I('luanda')) +
    `<div class="wrap">${intro}${PN.editarNeg ? vFormNegocio(P.negocios.find(n => n.id === PN.editarNeg)) : novo ? (PN.passo === 'form' && PN.tipo ? vFormNegocio() : vTipos()) : vPainel()}</div>`;
};

/* ---------- produto (modal) ---------- */
function abrirProduto(negId, tabela, id) {
  const n = PN.painel.negocios.find(x => x.id === negId); const T = PN.esq.tipos[n.tipo_negocio]; tabela ||= T.tabela;
  const p = id ? PN.painel.produtos.find(x => x._tabela === tabela && x.id === id) : {};
  const R = PN.esq.recursos[tabela], principal = id && T.unico && PN.painel.produtos.filter(x => x.negocio_id === n.id && x._tabela === tabela).map(x => x.id).sort((a, b) => a - b)[0] === id;
  openModal(`<div class="modal pn-modal" role="dialog" aria-modal="true" aria-label="${esc(R.singular)}"><form class="mb" data-pn-prod="${n.id}:${tabela}:${id || ''}" novalidate>${modalHead(`${id ? tr_('Editar') : tr_('Novo')} · ${esc(tr_(R.singular))}`)}
   <p class="meta">${esc(n.nome)}${principal ? ' · ' + tr_('o nome e a localização vêm do negócio') : ''}</p>
   <div class="pn-grid">${pnCamposProduto(tabela, n.tipo_negocio, p, principal)}</div>
   <p class="erro-box" data-pn-err hidden></p><button class="btn btn-red" type="submit">${ic('check')} ${tr_('Guardar')}</button></form></div>`);
}

/* ---------- fotografias: reduzidas no telemóvel antes de enviar ---------- */
function reduzirImagem(file, max = 1600) {
  return new Promise((ok, falha) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return falha(new Error(tr_('Escolha uma fotografia JPG, PNG ou WEBP.')));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.85)); };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error(tr_('Não foi possível ler a fotografia.'))); };
    img.src = url;
  });
}
async function enviarFotos(input) {
  const nm = input.dataset.pnFoto, form = input.closest('form'), hid = form.querySelector(`[name="${nm}"]`), prev = form.querySelector(`[data-pn-prev="${nm}"]`), varias = input.dataset.pnVarias !== undefined;
  const lbl = input.closest('label'); const txt = lbl.firstChild; lbl.classList.add('a-enviar');
  try {
    for (const f of [...input.files].slice(0, varias ? 8 : 1)) {
      const { caminho } = await API.post('/api/parceiro/upload', { dados: await reduzirImagem(f) });
      if (varias) { const L = JSON.parse(hid.value || '[]'); L.push(caminho); hid.value = JSON.stringify(L); prev.insertAdjacentHTML('beforeend', `<img src="${caminho}" alt="">`); }
      else { hid.value = caminho; prev.innerHTML = `<img src="${caminho}" alt="">`; }
    }
  } catch (er) { toast(er.message); } finally { lbl.classList.remove('a-enviar'); input.value = ''; void txt; }
}
async function pnOnde(pref, form) {
  const lat = +form.querySelector(`[name="${pref}_latitude"]`).value, lon = +form.querySelector(`[name="${pref}_longitude"]`).value, out = form.querySelector(`[data-pn-onde="${pref}"]`);
  if (!lat || !lon) return;
  try { const l = (await API.get(`/api/geo/localizar?lat=${lat}&lon=${lon}`)).local; out.innerHTML = l ? `${ic('pin')} <b>${esc(l.municipio)}, ${esc(l.provincia)}</b> · <a class="link" style="display:inline" href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}" target="_blank" rel="noopener">${tr_('confirmar no mapa')}</a>` : `<span style="color:var(--red)">${tr_('Fora do mapa de Angola: confirme a posição.')}</span>`; } catch (e) {}
}
const pnPor = (form, pref, lat, lon) => { form.querySelector(`[name="${pref}_latitude"]`).value = (+lat).toFixed(7); form.querySelector(`[name="${pref}_longitude"]`).value = (+lon).toFixed(7); pnOnde(pref, form); };

async function recarregarPainel() { PN.painel = await API.get('/api/parceiro/painel'); }
const _antesDePN = antesDe;
antesDe = async r => { if (r === 'negocio') { if (!PN.esq) PN.esq = await API.get('/api/parceiro/esquema'); await recarregarPainel(); } return _antesDePN(r); };

/* ---------- acções ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.reclamar) {
    const [tipo, id] = d.reclamar.split(':'); const it = item(tipo, id); if (!it) return;
    const tabela = tipo === 'alojamento' ? 'alojamentos' : 'restaurantes';
    if (!PN.esq) PN.esq = await API.get('/api/parceiro/esquema');
    PN.tipo = tabela === 'restaurantes' ? 'restaurante' : Object.keys(PN.esq.tipos).find(k => PN.esq.tipos[k].fixo?.tipo === it.tipo) || 'hotel';
    PN.reclamar = { tabela, id: it.id, nome: it.nome };
    PN.pre = { nome: it.nome, telefone: it.telefone, site: it.site, endereco: it.endereco || it.local, bairro: it.bairro, latitude: it.latitude, longitude: it.longitude, municipio: it.municipio, provincia: it.provincia, descricao: it.descricao,
      produto: { quartos: it.quartos, comodidades: it.comodidades, especialidade: it.especialidade, nivel_preco: it.nivel_preco, horario: it.horario, descricao: it.descricao, etiqueta: it.etiqueta } };
    PN.novo = true; PN.passo = 'form'; PN.editarNeg = null; location.hash = 'negocio'; scrollTo(0, 0); return;
  }
  if (d.pnTipo) { PN.tipo = d.pnTipo; PN.passo = 'form'; render(); scrollTo(0, 0); return; }
  if (d.pnVoltar !== undefined) { PN.passo = 'tipo'; render(); return; }
  if (d.pnCancelar !== undefined) { PN.reclamar = null; PN.pre = null; PN.novo = false; PN.editarNeg = null; PN.passo = 'tipo'; render(); return; }
  if (d.pnOutro !== undefined) { PN.novo = true; PN.passo = 'tipo'; render(); scrollTo(0, 0); return; }
  if (d.pnEditarNeg) { PN.editarNeg = +d.pnEditarNeg; render(); scrollTo(0, 0); return; }
  if (d.pnNovoProd) return abrirProduto(+d.pnNovoProd);
  if (d.pnEditarProd) { const [t, id] = d.pnEditarProd.split(':'); const p = PN.painel.produtos.find(x => x._tabela === t && x.id === +id); return abrirProduto(p.negocio_id, t, +id); }
  if (d.pnVer) { const [t, id, a] = d.pnVer.split(':'); try { await API.patch(`/api/parceiro/produtos/${t}/${id}`, { ativo: +a }); toast(tr_(+a ? 'Produto publicado.' : 'Produto escondido do site.')); render(); } catch (er) { toast(er.message); } return; }
  if (d.pnApagar) {
    if (b.dataset.confirmar !== '1') { b.dataset.confirmar = '1'; b.classList.add('pn-confirmar'); toast(tr_('Toque outra vez para apagar.')); setTimeout(() => { b.dataset.confirmar = ''; b.classList.remove('pn-confirmar'); }, 4000); return; }
    const [t, id] = d.pnApagar.split(':'); try { const r = await API.del(`/api/parceiro/produtos/${t}/${id}`); toast(tr_(r.mensagem || 'Produto apagado.')); render(); } catch (er) { toast(er.message); } return;
  }
  if (d.pnConcluir) { try { await API.patch('/api/parceiro/reservas/' + d.pnConcluir, { estado: 'concluida' }); toast(tr_('Reserva concluída.')); render(); } catch (er) { toast(er.message); } return; }
  if (d.pnGps) {
    const form = b.closest('form'); b.disabled = true; const t0 = b.innerHTML; b.innerHTML = `${ic('compass')} ${tr_('A obter a localização…')}`;
    const r = await pedirLocalizacao(); b.disabled = false; b.innerHTML = t0;
    if (r.erro) return toast(tr_(r.erro));
    pnPor(form, d.pnGps, r.lat, r.lon); if (r.precisao > 100) toast(tr_('Localização com precisão de {m} m: confirme no mapa.').replace('{m}', r.precisao)); return;
  }
  if (d.pnGeoBtn) return pnPesquisar(b.closest('form'), d.pnGeoBtn);
  if (d.pnGeoEscolher) { const form = b.closest('form'); const g = JSON.parse(d.pnGeoEscolher); pnPor(form, g.pref, g.lat, g.lon); const end = form.querySelector(`[name="${g.pref}_endereco"]`); if (end && !end.value) end.value = g.nome; form.querySelector(`[data-pn-geo-res="${g.pref}"]`).innerHTML = ''; return; }
});
async function pnPesquisar(form, pref) {
  const q = form.querySelector(`[data-pn-geo-q="${pref}"]`).value.trim(), box = form.querySelector(`[data-pn-geo-res="${pref}"]`); if (q.length < 2) return;
  box.innerHTML = `<p class="meta">${tr_('A pesquisar…')}</p>`;
  try {
    const r = await API.get('/api/geo/pesquisa?q=' + encodeURIComponent(q) + '&lang=' + I18N.lang);
    const L = [...r.lugares.map(l => ({ nome: l.nome, sub: l.endereco, lat: l.lat, lon: l.lon })), ...r.catalogo.map(i => ({ nome: i.nome, sub: [i.municipio, i.provincia].filter(Boolean).join(', '), lat: i.lat, lon: i.lon }))].filter(l => l.lat != null);
    box.innerHTML = L.length ? `<ul class="mapa-lista">${L.slice(0, 8).map(l => `<li><button type="button" data-pn-geo-escolher='${esc(JSON.stringify({ pref, nome: l.nome, lat: l.lat, lon: l.lon }))}'>${ic('pin')}${esc(l.nome)}<small>${esc(l.sub || '')}</small></button></li>`).join('')}</ul><p class="meta" style="font-size:11px">${esc(r.atribuicao || '')}</p>` : `<p class="meta">${tr_('Nada encontrado. Use a sua localização actual ou escreva as coordenadas.')}</p>`;
  } catch (er) { box.innerHTML = `<p class="erro-box">${esc(er.message)}</p>`; }
}
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-pn-geo-q]')) { e.preventDefault(); pnPesquisar(e.target.closest('form'), e.target.dataset.pnGeoQ); } });
document.addEventListener('change', e => {
  if (e.target.matches('[data-pn-foto]')) enviarFotos(e.target);
  if (e.target.matches('[name$="_latitude"],[name$="_longitude"]') && e.target.closest('form')?.matches('[data-pn-negocio],[data-pn-prod]')) pnOnde(e.target.name.split('_')[0], e.target.closest('form'));
});
document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.matches('[data-pn-negocio]')) {
    e.preventDefault(); const err = f.querySelector('[data-pn-err]'); err.hidden = true; const bt = f.querySelector('[type=submit]'); bt.disabled = true;
    try {
      const negocio = { ...pnLer(f, 'n'), tipo_negocio: PN.tipo };
      if (f.dataset.pnNegocio) { await API.put('/api/parceiro/negocios/' + f.dataset.pnNegocio, { negocio }); PN.editarNeg = null; toast(tr_('Negócio actualizado.')); }
      else { await API.post('/api/parceiro/negocios', { negocio, produto: pnLer(f, 'p'), ...(PN.reclamar ? { reclamar: { tabela: PN.reclamar.tabela, id: PN.reclamar.id } } : {}) }); PN.reclamar = null; PN.pre = null; PN.novo = false; PN.passo = 'tipo'; PN.tipo = null; S.user.papel = S.user.papel === 'cliente' ? 'parceiro' : S.user.papel; toast(tr_('Negócio enviado para aprovação.')); carregarNotifs(); }
      render(); scrollTo(0, 0);
    } catch (er) { err.textContent = er.message; err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); } finally { bt.disabled = false; }
    return;
  }
  if (f.matches('[data-pn-prod]')) {
    e.preventDefault(); const [neg, t, id] = f.dataset.pnProd.split(':'); const err = f.querySelector('[data-pn-err]'); err.hidden = true;
    try { const dados = pnLer(f, 'p'); id ? await API.put(`/api/parceiro/produtos/${t}/${id}`, dados) : await API.post(`/api/parceiro/negocios/${neg}/produtos`, dados); closeModal(); toast(tr_('Guardado.')); render(); }
    catch (er) { err.textContent = er.message; err.hidden = false; }
  }
});
