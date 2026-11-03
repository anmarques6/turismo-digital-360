// Angola 365º — Parceiros (operadores turísticos)
// Três tipos de utilizador: administrador, parceiro (operador) e cliente (turista).
// O parceiro regista o seu negócio (dados, localização e preços). O tipo de negócio decide sozinho em que catálogo
// entram os produtos, que campos o formulário pede e que valores ficam fixos. Tudo fica «em revisão» até a
// administração aprovar o negócio; a partir daí os produtos aparecem no site e o parceiro recebe as reservas.
const { get, all, run, tx } = require('./db');
const { erro } = require('./http');
const { RECURSOS, TIPOS_NEGOCIO, CAMPOS_PARCEIRO, OBRIG_PARCEIRO } = require('./recursos');
const { localizar } = require('./geo');

const MAX_NEGOCIOS = 10, MAX_PRODUTOS = 200, MAX_IMAGENS = 150;
const ESTADOS = { em_revisao: 'Em revisão', aprovado: 'Aprovado', rejeitado: 'Rejeitado', suspenso: 'Suspenso' };
const TABELAS = Object.keys(CAMPOS_PARCEIRO); // lista fechada: só estas tabelas podem ser usadas nas consultas
const TIPO_DA_TABELA = Object.fromEntries(TABELAS.map(t => [t, RECURSOS[t].tipo]));
const temGeo = t => 'latitude' in RECURSOS[t].campos;
let ctx = null;

const camposDe = t => Object.fromEntries(CAMPOS_PARCEIRO[t].map(k => { const c = { ...RECURSOS[t].campos[k] }; if ((OBRIG_PARCEIRO[t] || []).includes(k)) c.req = 1; return [k, c]; }));

// Valores que vêm do negócio e do tipo de negócio (o parceiro não os escolhe produto a produto)
function fixos(n, t, item = {}) {
  const def = TIPOS_NEGOCIO[n.tipo_negocio] || {};
  const f = { ...(def.tabela === t ? def.fixo || {} : {}) };
  const local = [n.municipio, n.provincia].filter(Boolean).join(', ');
  const usaGeoDoNegocio = temGeo(t) && (item.latitude == null || item.latitude === '' || item.longitude == null || item.longitude === '');
  if (usaGeoDoNegocio && n.latitude != null) Object.assign(f, { latitude: n.latitude, longitude: n.longitude, endereco: n.endereco || null, bairro: n.bairro || null });
  if (temGeo(t)) Object.assign(f, { coord_estado: 'aproximada', coord_fonte: 'Indicada pelo parceiro' });
  if (t === 'alojamentos' || t === 'restaurantes') Object.assign(f, { local: local || n.nome, site: n.site || null, telefone: n.telefone || null, fonte: n.site || null });
  if (t === 'experiencias' && !str(item.local)) f.local = local || n.nome;
  if (t === 'eventos') { Object.assign(f, { organizador: n.nome, confianca: 'fonte identificada', fonte_tipo: 'manual', fonte_nome: n.nome, fonte_url: n.site || null, estado: 'agendado' }); if (!str(item.local)) f.local = local || n.nome; }
  if (t === 'viaturas') { f.empresa = n.nome; if (!str(item.local_levantamento)) f.local_levantamento = n.endereco || local || null; }
  if (t === 'tradutores') { f.telefone = n.telefone || null; if (!str(item.cidade)) f.cidade = n.municipio || 'Luanda'; }
  if (!item.imagem && n.imagem) f.imagem = n.imagem;
  return f;
}
const str = (v, max = 300) => (v == null ? '' : String(v)).trim().slice(0, max);
const nomeCampo = t => RECURSOS[t].campoNome;

