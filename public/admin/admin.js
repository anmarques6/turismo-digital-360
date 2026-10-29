/* Painel de administração — Angola 365º */
const A = { user: null, esquema: null, rota: 'resumo', cache: {}, filtros: { estado: '', tipo: '', q: '' }, cq: '' };
const el = document.getElementById('adm');
const TIPOS = { experiencia: 'Experiência', alojamento: 'Alojamento', evento: 'Evento', restaurante: 'Restaurante', viatura: 'Viatura', tradutor: 'Tradutor', destino: 'Destino', prato: 'Prato' };
const EST = { pendente: ['Pendente', 'p-orange'], confirmada: ['Confirmada', 'p-green'], concluida: ['Concluída', 'p-blue'], cancelada: ['Cancelada', 'p-red'] };
const dt = s => { const d = new Date(String(s).replace(' ', 'T') + (String(s).length <= 19 ? 'Z' : '')); return isNaN(d) ? s : d.toLocaleString('pt-PT', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }); };
const dd = s => s ? new Date(s + 'T12:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
function toast(msg, erro) { document.querySelector('.toast')?.remove(); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); if (erro) t.style.background = 'var(--red)'; t.innerHTML = ic(erro ? 'x' : 'check') + `<span>${esc(msg)}</span>`; document.body.appendChild(t); setTimeout(() => t.remove(), 4000); }
const fecharDrawer = () => document.querySelector('.drawer')?.remove();

function nav() {
  const r = A.esquema?.recursos || {};
  return [['resumo', 'chart', 'Resumo'], ['reservas', 'ticket', 'Reservas'], ['utilizadores', 'users', 'Utilizadores'], ['sep', 'Catálogo'],
    ...Object.entries(r).map(([k, v]) => ['cat/' + k, v.icone, v.titulo]), ['sep', 'Comunidade'], ['avaliacoes', 'star', 'Avaliações'], ['suporte', 'headset', 'Pedidos de suporte'], ['sep', 'Dados e fontes'], ['fontes', 'globe', 'Fontes e pesquisa diária'], ['qualidade', 'check', 'Qualidade dos dados'], ['enda', 'chat', 'ENDA AI: registos'], ['sep', 'Sistema'], ['auditoria', 'list', 'Auditoria'], ['config', 'lock', 'Entrada com redes sociais']];
}
function shell(html) {
  const itens = nav();
  el.innerHTML = `<div class="shell"><aside class="side">${logo('Painel de administração')}<nav class="nav" aria-label="Administração">${itens.map(n => n[0] === 'sep' ? `<div class="sep">${n[1]}</div>` : `<button data-r="${n[0]}" ${A.rota === n[0] ? 'aria-current="page"' : ''}>${ic(n[1])}${n[2]}</button>`).join('')}</nav>
   <a class="btn" href="/" style="background:rgba(255,255,255,.08);color:#fff;justify-content:flex-start">${ic('globe')} Ver o site</a>
   <div class="wallet-mini"><small>Sessão</small><b style="font-size:15px;color:#fff">${esc(A.user.nome)}</b><small>${esc(A.user.email)}</small><button class="link" data-sair style="color:var(--gold);margin-top:6px;font-size:13px">Terminar sessão</button></div>
   <div class="powered">Uma solução <img src="/img/sigaf.webp" alt="SIGAF"></div></aside>
   <main class="a-main"><div class="a-mtop"><label class="sr" for="mnav">Secção</label><select id="mnav" data-mnav>${itens.filter(n => n[0] !== 'sep').map(n => `<option value="${n[0]}" ${A.rota === n[0] ? 'selected' : ''}>${n[2]}</option>`).join('')}</select><button class="btn btn-ghost sm" data-sair>Sair</button></div>${html}</main></div>`;
}
const head = (t, sub, tools = '') => `<div class="a-head"><div><h1>${t}</h1><p>${sub}</p></div><div class="a-tools">${tools}</div></div>`;
const vazio = t => `<div class="empty">${ic('search')}<p>${t}</p></div>`;

/* ---------- resumo ---------- */
function graficoBarras(serie) {
  const W = 720, H = 220, pl = 52, pb = 26, pt = 10, max = Math.max(1, ...serie.map(d => d.receita));
  const passo = Math.pow(10, Math.floor(Math.log10(max))); const topo = Math.ceil(max / passo) * passo;
  const bw = (W - pl) / serie.length; const y = v => pt + (H - pt - pb) * (1 - v / topo);
  const ticks = [0, topo / 2, topo];
  const fmt = v => v >= 1e6 ? (v / 1e6).toLocaleString('pt-PT', { maximumFractionDigits: 1 }) + ' M' : v >= 1e3 ? Math.round(v / 1e3) + ' mil' : v;
  return `<div class="chart" id="ch"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Receita confirmada por dia nos últimos 30 dias">
   ${ticks.map(t => `<line x1="${pl}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(t)}</text>`).join('')}
   ${serie.map((d, i) => { const h = H - pb - y(d.receita); const x = pl + i * bw + 1; return `<g data-tip="${dd(d.dia)} · ${kz(d.receita)} · ${d.reservas} reserva${d.reservas === 1 ? '' : 's'}" data-x="${(x + bw / 2) / W}" data-y="${y(d.receita) / H}"><rect x="${pl + i * bw}" y="${pt}" width="${bw}" height="${H - pt - pb}" fill="transparent"/>${d.receita ? `<path d="M${x} ${H - pb} V${y(d.receita) + Math.min(4, h)} q0 -4 4 -4 H${x + bw - 6} q4 0 4 4 V${H - pb} Z" fill="var(--red)"/>` : ''}</g>`; }).join('')}
   ${serie.map((d, i) => i % 5 === 0 ? `<text x="${pl + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}</text>` : '').join('')}
  </svg><div class="tip"></div></div>`;
}
async function vResumo() {
  const r = await API.get('/api/admin/resumo');
  const maxT = Math.max(1, ...r.por_tipo.map(t => t.receita));
  shell(head('Resumo', 'Actividade da plataforma nos últimos 30 dias', `<button class="btn btn-ghost sm" data-exp="reservas">${ic('download')} Exportar reservas</button>`) + `
   <div class="kpis">
    <div class="kpi"><small>Receita (30 dias)</small><b class="num">${kz(r.receita_30d)}</b><span>Total desde o início: ${kz(r.receita)}</span></div>
    <div class="kpi"><small>Reservas (30 dias)</small><b class="num">${r.reservas_30d}</b><span>${r.reservas} no total</span></div>
    <div class="kpi"><small>Clientes</small><b class="num">${r.clientes}</b><span>+${r.novos_clientes_30d} nos últimos 30 dias</span></div>
    <div class="kpi"><small>Pagamentos pendentes</small><b class="num" style="color:${r.pendentes ? 'var(--orange)' : 'inherit'}">${r.pendentes}</b><span>${r.pendentes ? '<button class="link" data-r="reservas" data-f="pendente" style="font-size:12.5px">Rever agora →</button>' : 'Tudo em dia'}</span></div>
    <div class="kpi"><small>Saldo em carteiras</small><b class="num">${kz(r.saldo_carteiras)}</b><span>Responsabilidade perante clientes</span></div>
    <div class="kpi"><small>Suporte em aberto</small><b class="num">${r.suporte_abertos}</b><span><button class="link" data-r="suporte" style="font-size:12.5px">Ver pedidos →</button></span></div>
   </div>
   <div class="panels"><section class="panel"><h2>Receita confirmada por dia <small>Kz</small></h2>${graficoBarras(r.serie)}</section>
    <section class="panel"><h2>Receita por tipo</h2>${r.por_tipo.map(t => `<div class="hbar"><span>${TIPOS[t.tipo] || t.tipo}</span><div class="track" title="${kz(t.receita)}"><div class="fill" style="width:${(t.receita / maxT * 100).toFixed(1)}%"></div></div><b class="num">${kz(t.receita)}</b></div>`).join('') || vazio('Sem receita ainda.')}</section></div>
   <div class="panels" style="grid-template-columns:1fr 1fr"><section class="panel"><h2>Mais vendidos</h2>${r.top_itens.map(t => `<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><img src="${t.imagem}" alt="" style="width:46px;height:34px;border-radius:8px"><div style="flex:1;min-width:0"><b style="font-size:13.5px">${esc(t.item_nome)}</b><p class="meta">${TIPOS[t.tipo]} · ${t.reservas} reserva${t.reservas === 1 ? '' : 's'}</p></div><b class="num" style="font-size:13.5px">${kz(t.receita)}</b></div>`).join('') || vazio('Sem dados.')}</section>
    <section class="panel"><h2>Ocupação dos próximos eventos</h2>${r.eventos.map(e => { const p = e.bilhetes_vendidos / e.lotacao * 100; return `<div class="hbar occ"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(e.titulo)}">${e.data.slice(8, 10)}/${e.data.slice(5, 7)}</span><div class="track" title="${esc(e.titulo)}"><div class="fill" style="width:${Math.max(p, .5).toFixed(1)}%"></div></div><span class="num meta">${e.bilhetes_vendidos}/${e.lotacao}</span></div><p class="meta" style="margin:-6px 0 10px">${esc(e.titulo)}</p>`; }).join('') || vazio('Sem eventos agendados.')}</section></div>
   <section class="panel" style="margin-top:14px"><h2>Últimas reservas</h2>${tabelaReservas(r.ultimas, true)}</section>`);
  const ch = document.getElementById('ch'), tip = ch.querySelector('.tip');
  ch.querySelectorAll('g[data-tip]').forEach(g => { g.addEventListener('mouseenter', () => { tip.textContent = g.dataset.tip; tip.style.left = (+g.dataset.x * 100) + '%'; tip.style.top = (+g.dataset.y * 100) + '%'; tip.classList.add('on'); }); g.addEventListener('mouseleave', () => tip.classList.remove('on')); });
}

/* ---------- reservas ---------- */
function tabelaReservas(L, compacta) {
  if (!L.length) return vazio('Nenhuma reserva com estes filtros.');
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Código</th><th>Cliente</th><th>Item</th><th>Data</th><th class="num">Total</th><th>Pagamento</th><th>Estado</th>${compacta ? '' : '<th></th>'}</tr></thead><tbody>${L.map(r => { const [l, c] = EST[r.estado]; return `<tr><td class="num" style="text-align:left;font-weight:700;white-space:nowrap">${r.codigo}</td><td><b>${esc(r.cliente_nome)}</b><br><small class="meta">${esc(r.cliente_email)}</small></td><td>${esc(r.item_nome)}<br><small class="meta">${TIPOS[r.tipo]} · ${r.quantidade} ${r.unidade || ''}${r.quantidade > 1 ? 's' : ''}</small></td><td>${dd(r.data_inicio)}<br><small class="meta">criada ${dt(r.criado_em)}</small></td><td class="num"><b>${r.total ? kz(r.total) : 'Grátis'}</b></td><td>${esc(r.metodo_pagamento)}</td><td><span class="pill ${c}">${l}</span></td>${compacta ? '' : `<td><div class="acts">${r.estado === 'pendente' ? `<button class="btn btn-ghost sm" data-est="${r.id}:confirmada">${ic('check')} Pago</button>` : ''}${r.estado === 'confirmada' ? `<button class="btn btn-ghost sm" data-est="${r.id}:concluida">Concluir</button>` : ''}${['pendente', 'confirmada'].includes(r.estado) ? `<button class="btn btn-ghost sm" style="color:var(--red)" data-est="${r.id}:cancelada">Cancelar</button>` : ''}</div></td>`}</tr>`; }).join('')}</tbody></table></div>`;
}
async function vReservas() {
  const f = A.filtros; const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
  const L = await API.get('/api/admin/reservas?' + qs);
  shell(head('Reservas', `${L.length} reserva${L.length === 1 ? '' : 's'} · soma ${kz(L.filter(r => ['confirmada', 'concluida'].includes(r.estado)).reduce((s, r) => s + r.total, 0))} confirmados`,
    `<input type="search" placeholder="Código, cliente ou item" value="${esc(f.q)}" data-filtro="q" aria-label="Pesquisar"><select data-filtro="estado" aria-label="Estado"><option value="">Todos os estados</option>${Object.entries(EST).map(([k, [l]]) => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${l}</option>`).join('')}</select><select data-filtro="tipo" aria-label="Tipo"><option value="">Todos os tipos</option>${['experiencia', 'alojamento', 'evento', 'restaurante', 'viatura', 'tradutor'].map(k => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${TIPOS[k]}</option>`).join('')}</select><button class="btn btn-ghost sm" data-exp="reservas">${ic('download')} CSV</button>`) + tabelaReservas(L));
}