// Valida os dados do negócio. A localização é obrigatória e tem de cair no mapa oficial de municípios.
async function validarNegocio(b, atual = null) {
  const o = {};
  const tipo = atual ? atual.tipo_negocio : str(b.tipo_negocio, 40);
  if (!TIPOS_NEGOCIO[tipo]) erro(400, 'Escolha o tipo de negócio.');
  o.tipo_negocio = tipo;
  o.nome = str(b.nome, 120); if (o.nome.length < 2) erro(400, 'Indique o nome do negócio.');
  o.descricao = str(b.descricao, 2000) || null;
  o.telefone = str(b.telefone, 30); if (!/^[+\d][\d\s-]{6,}$/.test(o.telefone)) erro(400, 'Indique um telefone de contacto válido.');
  o.email = str(b.email, 160).toLowerCase() || null; if (o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) erro(400, 'E-mail do negócio inválido.');
  o.site = str(b.site, 300) || null; if (o.site && !/^https?:\/\/[^\s]+\.[^\s]+/.test(o.site)) erro(400, 'O site tem de começar por https://');
  o.nif = str(b.nif, 30) || null;
  o.imagem = str(b.imagem, 300) || null; if (o.imagem && !/^(\/img\/|\/api\/imagens\/\d+$)/.test(o.imagem)) erro(400, 'Fotografia inválida: carregue-a de novo.');
  o.endereco = str(b.endereco, 300); if (o.endereco.length < 3) erro(400, 'Indique o endereço (rua, bairro ou ponto de referência).');
  o.bairro = str(b.bairro, 120) || null;
  const lat = Number(b.latitude), lon = Number(b.longitude);
  if (b.latitude === '' || b.latitude == null || !Number.isFinite(lat) || !Number.isFinite(lon)) erro(400, 'Indique a localização no mapa: use «Usar a minha localização» ou pesquise o endereço.');
  const l = localizar(lat, lon); if (!l) erro(400, 'A localização fica fora de Angola. Confirme a posição do negócio.');
  o.latitude = lat; o.longitude = lon; o.municipio = l.municipio;
  o.provincia_id = (await get('SELECT id FROM provincias WHERE nome = ?', l.provincia))?.id || null;
  return o;
}
const negocioCompleto = id => get('SELECT n.*, p.nome AS provincia FROM negocios n LEFT JOIN provincias p ON p.id = n.provincia_id WHERE n.id = ?', id);
async function meuNegocio(req, id) {
  const n = await negocioCompleto(Number(id));
  if (!n || n.utilizador_id !== req.user.id) erro(404, 'Negócio não encontrado.');
  return n;
}
const tabelaParceiro = t => { if (!TABELAS.includes(t)) erro(404, 'Catálogo desconhecido.'); return t; };
async function meuProduto(req, t, id) {
  tabelaParceiro(t);
  const p = await get(`SELECT * FROM ${t} WHERE id = ? AND negocio_id IN (SELECT id FROM negocios WHERE utilizador_id = ?)`, Number(id), req.user.id);
  if (!p) erro(404, 'Produto não encontrado.');
  return p;
}

// Grava um produto do parceiro no catálogo do seu tipo de negócio
async function gravarProduto(d, n, t, b, id = null, { simular = false } = {}) {
  const entrada = {}; for (const k of CAMPOS_PARCEIRO[t]) if (b[k] !== undefined) entrada[k] = b[k];
  const fx = fixos(n, t, entrada);
  const dados = { ...entrada, ...fx };
  // o tipo de alojamento é o do negócio (um hotel publica hotéis); quem tem apartamentos e villas pode variar
  if (t === 'alojamentos' && TIPOS_NEGOCIO[n.tipo_negocio].fixo && !['apartamentos', 'villa'].includes(n.tipo_negocio)) dados.tipo = TIPOS_NEGOCIO[n.tipo_negocio].fixo.tipo;
  else if (t === 'alojamentos' && !entrada.tipo) dados.tipo = TIPOS_NEGOCIO[n.tipo_negocio].fixo?.tipo;
  if (!dados.imagem) erro(400, 'Carregue pelo menos uma fotografia.');
  const so = [...new Set([...CAMPOS_PARCEIRO[t], ...Object.keys(fx), 'tipo'])].filter(k => k in RECURSOS[t].campos);
  const v = await ctx.validar(t, dados, !id || simular, so, OBRIG_PARCEIRO[t] || []);
  if (simular) return v;
  if (t === 'eventos' && v.data && v.data < hojeAO()) erro(400, 'A data do evento já passou.');
  // aceita reservas online quando tem preço; sem preço fica «sob consulta»
  if ('parceiro' in RECURSOS[t].campos) v.parceiro = (t === 'alojamentos' ? v.preco_noite : t === 'restaurantes' ? v.preco_medio : v.preco_dia) != null ? 1 : 0;
  if (!id) { v.ativo = n.estado === 'aprovado' ? 1 : 0; v.negocio_id = n.id; }
  const ks = Object.keys(v);
  if (id) { if (ks.length) await d.run(`UPDATE ${t} SET ${ks.map(k => k + ' = ?').join(', ')} WHERE id = ?`, ...ks.map(k => v[k]), id); return d.get(`SELECT * FROM ${t} WHERE id = ?`, id); }
  return d.get(`INSERT INTO ${t} (${ks.join(',')}) VALUES (${ks.map(() => '?').join(',')}) RETURNING *`, ...ks.map(k => v[k]));
}
// «Este negócio é meu»: fichas que podem ser reclamadas e o tipo de negócio que lhes corresponde
const RECLAMAVEIS = ['alojamentos', 'restaurantes'];
const tipoParaFicha = (t, it) => t === 'restaurantes' ? 'restaurante' : Object.keys(TIPOS_NEGOCIO).find(k => TIPOS_NEGOCIO[k].fixo?.tipo === it.tipo) || 'hotel';
async function fichaReclamavel(t, id) {
  if (!RECLAMAVEIS.includes(t)) erro(400, 'Só é possível reclamar alojamentos e restaurantes.');
  const it = await get(`SELECT * FROM ${t} WHERE id = ?`, Number(id));
  if (!it || !it.ativo) erro(404, 'Ficha não encontrada.');
  if (it.negocio_id) erro(409, 'Esta ficha já pertence a um parceiro. Se é o dono, contacte o suporte.');
  return it;
}
const hojeAO = () => new Date(Date.now() + 36e5).toISOString().slice(0, 10);