/* ---------- utilizadores ---------- */
async function vUtilizadores() {
  const L = await API.get('/api/admin/utilizadores'); const q = A.cq.toLowerCase();
  const F = L.filter(u => !q || (u.nome + ' ' + u.email + ' ' + (u.telefone || '')).toLowerCase().includes(q));
  shell(head('Utilizadores', `${L.length} contas · ${L.filter(u => u.papel === 'cliente').length} clientes`, `<input type="search" placeholder="Nome, e-mail ou telefone" value="${esc(A.cq)}" data-cq aria-label="Pesquisar"><button class="btn btn-ghost sm" data-exp="utilizadores">${ic('download')} CSV</button>`) +
   `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nome</th><th>Contacto</th><th>Papel</th><th class="num">Reservas</th><th class="num">Gasto</th><th class="num">Saldo</th><th class="num">Pontos</th><th>Desde</th><th>Estado</th><th></th></tr></thead><tbody>${F.map(u => `<tr><td><b>${esc(u.nome)}</b></td><td>${esc(u.email)}<br><small class="meta">${esc(u.telefone || '')}</small></td><td><select data-papel="${u.id}" aria-label="Papel de ${esc(u.nome)}">${['cliente', 'parceiro', 'admin'].map(p => `<option ${u.papel === p ? 'selected' : ''}>${p}</option>`).join('')}</select></td><td class="num">${u.reservas}</td><td class="num">${kz(u.gasto)}</td><td class="num">${kz(u.saldo)}</td><td class="num">${grp(u.pontos)}</td><td>${dt(u.criado_em).split(',')[0]}</td><td><span class="pill ${u.ativo ? 'p-green' : 'p-red'}">${u.ativo ? 'Activa' : 'Suspensa'}</span></td><td><div class="acts"><button class="btn btn-ghost sm" data-ajuste="${u.id}" data-nome="${esc(u.nome)}">${ic('wallet')} Saldo</button><button class="btn btn-ghost sm" data-ativo="${u.id}:${u.ativo ? 0 : 1}">${u.ativo ? 'Suspender' : 'Reactivar'}</button></div></td></tr>`).join('')}</tbody></table></div>`);
}
function abrirAjuste(id, nome) {
  const d = document.createElement('div'); d.className = 'drawer';
  d.innerHTML = `<form data-ajustef="${id}">${head('Ajustar saldo', esc(nome))}<label class="field">Valor (Kz) — negativo para debitar<input name="valor" type="number" step="500" required placeholder="Ex.: 5000 ou -2000"></label><label class="field">Motivo (o cliente vê esta nota)<input name="motivo" required maxlength="140" placeholder="Ex.: Compensação por atraso"></label><p class="err" hidden></p><div class="sticky-foot"><button type="button" class="btn btn-ghost" data-fechar>Cancelar</button><button class="btn btn-red" type="submit" style="flex:1">Aplicar ajuste</button></div></form>`;
  d.addEventListener('click', e => { if (e.target === d) fecharDrawer(); }); document.body.appendChild(d); d.querySelector('input').focus();
}

/* ---------- catálogo ---------- */
async function vCatalogo(tab) {
  const R = A.esquema.recursos[tab]; const L = await API.get('/api/admin/catalogo/' + tab); A.cache[tab] = L;
  const q = A.cq.toLowerCase(); const F = L.filter(i => !q || JSON.stringify(i).toLowerCase().includes(q));
  const cel = (k, i) => { const c = R.campos[k], v = i[k];
    if (c.t === 'image') return `<img class="th" src="${esc(v)}" alt="">`;
    if (c.t === 'bool') return v ? `<span class="pill p-green">Sim</span>` : `<span class="pill p-red">Não</span>`;
    if (c.t === 'ref') return esc(i.provincia || '—');
    if (c.t === 'list') return esc((v || []).join(', '));
    if (c.t === 'date') return dd(v);
    if (/preco/.test(k)) return v == null ? '—' : kz(v);
    if (k === 'oferta_pct') return v ? v + '%' : '—';
    if (k === 'bilhetes_vendidos') return `${v}/${i.lotacao}`;
    return esc(v ?? '—'); };
  shell(head(R.titulo, `${L.length} registo${L.length === 1 ? '' : 's'} · ${L.filter(i => i.ativo !== 0).length} publicado${L.length === 1 ? '' : 's'}`, `<input type="search" placeholder="Pesquisar" value="${esc(A.cq)}" data-cq aria-label="Pesquisar"><button class="btn btn-ghost sm" data-exp="${tab}">${ic('download')} CSV</button><button class="btn btn-red sm" data-novo="${tab}">${ic('plus')} Novo ${R.singular.toLowerCase()}</button>`) +
   (F.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${R.lista.map(k => `<th>${k === 'imagem' ? '' : esc(R.campos[k].label.replace(/ \(.*\)/, ''))}</th>`).join('')}<th></th></tr></thead><tbody>${F.map(i => `<tr class="click" data-edit="${tab}:${i.id}">${R.lista.map(k => `<td>${cel(k, i)}</td>`).join('')}<td><div class="acts"><button class="btn btn-ghost sm" data-edit="${tab}:${i.id}">${ic('edit')} Editar</button></div></td></tr>`).join('')}</tbody></table></div>` : vazio('Nada encontrado.')));
}
function campoHTML(k, c, v) {
  const id = 'f-' + k, req = c.req ? 'required' : '', lbl = esc(c.label) + (c.req ? ' *' : '');
  const val = v ?? c.def ?? '';
  switch (c.t) {
    case 'textarea': return `<label class="field" for="${id}">${lbl}<textarea id="${id}" name="${k}" rows="${k.includes('long') || k === 'historia' ? 5 : 3}" ${req}>${esc(val)}</textarea></label>`;
    case 'int': case 'num': return `<label class="field" for="${id}">${lbl}<input id="${id}" name="${k}" type="number" ${c.step ? `step="${c.step}"` : 'step="1"'} ${c.min !== undefined ? `min="${c.min}"` : ''} ${c.max !== undefined ? `max="${c.max}"` : ''} value="${esc(val)}" ${req} ${c.ro ? 'readonly' : ''}></label>`;
    case 'bool': return `<label class="chk"><input type="checkbox" name="${k}" ${(v ?? c.def) ? 'checked' : ''}> ${esc(c.label)}</label>`;
    case 'select': return `<label class="field" for="${id}">${lbl}<select id="${id}" name="${k}" ${req}>${c.req ? '' : '<option value="">—</option>'}${c.opts.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    case 'ref': return `<label class="field" for="${id}">${lbl}<select id="${id}" name="${k}"><option value="">—</option>${(A.cache.provincias || []).map(p => `<option value="${p.id}" ${p.id === v ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>`;
    case 'date': return `<label class="field" for="${id}">${lbl}<input id="${id}" name="${k}" type="date" value="${esc(val)}" ${req}></label>`;
    case 'time': return `<label class="field" for="${id}">${lbl}<input id="${id}" name="${k}" type="time" value="${esc(val)}" ${req}></label>`;
    case 'list': return `<label class="field" for="${id}">${lbl}<textarea id="${id}" name="${k}" rows="4" ${req}>${esc((v || []).join('\n'))}</textarea></label>`;
    case 'image': return `<div class="field">${lbl}<div class="imgprev"><img id="prev-${k}" src="${esc(val)}" alt=""><input type="hidden" name="${k}" value="${esc(val)}" ${req}><label class="btn btn-ghost sm" style="cursor:pointer">${ic('upload')} Carregar imagem<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${k}" hidden></label></div><div class="imgpick">${A.esquema.imagens.map(src => `<button type="button" data-pick="${k}" data-src="${src}" aria-pressed="${src === val}" title="${src}"><img src="${src}" alt="" loading="lazy"></button>`).join('')}</div></div>`;
    case 'images': return `<div class="field">${lbl} <small class="meta">toque para seleccionar várias, pela ordem</small><input type="hidden" name="${k}" value="${esc(JSON.stringify(v || []))}"><div class="imgpick" data-multi="${k}">${A.esquema.imagens.map(src => `<button type="button" data-pickm="${k}" data-src="${src}" aria-pressed="${(v || []).includes(src)}" title="${src}"><img src="${src}" alt="" loading="lazy"></button>`).join('')}</div></div>`;
    case 'i18n': {
      const o = v || {}, R = A.esquema.recursos[A.formTab].campos, LN = { en: 'English', fr: 'Français', es: 'Español' };
      return `<details class="field i18n"><summary class="link" style="cursor:pointer">${ic('globe')} ${lbl} <small class="meta">${Object.keys(o).length ? Object.keys(o).map(l => l.toUpperCase()).join(' · ') : 'por preencher'}</small></summary>${Object.entries(LN).map(([l, nome]) => `<fieldset style="border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-top:10px;display:grid;gap:8px"><legend style="font-weight:700;padding:0 6px">${nome}</legend>${c.campos.map(f => { const cf = R[f] || { label: f }, nm = `${k}.${l}.${f}`, val2 = o[l]?.[f]; const big = cf.t === 'textarea' || cf.t === 'list'; const txt = Array.isArray(val2) ? val2.join('\n') : (val2 || ''); return `<label class="field">${esc(cf.label.replace(/ \(.*\)/, ''))}${cf.t === 'list' ? ' <small class="meta">um por linha</small>' : ''}${big ? `<textarea name="${nm}" rows="${cf.t === 'list' ? 3 : 2}">${esc(txt)}</textarea>` : `<input name="${nm}" value="${esc(txt)}" maxlength="300">`}</label>`; }).join('')}</fieldset>`).join('')}</details>`;
    }
    default: return `<label class="field" for="${id}">${lbl}<input id="${id}" name="${k}" value="${esc(val)}" ${req} maxlength="300"></label>`;
  }
}
async function abrirForm(tab, id) {
  const R = A.esquema.recursos[tab];
  if (!A.cache.provincias) A.cache.provincias = await API.get('/api/admin/catalogo/provincias');
  const i = id ? (A.cache[tab] || []).find(x => x.id === +id) : {};
  A.formTab = tab;
  const d = document.createElement('div'); d.className = 'drawer';
  d.innerHTML = `<form data-salvar="${tab}:${id || ''}">${head(id ? 'Editar ' + R.singular.toLowerCase() : 'Novo ' + R.singular.toLowerCase(), id ? `#${id} · ${esc(i[R.campoNome])}` : 'Preencha os campos obrigatórios (*)', `<button type="button" class="circle" style="background:var(--surface-2);color:var(--fg)" data-fechar aria-label="Fechar">${ic('x')}</button>`)}
   ${Object.entries(R.campos).map(([k, c]) => campoHTML(k, c, i[k])).join('')}
   <p class="err" hidden></p>
   <div class="sticky-foot">${id ? `<button type="button" class="btn btn-ghost" style="color:var(--red)" data-apagar="${tab}:${id}">${ic('trash')} Apagar</button>` : ''}<button type="button" class="btn btn-ghost" data-fechar>Cancelar</button><button class="btn btn-red" type="submit" style="flex:1">Guardar</button></div></form>`;
  d.addEventListener('click', e => { if (e.target === d) fecharDrawer(); }); document.body.appendChild(d); d.querySelector('input:not([type=hidden]),select,textarea')?.focus();
}

/* ---------- avaliações e suporte ---------- */
async function vAvaliacoes() {
  const L = await API.get('/api/admin/avaliacoes');
  shell(head('Avaliações', `${L.length} avaliações · ${L.filter(a => !a.aprovada).length} ocultas`) + (L.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Autor</th><th>Item</th><th>Nota</th><th>Comentário</th><th>Data</th><th>Estado</th><th></th></tr></thead><tbody>${L.map(a => `<tr><td><b>${esc(a.autor_nome)}</b><br><small class="meta">${esc(a.autor_cidade || '')}</small></td><td>${TIPOS[a.tipo] || a.tipo} #${a.item_id}</td><td style="color:var(--gold);white-space:nowrap">${'★'.repeat(a.nota)}<span style="color:var(--line)">${'★'.repeat(5 - a.nota)}</span></td><td style="max-width:360px">${esc(a.comentario || '')}</td><td>${dt(a.criado_em)}</td><td><span class="pill ${a.aprovada ? 'p-green' : 'p-orange'}">${a.aprovada ? 'Visível' : 'Oculta'}</span></td><td><div class="acts"><button class="btn btn-ghost sm" data-aval="${a.id}:${a.aprovada ? 0 : 1}">${a.aprovada ? 'Ocultar' : 'Mostrar'}</button><button class="btn btn-ghost sm" style="color:var(--red)" data-aval-del="${a.id}" aria-label="Apagar">${ic('trash')}</button></div></td></tr>`).join('')}</tbody></table></div>` : vazio('Sem avaliações.')));
}
async function vSuporte() {
  const L = await API.get('/api/admin/suporte');
  shell(head('Pedidos de suporte', `${L.filter(p => p.estado !== 'resolvido').length} em aberto`) + (L.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Assunto</th><th>Mensagem</th><th>Data</th><th>Estado</th></tr></thead><tbody>${L.map(p => `<tr><td><b>${esc(p.cliente_nome || '—')}</b><br><small class="meta">${esc(p.cliente_email || '')}</small></td><td><b>${esc(p.assunto)}</b></td><td style="max-width:420px">${esc(p.mensagem)}</td><td>${dt(p.criado_em)}</td><td><select data-sup="${p.id}" aria-label="Estado">${['aberto', 'em curso', 'resolvido'].map(e => `<option ${p.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>` : vazio('Sem pedidos de suporte.')));
}

/* ---------- configuração: entrada com redes sociais ---------- */
const GUIA_OAUTH = {
  google: ['Abra console.cloud.google.com → APIs e serviços → Credenciais.', 'Crie um "ID do cliente OAuth" do tipo Aplicação Web (configure antes o ecrã de consentimento, tipo Externo).', 'Em "URIs de redirecionamento autorizados" cole o endereço abaixo.', 'Copie o ID e o segredo para as variáveis GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel.'],
  facebook: ['Abra developers.facebook.com → As minhas apps → Criar app (tipo Consumidor).', 'Adicione o produto "Login do Facebook" e cole o endereço abaixo em "URIs de redirecionamento OAuth válidos".', 'Em Definições → Básicas copie o ID da app e a chave secreta para FACEBOOK_APP_ID e FACEBOOK_APP_SECRET.', 'Ponha a app em modo "Em directo" para qualquer pessoa poder entrar.'],
  microsoft: ['Abra portal.azure.com → Microsoft Entra ID → Registos de aplicações → Novo registo.', 'Tipos de conta: "Contas em qualquer diretório e contas Microsoft pessoais".', 'URI de redirecionamento (Web): o endereço abaixo.', 'Em Certificados e segredos crie um segredo. Copie o ID da aplicação e o segredo para MICROSOFT_CLIENT_ID e MICROSOFT_CLIENT_SECRET.'],
};
async function vConfig() {
  const c = await API.get('/api/admin/configuracao');
  shell(head('Entrada com redes sociais', 'Os clientes podem criar conta e entrar com Google, Facebook ou Microsoft') + `
   <p class="meta" style="margin-bottom:14px">Cada botão fica activo assim que as variáveis do fornecedor estiverem definidas na Vercel (Settings → Environment Variables) e o site for publicado de novo. Nenhum segredo é mostrado aqui.</p>
   <div class="panels" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))">${c.oauth.map(p => `<section class="panel"><h2 style="display:flex;justify-content:space-between;align-items:center;gap:8px">${esc(p.nome)} <span class="pill ${p.ativo ? 'p-green' : 'p-orange'}">${p.ativo ? 'Activo' : 'Por configurar'}</span></h2>
     ${p.contas ? `<p class="meta">${p.contas} conta${p.contas === 1 ? '' : 's'} ligada${p.contas === 1 ? '' : 's'}</p>` : ''}
     <ol class="meta" style="padding-left:18px;margin:10px 0;display:grid;gap:4px">${GUIA_OAUTH[p.id].map(t => `<li>${esc(t)}</li>`).join('')}</ol>
     <label class="field">Endereço de redirecionamento<div style="display:flex;gap:6px"><input readonly value="${esc(p.redirect)}" style="flex:1;min-width:0"><button type="button" class="btn btn-ghost sm" data-copiar="${esc(p.redirect)}">Copiar</button></div></label>
     <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${p.variaveis.map(v => `<span class="pill ${v.definida ? 'p-green' : 'p-red'}" style="font-family:ui-monospace,monospace">${v.definida ? '✓' : '✗'} ${esc(v.nome)}</span>`).join('')}</div></section>`).join('')}</div>`);
}

/* ---------- fontes, sincronização e pesquisa diária ---------- */
const METODO = { json_rna: 'JSON (Rádio 5)', ics: 'Calendário iCal', ia_pagina: 'Página pública lida por IA', ia_noticias: 'Notícias/rumores (RSS + IA)', manual: 'Manual' };
async function vFontes() {
  const [F, S] = await Promise.all([API.get('/api/admin/catalogo/fontes'), API.get('/api/admin/sincronizacoes')]);
  const auto = F.filter(f => f.metodo !== 'manual');
  shell(head('Fontes e pesquisa diária', `${auto.length} fontes automáticas · sincronização às 06:30 e pesquisa com IA às 07:00 (hora de Angola)`) + `
   <p class="meta" style="margin-bottom:12px">Cada evento recolhido guarda a ligação de origem e o grau de confiança (fonte identificada, notícia ou rumor). A IA só extrai o que está escrito na página; títulos que não aparecem no texto, datas inválidas ou passadas são descartados. O robots.txt de cada site é respeitado.</p>
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fonte</th><th>Método</th><th>Frequência</th><th>Última leitura</th><th>Estado</th><th></th></tr></thead><tbody>${F.map(f => `<tr><td><b>${esc(f.nome)}</b>${f.oficial ? ' <span class="pill p-green">oficial</span>' : ''}<br>${f.url ? `<a class="meta" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.url)}</a>` : ''}${f.notas ? `<br><small class="meta">${esc(f.notas)}</small>` : ''}</td><td>${METODO[f.metodo] || esc(f.metodo)}</td><td>${f.frequencia_h ? f.frequencia_h + ' h' : '—'}</td><td>${f.ultima_sync ? dt(f.ultima_sync) : '—'}</td>
     <td>${f.ultimo_estado ? `<span class="pill ${f.ultimo_estado === 'ok' ? 'p-green' : 'p-red'}">${esc(f.ultimo_estado)}</span>${f.ultimo_erro ? `<br><small class="meta">${esc(f.ultimo_erro)}</small>` : ''}${f.falhas_seguidas ? `<br><small class="meta">${f.falhas_seguidas} falha(s) seguidas</small>` : ''}` : '—'}</td>
     <td>${f.metodo !== 'manual' ? `<button class="btn btn-navy sm" data-sincronizar="${f.id}">Ler agora</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
   <h2 style="margin:22px 0 10px;font-size:18px">Histórico de sincronizações</h2>
   ${S.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Início</th><th>Fonte</th><th>Origem</th><th>Lidos</th><th>Novos</th><th>Alterados</th><th>Duplicados</th><th>Estado</th></tr></thead><tbody>${S.slice(0, 120).map(x => `<tr><td>${dt(x.inicio)}</td><td>${esc(x.fonte_nome || '—')}</td><td>${esc(x.origem || '')}</td><td>${x.lidos}</td><td>${x.novos}</td><td>${x.alterados}</td><td>${x.duplicados}</td><td><span class="pill ${x.estado === 'ok' ? 'p-green' : x.estado === 'erro' ? 'p-red' : 'p-orange'}">${esc(x.estado)}</span>${x.erro ? `<br><small class="meta">${esc(x.erro)}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>` : vazio('Ainda não houve sincronizações.')}`);
}
async function vQualidade() {
  const L = await API.get('/api/admin/qualidade');
  const G = { alta: 'p-red', 'média': 'p-orange', baixa: 'p-blue' };
  shell(head('Qualidade dos dados', `${L.filter(p => p.gravidade === 'alta').length} problemas graves · ${L.length} no total`) + `<p class="meta" style="margin-bottom:12px">Coordenadas são verificadas contra o mapa oficial de municípios (Angola_Level2). Rumores, eventos sem fonte, datas passadas, duplicados e fontes com erro aparecem aqui.</p>` +
    (L.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Gravidade</th><th>Tabela</th><th>Registo</th><th>Problema</th><th></th></tr></thead><tbody>${L.map(p => `<tr><td><span class="pill ${G[p.gravidade]}">${esc(p.gravidade)}</span></td><td>${esc(p.tabela)}</td><td>${esc(p.nome || '')}</td><td>${esc(p.problema)}</td><td>${p.id && A.esquema.recursos[p.tabela] ? `<button class="btn btn-ghost sm" data-editar-q="${p.tabela}:${p.id}">Corrigir</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : vazio('Sem problemas encontrados.')));
}
async function vEnda() {
  const L = await API.get('/api/admin/enda');
  const T = { fora_ambito: ['Fora do âmbito', 'p-orange'], erro: ['Erro da IA', 'p-red'], sem_dados: ['Sem dados', 'p-blue'], resposta: ['Resposta', 'p-green'] };
  shell(head('ENDA AI: registos', 'Pedidos fora do âmbito, erros e perguntas sem dados na plataforma (para melhorar o catálogo)') + (L.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Tipo</th><th>Utilizador</th><th>Pergunta</th><th>Detalhe</th><th></th></tr></thead><tbody>${L.map(r => `<tr${r.revisto ? ' style="opacity:.55"' : ''}><td>${dt(r.criado_em)}</td><td><span class="pill ${T[r.tipo]?.[1] || ''}">${T[r.tipo]?.[0] || esc(r.tipo)}</span></td><td>${esc(r.email || '—')}</td><td>${esc(r.pergunta || '')}</td><td><small class="meta">${esc(r.detalhe || '')}</small></td><td>${r.revisto ? '✓' : `<button class="btn btn-ghost sm" data-enda-revisto="${r.id}">Revisto</button>`}</td></tr>`).join('')}</tbody></table></div>` : vazio('Sem registos.')));
}
async function vAuditoria() {
  const L = await API.get('/api/admin/auditoria');
  shell(head('Auditoria', 'Últimas 300 operações administrativas') + (L.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Quem</th><th>Acção</th><th>Tabela</th><th>Registo</th><th>Detalhe</th></tr></thead><tbody>${L.map(a => `<tr><td>${dt(a.criado_em)}</td><td>${esc(a.email || 'sistema')}</td><td>${esc(a.acao)}</td><td>${esc(a.tabela || '')}</td><td>${a.registo_id ?? ''}</td><td><small class="meta">${esc(a.detalhe || '')}</small></td></tr>`).join('')}</tbody></table></div>` : vazio('Sem operações registadas.')));
}
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.sincronizar) { b.disabled = true; b.textContent = 'A ler…'; try { const r = await API.post(`/api/admin/fontes/${b.dataset.sincronizar}/sincronizar`); toast(r.estado === 'ok' ? `Lida: ${r.novos} novos, ${r.alterados} alterados, ${r.duplicados} duplicados` : 'Falhou: ' + (r.erro || ''), r.estado !== 'ok'); } catch (er) { toast(er.message, 1); } render(); }
  if (b.dataset.endaRevisto) { await API.post(`/api/admin/enda/${b.dataset.endaRevisto}/revisto`).catch(er => toast(er.message, 1)); render(); }
  if (b.dataset.editarQ) { const [t, id] = b.dataset.editarQ.split(':'); location.hash = 'cat/' + t; setTimeout(() => abrirForm(t, +id), 600); }
});

/* ---------- desenho e navegação ---------- */
async function render() {
  if (!A.user) return loginView();
  const h = location.hash.slice(1) || 'resumo'; A.rota = h;
  try {
    if (h === 'resumo') await vResumo();
    else if (h === 'reservas') await vReservas();
    else if (h === 'utilizadores') await vUtilizadores();
    else if (h === 'avaliacoes') await vAvaliacoes();
    else if (h === 'suporte') await vSuporte();
    else if (h === 'config') await vConfig();
    else if (h === 'fontes') await vFontes();
    else if (h === 'qualidade') await vQualidade();
    else if (h === 'enda') await vEnda();
    else if (h === 'auditoria') await vAuditoria();
    else if (h.startsWith('cat/') && A.esquema.recursos[h.slice(4)]) await vCatalogo(h.slice(4));
    else { location.hash = 'resumo'; }
  } catch (e) { if (e.status !== 401) toast(e.message, 1); }
}
function loginView(msg) {
  el.innerHTML = `<div class="a-login"><form data-login>${logo('Painel de administração')}<h1 style="font-size:22px">Entrar na administração</h1><label class="field">E-mail<input name="email" type="email" autocomplete="username" required></label><label class="field">Senha<input name="senha" type="password" autocomplete="current-password" required></label><p class="err" ${msg ? '' : 'hidden'}>${esc(msg || '')}</p><button class="btn btn-red" type="submit">Entrar</button><p class="meta">Conta inicial: admin@turismo360.ao · admin360 (altere-a em produção)</p><a class="link" href="/">← Voltar ao site</a></form></div>`;
  el.querySelector('input').focus();
}
async function exportar(t) {
  try { const blob = await API.get('/api/admin/exportar/' + t); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `turismo360-${t}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Ficheiro CSV descarregado'); }
  catch (e) { toast(e.message, 1); }
}
window.addEventListener('hashchange', () => { A.cq = ''; fecharDrawer(); render(); window.scrollTo(0, 0); });

document.addEventListener('click', async e => {
  const t = e.target.closest('button,tr.click,a'); if (!t) return; const d = t.dataset;
  if (d.r) { if (d.f) A.filtros = { estado: d.f, tipo: '', q: '' }; location.hash = d.r; if (location.hash.slice(1) === d.r) render(); return; }
  if (d.sair !== undefined) { Inatividade.desligar(); try { await API.post('/api/auth/sair'); } catch (er) {} API.setToken(null); A.user = null; render(); return; }
  if (d.exp) return exportar(d.exp);
  if (d.copiar) { navigator.clipboard?.writeText(d.copiar).then(() => toast('Copiado'), () => toast(d.copiar)); return; }
  if (d.fechar !== undefined) return fecharDrawer();
  if (d.novo) return abrirForm(d.novo);
  if (d.edit) { e.stopPropagation(); const [tab, id] = d.edit.split(':'); return abrirForm(tab, id); }
  if (d.pick) { const f = t.closest('form'); f.querySelector(`input[name="${d.pick}"]`).value = d.src; f.querySelector('#prev-' + d.pick).src = d.src; t.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === t)); return; }
  if (d.pickm) { const f = t.closest('form'); const inp = f.querySelector(`input[name="${d.pickm}"]`); let arr = JSON.parse(inp.value || '[]'); arr = arr.includes(d.src) ? arr.filter(x => x !== d.src) : [...arr, d.src]; inp.value = JSON.stringify(arr); t.setAttribute('aria-pressed', arr.includes(d.src)); return; }
  if (d.apagar) {
    if (t.dataset.confirmar !== '1') { t.dataset.confirmar = '1'; t.innerHTML = `${ic('trash')} Confirmar apagar`; t.style.background = 'var(--red)'; t.style.color = '#fff'; return; }
    const [tab, id] = d.apagar.split(':');
    try { const r = await API.del(`/api/admin/catalogo/${tab}/${id}`); fecharDrawer(); toast(r.mensagem || 'Registo apagado'); render(); } catch (er) { toast(er.message, 1); }
    return;
  }
  if (d.est) {
    const [id, est] = d.est.split(':');
    if (est === 'cancelada' && t.dataset.confirmar !== '1') { t.dataset.confirmar = '1'; t.textContent = 'Confirmar'; t.style.background = 'var(--red)'; t.style.color = '#fff'; return; }
    try { const r = await API.patch('/api/admin/reservas/' + id, { estado: est }); toast(est === 'cancelada' ? (r.reembolso ? `Cancelada · ${kz(r.reembolso)} devolvidos ao cliente` : 'Reserva cancelada') : est === 'confirmada' ? 'Pagamento confirmado' : 'Reserva concluída'); render(); } catch (er) { toast(er.message, 1); }
    return;
  }
  if (d.ajuste) return abrirAjuste(d.ajuste, d.nome);
  if (d.ativo) { const [id, v] = d.ativo.split(':'); try { await API.patch('/api/admin/utilizadores/' + id, { ativo: +v }); toast(+v ? 'Conta reactivada' : 'Conta suspensa'); render(); } catch (er) { toast(er.message, 1); } return; }
  if (d.aval) { const [id, v] = d.aval.split(':'); try { await API.patch('/api/admin/avaliacoes/' + id, { aprovada: +v }); render(); } catch (er) { toast(er.message, 1); } return; }
  if (d.avalDel) { if (t.dataset.confirmar !== '1') { t.dataset.confirmar = '1'; t.style.background = 'var(--red)'; t.style.color = '#fff'; t.title = 'Toque de novo para apagar'; return; } try { await API.del('/api/admin/avaliacoes/' + d.avalDel); toast('Avaliação apagada'); render(); } catch (er) { toast(er.message, 1); } return; }
});
document.addEventListener('change', async e => {
  const t = e.target; const d = t.dataset;
  if (d.mnav !== undefined) { location.hash = t.value; return; }
  if (d.filtro) { A.filtros[d.filtro] = t.value; return render(); }
  if (d.papel) { try { await API.patch('/api/admin/utilizadores/' + d.papel, { papel: t.value }); toast('Papel actualizado'); } catch (er) { toast(er.message, 1); render(); } return; }
  if (d.sup) { try { await API.patch('/api/admin/suporte/' + d.sup, { estado: t.value }); toast('Pedido actualizado'); } catch (er) { toast(er.message, 1); } return; }
  if (d.upload) {
    const f = t.files[0]; if (!f) return; if (f.size > 3 * 1024 * 1024) return toast('A imagem não pode ter mais de 3 MB.', 1);
    const dados = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
    try { const r = await API.post('/api/admin/upload', { dados }); const form = t.closest('form'); form.querySelector(`input[name="${d.upload}"]`).value = r.caminho; form.querySelector('#prev-' + d.upload).src = r.caminho; A.esquema.imagens.push(r.caminho); toast('Imagem carregada'); } catch (er) { toast(er.message, 1); }
  }
});
let tq;
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.cq !== undefined || t.dataset.filtro === 'q') { clearTimeout(tq); tq = setTimeout(async () => { if (t.dataset.cq !== undefined) A.cq = t.value; else A.filtros.q = t.value; const pos = t.selectionStart; await render(); const n = document.querySelector(t.dataset.cq !== undefined ? '[data-cq]' : '[data-filtro="q"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharDrawer(); });
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target; const er = f.querySelector('.err');
  const falha = m => { if (er) { er.hidden = false; er.textContent = m; er.scrollIntoView({ block: 'nearest' }); } };
  if (f.dataset.login !== undefined) {
    const fd = new FormData(f);
    try { const r = await API.post('/api/auth/entrar', { email: fd.get('email'), senha: fd.get('senha') }); if (r.utilizador.papel !== 'admin') return falha('Esta conta não tem acesso de administrador.'); API.setToken(r.token); await arrancar(); } catch (x) { falha(x.message); }
    return;
  }
  if (f.dataset.salvar) {
    const [tab, id] = f.dataset.salvar.split(':'); const R = A.esquema.recursos[tab]; const fd = new FormData(f); const corpo = {};
    for (const [k, c] of Object.entries(R.campos)) {
      if (c.ro && id) continue;
      if (c.t === 'bool') corpo[k] = f.querySelector(`[name="${k}"]`).checked ? 1 : 0;
      else if (c.t === 'images') corpo[k] = JSON.parse(fd.get(k) || '[]');
      else if (c.t === 'i18n') { const o = {}; for (const l of ['en', 'fr', 'es']) for (const fc of c.campos) { const x = (fd.get(`${k}.${l}.${fc}`) || '').trim(); if (!x) continue; (o[l] ||= {})[fc] = R.campos[fc]?.t === 'list' ? x.split('\n').map(y => y.trim()).filter(Boolean) : x; } corpo[k] = o; }
      else corpo[k] = fd.get(k) ?? '';
    }
    try { id ? await API.put(`/api/admin/catalogo/${tab}/${id}`, corpo) : await API.post(`/api/admin/catalogo/${tab}`, corpo); fecharDrawer(); toast(id ? 'Alterações guardadas' : R.singular + ' criado(a)'); if (tab === 'provincias') delete A.cache.provincias; render(); } catch (x) { falha(x.message); }
    return;
  }
  if (f.dataset.ajustef) {
    const fd = new FormData(f);
    try { const r = await API.post(`/api/admin/utilizadores/${f.dataset.ajustef}/ajuste`, { valor: +fd.get('valor'), motivo: fd.get('motivo') }); fecharDrawer(); toast('Novo saldo: ' + kz(r.saldo)); render(); } catch (x) { falha(x.message); }
  }
});

API.onExpira = () => { Inatividade.desligar(); A.user = null; API.setToken(null); loginView('A sessão expirou. Entre novamente.'); };
async function arrancar() {
  if (!API.token) return loginView();
  try {
    const { utilizador } = await API.get('/api/auth/eu');
    if (utilizador.papel !== 'admin') { API.setToken(null); return loginView('Esta conta não tem acesso de administrador.'); }
    A.user = utilizador; A.esquema = await API.get('/api/admin/esquema'); render();
    const cfg = await API.get('/api/auth/provedores').catch(() => ({}));
    Inatividade.ligar(() => { API.post('/api/auth/sair').catch(() => {}); fecharDrawer(); API.setToken(null); A.user = null; loginView('A sessão terminou por inactividade. Entre novamente.'); }, cfg.inatividade_s);
  } catch (e) { API.setToken(null); loginView(); }
}
try { const th = JSON.parse(localStorage.getItem('td360_theme')); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
arrancar();