async function produtosDe(negocioIds) {
  if (!negocioIds.length) return [];
  const out = [];
  for (const t of TABELAS) {
    const L = await all(`SELECT * FROM ${t} WHERE negocio_id IN (${negocioIds.map(() => '?').join(',')}) ORDER BY id DESC`, ...negocioIds);
    for (const l of L) out.push({ ...ctx.serializar(t, l), _tabela: t, _tipo: TIPO_DA_TABELA[t], _nome: l[nomeCampo(t)] });
  }
  return out;
}
// Condição SQL «esta reserva é de um produto destes negócios»
function condReservas(alias = 'r') {
  return '(' + TABELAS.map(t => `(${alias}.tipo = '${TIPO_DA_TABELA[t]}' AND ${alias}.item_id IN (SELECT id FROM ${t} WHERE negocio_id IN (SELECT id FROM negocios WHERE utilizador_id = ?)))`).join(' OR ') + ')';
}
const admins = () => all(`SELECT id FROM utilizadores WHERE papel = 'admin' AND ativo = 1`);

// Avisa o parceiro quando um cliente reserva um dos seus produtos
async function avisarParceiro(reserva) {
  if (!ctx || !reserva) return;
  const t = Object.keys(TIPO_DA_TABELA).find(k => TIPO_DA_TABELA[k] === reserva.tipo); if (!t) return;
  const dono = await get(`SELECT n.utilizador_id FROM ${t} x JOIN negocios n ON n.id = x.negocio_id WHERE x.id = ?`, reserva.item_id);
  if (dono) await ctx.notificar({ run }, dono.utilizador_id, 'Nova reserva recebida', `${reserva.item_nome} · ${reserva.quantidade} ${reserva.unidade}${reserva.quantidade > 1 ? 's' : ''}${reserva.data_inicio ? ' · ' + reserva.data_inicio : ''} · Código ${reserva.codigo}`, 'ticket', 'negocio');
}

function registar(c) {
  ctx = c;
  const { api, auth, admin, corpo, auditar } = c;
  const parceiro = async req => { await auth(req); if (!['parceiro', 'admin'].includes(req.user.papel)) erro(403, 'Registe primeiro o seu negócio.'); };

  // O que o formulário do parceiro precisa: tipos de negócio e campos de cada catálogo
  api.get('/api/parceiro/esquema', async () => ({ tipos: TIPOS_NEGOCIO, campos: Object.fromEntries(TABELAS.map(t => [t, camposDe(t)])), recursos: Object.fromEntries(TABELAS.map(t => [t, { singular: RECURSOS[t].singular, titulo: RECURSOS[t].titulo, campoNome: nomeCampo(t) }])), estados: ESTADOS }));

  api.get('/api/parceiro/painel', async req => {
    await auth(req);
    const negocios = await all('SELECT n.*, p.nome AS provincia FROM negocios n LEFT JOIN provincias p ON p.id = n.provincia_id WHERE n.utilizador_id = ? ORDER BY n.id', req.user.id);
    const produtos = await produtosDe(negocios.map(n => n.id));
    for (const n of negocios) if (n.reclama_id && RECLAMAVEIS.includes(n.reclama_tabela)) n.reclama_nome = (await get(`SELECT nome FROM ${n.reclama_tabela} WHERE id = ?`, n.reclama_id))?.nome;
    const reservas = negocios.length ? await all(`SELECT r.id, r.codigo, r.tipo, r.item_id, r.item_nome, r.imagem, r.data_inicio, r.data_fim, r.quantidade, r.unidade, r.total, r.estado, r.metodo_pagamento, r.criado_em, u.nome AS cliente_nome, u.telefone AS cliente_telefone, u.email AS cliente_email
      FROM reservas r JOIN utilizadores u ON u.id = r.utilizador_id WHERE ${condReservas()} ORDER BY r.criado_em DESC, r.id DESC LIMIT 300`, ...TABELAS.map(() => req.user.id)) : [];
    const ativas = reservas.filter(r => ['confirmada', 'concluida'].includes(r.estado));
    return { negocios, produtos, reservas, resumo: { produtos: produtos.length, publicados: produtos.filter(p => p.ativo).length, reservas: reservas.length, receita: ativas.reduce((s, r) => s + r.total, 0), pendentes: reservas.filter(r => r.estado === 'pendente').length } };
  });

  // Registar o negócio: a conta passa a «parceiro» e o produto principal é criado no catálogo certo
  api.post('/api/parceiro/negocios', corpo, async req => {
    await auth(req);
    if ((await get('SELECT COUNT(*)::int AS n FROM negocios WHERE utilizador_id = ?', req.user.id)).n >= MAX_NEGOCIOS) erro(400, `Pode registar até ${MAX_NEGOCIOS} negócios por conta.`);
    const rq = req.dados.reclamar;
    let ficha = null;
    if (rq) { ficha = await fichaReclamavel(str(rq.tabela, 20), rq.id); req.dados.negocio = { ...(req.dados.negocio || {}), tipo_negocio: tipoParaFicha(rq.tabela, ficha) }; if (await get(`SELECT 1 AS x FROM negocios WHERE utilizador_id = ? AND reclama_tabela = ? AND reclama_id = ? AND estado = 'em_revisao'`, req.user.id, rq.tabela, ficha.id)) erro(409, 'Já enviou um pedido para esta ficha. Aguarde a revisão.'); }
    const o = await validarNegocio(req.dados.negocio || {});
    const def = TIPOS_NEGOCIO[o.tipo_negocio];
    if (ficha) {
      // valida já os preços e detalhes propostos; só são aplicados à ficha quando a administração aprovar
      const prov = { [nomeCampo(rq.tabela)]: o.nome, descricao: o.descricao || ficha.descricao, imagem: o.imagem || ficha.imagem, ...(req.dados.produto || {}) };
      await gravarProduto(null, { ...o, provincia: null, estado: 'em_revisao' }, rq.tabela, prov, null, { simular: true });
      Object.assign(o, { reclama_tabela: rq.tabela, reclama_id: ficha.id, produto_proposto: JSON.stringify(prov) });
    }
    o.utilizador_id = req.user.id;
    const r = await tx(async d => {
      const ks = Object.keys(o);
      const n0 = await d.get(`INSERT INTO negocios (${ks.join(',')}) VALUES (${ks.map(() => '?').join(',')}) RETURNING id`, ...ks.map(k => o[k]));
      const n = await d.get('SELECT n.*, p.nome AS provincia FROM negocios n LEFT JOIN provincias p ON p.id = n.provincia_id WHERE n.id = ?', n0.id);
      let produto = null;
      if (def.unico && !ficha) produto = await gravarProduto(d, n, def.tabela, { [nomeCampo(def.tabela)]: o.nome, descricao: o.descricao, ...(req.dados.produto || {}) });
      if (req.user.papel === 'cliente') await d.run(`UPDATE utilizadores SET papel = 'parceiro' WHERE id = ?`, req.user.id);
      await ctx.notificar(d, req.user.id, 'Negócio recebido', `«${o.nome}» está em revisão. Avisamos assim que for aprovado e publicado.`, 'clock', 'negocio');
      for (const a of await admins()) await ctx.notificar(d, a.id, ficha ? 'Pedido de propriedade de ficha' : 'Novo parceiro para aprovar', `${o.nome} · ${def.nome} · ${o.municipio}${ficha ? ' · reclama «' + ficha.nome + '»' : ''}`, 'badge', null);
      return { negocio: n, produto };
    });
    await auditar(req, 'registar_negocio', 'negocios', r.negocio.id, o.nome);
    return r;
  });

  api.put('/api/parceiro/negocios/:id', corpo, async req => {
    await parceiro(req); const atual = await meuNegocio(req, req.params.id);
    if (atual.estado === 'suspenso') erro(403, 'Este negócio está suspenso. Contacte o suporte.');
    const o = await validarNegocio(req.dados.negocio || req.dados, atual);
    if (atual.estado === 'rejeitado') o.estado = 'em_revisao'; // corrigido: volta à revisão
    o.atualizado_em = ctx.agoraSQL();
    await tx(async d => {
      const ks = Object.keys(o);
      await d.run(`UPDATE negocios SET ${ks.map(k => k + ' = ?').join(', ')} WHERE id = ?`, ...ks.map(k => o[k]), atual.id);
      // os produtos herdam os novos dados do negócio (contactos, empresa/organizador e, no produto principal, a localização)
      const n = await d.get('SELECT n.*, p.nome AS provincia FROM negocios n LEFT JOIN provincias p ON p.id = n.provincia_id WHERE n.id = ?', atual.id);
      const def = TIPOS_NEGOCIO[n.tipo_negocio];
      for (const t of TABELAS) for (const [i, p] of (await d.all(`SELECT id, imagem FROM ${t} WHERE negocio_id = ? ORDER BY id`, n.id)).entries()) {
        const principal = def.unico && t === def.tabela && i === 0; // o produto principal é o próprio negócio
        const f = fixos(n, t, principal ? { imagem: p.imagem } : { latitude: 0, longitude: 0, local: 'x', local_levantamento: 'x', cidade: 'x', imagem: p.imagem });
        delete f.tipo; if (!principal) for (const k of ['coord_estado', 'coord_fonte']) delete f[k];
        if (principal) f[nomeCampo(t)] = n.nome;
        const ks2 = Object.keys(f).filter(k => k in RECURSOS[t].campos);
        if (ks2.length) await d.run(`UPDATE ${t} SET ${ks2.map(k => k + ' = ?').join(', ')} WHERE id = ?`, ...ks2.map(k => f[k]), p.id);
      }
    });
    return negocioCompleto(atual.id);
  });

  api.post('/api/parceiro/negocios/:id/produtos', corpo, async req => {
    await parceiro(req); const n = await meuNegocio(req, req.params.id);
    if (n.estado === 'suspenso') erro(403, 'Este negócio está suspenso. Contacte o suporte.');
    const t = TIPOS_NEGOCIO[n.tipo_negocio].tabela;
    if ((await get(`SELECT COUNT(*)::int AS n FROM ${t} WHERE negocio_id = ?`, n.id)).n >= MAX_PRODUTOS) erro(400, `Limite de ${MAX_PRODUTOS} produtos por negócio.`);
    const p = await tx(d => gravarProduto(d, n, t, req.dados || {}));
    await auditar(req, 'parceiro_criar', t, p.id, p[nomeCampo(t)]);
    return ctx.serializar(t, p);
  });
  api.put('/api/parceiro/produtos/:tabela/:id', corpo, async req => {
    await parceiro(req); const t = tabelaParceiro(req.params.tabela); const p = await meuProduto(req, t, req.params.id);
    const n = await negocioCompleto(p.negocio_id); if (n.estado === 'suspenso') erro(403, 'Este negócio está suspenso. Contacte o suporte.');
    const novo = await tx(d => gravarProduto(d, n, t, req.dados || {}, p.id));
    await auditar(req, 'parceiro_editar', t, p.id, novo[nomeCampo(t)]);
    return ctx.serializar(t, novo);
  });
  // Mostrar / esconder um produto (só depois de o negócio estar aprovado)
  api.patch('/api/parceiro/produtos/:tabela/:id', corpo, async req => {
    await parceiro(req); const t = tabelaParceiro(req.params.tabela); const p = await meuProduto(req, t, req.params.id);
    const n = await negocioCompleto(p.negocio_id); if (n.estado !== 'aprovado') erro(409, 'Os produtos só podem ser publicados depois de a administração aprovar o negócio.');
    await run(`UPDATE ${t} SET ativo = ? WHERE id = ?`, req.dados.ativo ? 1 : 0, p.id);
    return { ok: true, ativo: req.dados.ativo ? 1 : 0 };
  });
  api.delete('/api/parceiro/produtos/:tabela/:id', async req => {
    await parceiro(req); const t = tabelaParceiro(req.params.tabela); const p = await meuProduto(req, t, req.params.id); const tipo = TIPO_DA_TABELA[t];
    if (await get('SELECT 1 AS x FROM reservas WHERE tipo = ? AND item_id = ? LIMIT 1', tipo, p.id)) { await run(`UPDATE ${t} SET ativo = 0 WHERE id = ?`, p.id); return { arquivado: true, mensagem: 'Este produto tem reservas, por isso foi escondido em vez de apagado.' }; }
    await tx(async d => { await d.run(`DELETE FROM ${t} WHERE id = ?`, p.id); await d.run('DELETE FROM favoritos WHERE tipo = ? AND item_id = ?', tipo, p.id); await d.run('DELETE FROM avaliacoes WHERE tipo = ? AND item_id = ?', tipo, p.id); });
    await auditar(req, 'parceiro_apagar', t, p.id);
    return { apagado: true };
  });

  // Fotografias do parceiro (guardadas na base de dados, com limite por conta)
  api.post('/api/parceiro/upload', async req => {
    await auth(req);
    if ((await get('SELECT COUNT(*)::int AS n FROM imagens WHERE utilizador_id = ?', req.user.id)).n >= MAX_IMAGENS) erro(400, `Limite de ${MAX_IMAGENS} fotografias por conta. Apague produtos antigos ou contacte o suporte.`);
    return ctx.guardarImagem(req, req.user.id);
  });

  // O parceiro marca como concluída uma reserva já paga (o pagamento é sempre confirmado pela plataforma)
  api.patch('/api/parceiro/reservas/:id', corpo, async req => {
    await parceiro(req);
    const r = await get(`SELECT * FROM reservas r WHERE r.id = ? AND ${condReservas()}`, Number(req.params.id), ...TABELAS.map(() => req.user.id));
    if (!r) erro(404, 'Reserva não encontrada.');
    if (req.dados.estado !== 'concluida' || r.estado !== 'confirmada') erro(400, 'Só é possível marcar como concluída uma reserva confirmada.');
    await run(`UPDATE reservas SET estado = 'concluida', atualizado_em = ? WHERE id = ?`, ctx.agoraSQL(), r.id);
    return { ok: true };
  });

  // ---------- administração: aprovar, rejeitar ou suspender parceiros ----------
  api.get('/api/admin/negocios', async req => {
    await admin(req);
    const L = await all(`SELECT n.*, p.nome AS provincia, u.nome AS dono_nome, u.email AS dono_email, u.telefone AS dono_telefone FROM negocios n JOIN utilizadores u ON u.id = n.utilizador_id LEFT JOIN provincias p ON p.id = n.provincia_id ORDER BY (n.estado = 'em_revisao') DESC, n.criado_em DESC`);
    const P = await produtosDe(L.map(n => n.id));
    for (const n of L) if (n.reclama_id && RECLAMAVEIS.includes(n.reclama_tabela)) n.reclama = await get(`SELECT id, nome, local, endereco, telefone, site, fonte, osm_id, imagem, latitude, longitude FROM ${n.reclama_tabela} WHERE id = ?`, n.reclama_id);
    return L.map(n => ({ ...n, tipo_nome: TIPOS_NEGOCIO[n.tipo_negocio]?.nome || n.tipo_negocio, produtos: P.filter(p => p.negocio_id === n.id).map(p => ({ id: p.id, tabela: p._tabela, nome: p._nome, ativo: p.ativo, imagem: p.imagem })) }));
  });
  api.patch('/api/admin/negocios/:id', corpo, async req => {
    await admin(req);
    const n = await negocioCompleto(Number(req.params.id)); if (!n) erro(404, 'Negócio não encontrado.');
    const estado = str(req.dados.estado, 20); if (!ESTADOS[estado] || estado === 'em_revisao') erro(400, 'Estado inválido.');
    const nota = str(req.dados.nota_admin, 1000) || null;
    if (estado === 'rejeitado' && !nota) erro(400, 'Explique ao parceiro o que tem de corrigir.');
    await tx(async d => {
      await d.run('UPDATE negocios SET estado = ?, nota_admin = ?, atualizado_em = ? WHERE id = ?', estado, nota, ctx.agoraSQL(), n.id);
      // aprovação de um pedido «Este negócio é meu»: a ficha existente passa a ser do parceiro, com os preços propostos
      if (estado === 'aprovado' && n.reclama_id && !(await d.get(`SELECT id FROM ${tabelaParceiro(n.reclama_tabela)} WHERE negocio_id = ? LIMIT 1`, n.id))) {
        const f = await d.get(`SELECT * FROM ${n.reclama_tabela} WHERE id = ? FOR UPDATE`, n.reclama_id);
        if (!f) erro(404, 'A ficha reclamada já não existe.');
        if (f.negocio_id) erro(409, 'Esta ficha já foi atribuída a outro parceiro.');
        const prop = JSON.parse(n.produto_proposto || '{}');
        await gravarProduto(d, { ...n, estado: 'aprovado' }, n.reclama_tabela, { ...prop, imagem: prop.imagem || f.imagem }, f.id);
        await d.run(`UPDATE ${n.reclama_tabela} SET negocio_id = ?, imagem_ilustrativa = CASE WHEN ? THEN 0 ELSE imagem_ilustrativa END WHERE id = ?`, n.id, prop.imagem && prop.imagem !== f.imagem ? 1 : 0, f.id);
        for (const o2 of await d.all(`SELECT id, utilizador_id, nome FROM negocios WHERE reclama_tabela = ? AND reclama_id = ? AND id <> ? AND estado = 'em_revisao'`, n.reclama_tabela, n.reclama_id, n.id)) {
          await d.run(`UPDATE negocios SET estado = 'rejeitado', nota_admin = ? WHERE id = ?`, 'A ficha foi atribuída a outro pedido, depois de confirmada a propriedade.', o2.id);
          await ctx.notificar(d, o2.utilizador_id, 'Pedido não aprovado', `«${o2.nome}»: a ficha foi atribuída a outro pedido. Contacte o suporte se é o dono.`, 'x', 'negocio');
        }
      }
      for (const t of TABELAS) {
        if (estado === 'aprovado') await d.run(`UPDATE ${t} SET ativo = 1${temGeo(t) ? `, coord_estado = CASE WHEN latitude IS NOT NULL THEN 'verificada' ELSE coord_estado END, coord_fonte = CASE WHEN latitude IS NOT NULL THEN 'Indicada pelo parceiro e aprovada pela administração' ELSE coord_fonte END` : ''} WHERE negocio_id = ?`, n.id);
        else await d.run(`UPDATE ${t} SET ativo = 0 WHERE negocio_id = ?`, n.id);
      }
      const msg = { aprovado: ['Negócio aprovado', `«${n.nome}» já está publicado no Angola 365º e pode receber reservas.`, 'check'], rejeitado: ['Negócio a corrigir', `«${n.nome}»: ${nota}`, 'x'], suspenso: ['Negócio suspenso', `«${n.nome}» foi suspenso${nota ? ': ' + nota : '.'}`, 'x'] }[estado];
      await ctx.notificar(d, n.utilizador_id, msg[0], msg[1], msg[2], 'negocio');
    });
    await auditar(req, 'negocio_' + estado, 'negocios', n.id, nota || n.nome);
    return { ok: true };
  });
}

module.exports = { registar, avisarParceiro, fixos, ESTADOS };
