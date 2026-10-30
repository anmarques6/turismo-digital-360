// Aplica os dados verificados da v3.4 a uma base nova ou já existente (idempotente: pode correr várias vezes).
const D = require('./dados-angola');
const { gravarJogo, mapaEstadios } = require('./sincronizar');
const J = JSON.stringify;

// Traduções curtas dos pratos acrescentados/corrigidos (nome e descrição; a explicação longa pode ser traduzida no painel)
const TR_PRATOS = {
  'Muamba de Galinha': { en: { historia: 'Chicken cooked with palm paste, okra, garlic and palm oil, served with rice and funge. Together with funge, it is considered the national dish.' }, fr: { historia: 'Poulet cuit avec de la pâte de palme, du gombo, de l’ail et de l’huile de palme, servi avec du riz et du funge. Avec le funge, il est considéré comme le plat national.' }, es: { historia: 'Pollo cocinado con pasta de palma, quimbombó, ajo y aceite de palma, servido con arroz y funge. Junto con el funge, se considera el plato nacional.' } },
  'Calulu de Peixe': { en: { historia: 'Dried fish with vegetables — onion, tomato, okra, sweet potato, garlic, palm oil and gimboa leaves. Served with rice, funge, palm-oil beans and farofa.' }, fr: { historia: 'Poisson séché aux légumes — oignon, tomate, gombo, patate douce, ail, huile de palme et feuilles de gimboa. Servi avec riz, funge, haricots à l’huile de palme et farofa.' }, es: { historia: 'Pescado seco con verduras: cebolla, tomate, quimbombó, boniato, ajo, aceite de palma y hojas de gimboa. Se sirve con arroz, funge, frijoles con aceite de palma y farofa.' } },
  'Funge': { en: { nome: 'Funge', descricao: 'Cassava paste that goes with almost every Angolan dish.' }, fr: { nome: 'Funge', descricao: 'Pâte de manioc qui accompagne presque tous les plats angolais.' }, es: { nome: 'Funge', descricao: 'Pasta de yuca que acompaña casi todos los platos angoleños.' } },
  'Mufete': { en: { descricao: 'Grilled fish with plantain, sweet potato, cassava and palm-oil beans.' }, fr: { descricao: 'Poisson grillé avec banane plantain, patate douce, manioc et haricots à l’huile de palme.' }, es: { descricao: 'Pescado a la brasa con plátano macho, boniato, yuca y frijoles con aceite de palma.' } },
  'Moamba de Ginguba': { en: { nome: 'Peanut moamba (Moamba de Ginguba)', descricao: 'A version of chicken muamba made with peanut sauce.' }, fr: { nome: 'Moamba à l’arachide (Moamba de Ginguba)', descricao: 'Variante de la muamba de poulet à la sauce d’arachide.' }, es: { nome: 'Moamba de cacahuete (Moamba de Ginguba)', descricao: 'Variante de la muamba de pollo con salsa de cacahuete.' } },
  'Kizaca com Peixe': { en: { nome: 'Kizaca with fish', descricao: 'Cassava leaves with fish, onion and tomato.' }, fr: { nome: 'Kizaca au poisson', descricao: 'Feuilles de manioc au poisson, oignon et tomate.' }, es: { nome: 'Kizaca con pescado', descricao: 'Hojas de yuca con pescado, cebolla y tomate.' } },
  'Cabidela': { en: { descricao: 'A dish cooked in blood, usually chicken.' }, fr: { descricao: 'Plat cuit dans le sang, généralement de poulet.' }, es: { descricao: 'Plato cocinado en sangre, normalmente de pollo.' } },
  'Kissângua': { en: { descricao: 'Traditional non-alcoholic drink made from cornflour.' }, fr: { descricao: 'Boisson traditionnelle sans alcool à base de farine de maïs.' }, es: { descricao: 'Bebida tradicional sin alcohol hecha con harina de maíz.' } },
  'Cocada Amarela': { en: { nome: 'Yellow coconut sweet (Cocada Amarela)', descricao: 'Coconut sweet with egg yolks and cinnamon.' }, fr: { nome: 'Cocada amarela', descricao: 'Douceur à la noix de coco, jaunes d’œufs et cannelle.' }, es: { nome: 'Cocada amarilla', descricao: 'Dulce de coco con yemas de huevo y canela.' } },
};

async function aplicarMapa(d) {
  const { localizar } = require('./geo'); const r = { acertados: 0, fora: 0 };
  const prov = Object.fromEntries((await d.all('SELECT id, nome FROM provincias')).map(p => [p.nome, p.id]));
  for (const t of ['destinos', 'experiencias', 'alojamentos', 'restaurantes', 'eventos']) {
    for (const i of await d.all(`SELECT id, latitude, longitude, municipio, provincia_id FROM ${t} WHERE latitude IS NOT NULL`)) {
      const l = localizar(i.latitude, i.longitude);
      if (!l) { await d.run(`UPDATE ${t} SET latitude = NULL, longitude = NULL, coord_estado = NULL WHERE id = ?`, i.id); r.fora++; continue; }
      if (i.municipio !== l.municipio || (prov[l.provincia] && i.provincia_id !== prov[l.provincia])) { await d.run(`UPDATE ${t} SET municipio = ?, provincia_id = COALESCE(?, provincia_id) WHERE id = ?`, l.municipio, prov[l.provincia] ?? null, i.id); r.acertados++; }
    }
  }
  return r;
}

async function aplicarDadosV34(d, { desativarExemplos = false } = {}) {
  const hoje = D.VERIF;
  // 1. coordenadas e endereços (só onde ainda não há coordenadas)
  for (const [tabela, linhas] of Object.entries(D.COORDENADAS)) {
    const campo = tabela === 'experiencias' ? 'titulo' : 'nome';
    for (const [nome, lat, lon, estado, fonte, endereco, municipio, bairro] of linhas)
      await d.run(`UPDATE ${tabela} SET latitude = ?, longitude = ?, coord_estado = ?, coord_fonte = ?, endereco = COALESCE(endereco, ?), municipio = COALESCE(municipio, ?), bairro = COALESCE(bairro, ?), verificado_em = ? WHERE ${campo} = ? AND latitude IS NULL`, lat, lon, estado, fonte, endereco, municipio, bairro, hoje, nome);
  }
  // 2. restaurantes de cozinha tradicional citados pela VerAngola
  const luanda = (await d.get(`SELECT id FROM provincias WHERE nome = 'Luanda'`))?.id ?? null;
  for (const r of D.RESTAURANTES_NOVOS) {
    if (await d.get('SELECT 1 AS x FROM restaurantes WHERE nome = ?', r.nome)) continue;
    await d.run(`INSERT INTO restaurantes (nome, provincia_id, local, descricao, nivel_preco, especialidade, preco_medio, imagem, parceiro, fonte) VALUES (?,?,?,?,?,?,NULL,?,0,?)`, r.nome, luanda, r.local, r.desc, r.nivel, r.esp, `/img/${r.img}.jpg`, r.fonte);
  }
  // as coordenadas dos novos restaurantes
  for (const [nome, lat, lon, estado, fonte, endereco, municipio, bairro] of D.COORDENADAS.restaurantes)
    await d.run(`UPDATE restaurantes SET latitude = ?, longitude = ?, coord_estado = ?, coord_fonte = ?, endereco = COALESCE(endereco, ?), municipio = COALESCE(municipio, ?), bairro = COALESCE(bairro, ?), verificado_em = ? WHERE nome = ? AND latitude IS NULL`, lat, lon, estado, fonte, endereco, municipio, bairro, hoje, nome);
  // 3. pratos (correcções com fonte e pratos novos)
  for (const p of D.PRATOS) {
    const ex = await d.get('SELECT id, i18n FROM pratos WHERE nome = ?', p.nome);
    const tr = TR_PRATOS[p.nome];
    if (ex) {
      let i18n = {}; try { i18n = JSON.parse(ex.i18n || '{}') || {}; } catch {}
      if (tr) for (const l of Object.keys(tr)) i18n[l] = { ...(i18n[l] || {}), ...tr[l] };
      await d.run('UPDATE pratos SET ingredientes = ?, regiao = ?, fonte = ?, historia = ?, i18n = ? WHERE id = ?', J(p.ingredientes), p.regiao, p.fonte, p.historia, J(i18n), ex.id);
    } else {
      await d.run(`INSERT INTO pratos (nome, categoria, etiqueta, descricao, historia, imagem, rating, num_avaliacoes, ingredientes, regiao, fonte, i18n) VALUES (?,?,?,?,?,?,0,0,?,?,?,?)`,
        p.nome, p.categoria, p.etiqueta, p.desc, p.historia, `/img/${p.img}.jpg`, J(p.ingredientes), p.regiao, p.fonte, J(tr || {}));
    }
  }
  for (const [prato, rest, fonte, data] of D.PRATOS_RESTAURANTES) {
    const p = await d.get('SELECT id FROM pratos WHERE nome = ?', prato), r = await d.get('SELECT id FROM restaurantes WHERE nome = ?', rest);
    if (p && r) await d.run('INSERT INTO pratos_restaurantes (prato_id, restaurante_id, fonte, verificado_em) VALUES (?,?,?,?) ON CONFLICT DO NOTHING', p.id, r.id, fonte, data);
  }
  // 4. fontes e estádios
  for (const f of D.FONTES) {
    if (await d.get('SELECT 1 AS x FROM fontes WHERE nome = ?', f.nome)) continue;
    await d.run('INSERT INTO fontes (nome, url, tipo, metodo, endpoint, oficial, frequencia_h, notas) VALUES (?,?,?,?,?,?,?,?)', f.nome, f.url, f.tipo, f.metodo, f.endpoint || null, f.oficial, f.frequencia_h, f.notas);
  }
  for (const [nome, aliases, cidade, provincia, lat, lon, estado, fonte] of D.ESTADIOS)
    await d.run('INSERT INTO estadios (nome, aliases, cidade, provincia, latitude, longitude, coord_estado, coord_fonte) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (nome) DO NOTHING', nome, J(aliases), cidade, provincia, lat, lon, estado, fonte);
  // 5. jogos iniciais (a sincronização diária mantém-nos actualizados)
  const estadioDe = await mapaEstadios(d);
  const c = { novos: 0, alterados: 0, duplicados: 0 };
  const rna = await d.get(`SELECT * FROM fontes WHERE nome = 'Rádio 5 (RNA) — calendário de futebol'`);
  const rnaRes = await d.get(`SELECT * FROM fontes WHERE nome = 'Rádio 5 (RNA) — resultados'`);
  const faf = await d.get(`SELECT * FROM fontes WHERE nome = 'Federação Angolana de Futebol (FAF)'`);
  if (rna && !(await d.get('SELECT 1 AS x FROM jogos WHERE fonte_id = ?', rna.id)))
    for (const [id, dh, jor, casa, fora, est] of D.JOGOS_RNA) await gravarJogo(d, rna, { externo_id: id, competicao: 'Girabola', jornada: jor, casa, fora, data_hora: dh, estadio: est, estado: 'agendado' }, estadioDe, 'dados iniciais', c);
  if (rnaRes && !(await d.get('SELECT 1 AS x FROM jogos WHERE fonte_id = ?', rnaRes.id)))
    for (const [id, dh, casa, fora, gc, gf] of D.RESULTADOS_RNA) await gravarJogo(d, rnaRes, { externo_id: id, competicao: 'Girabola', casa, fora, data_hora: dh, estado: 'terminado', golos_casa: gc, golos_fora: gf }, estadioDe, 'dados iniciais', c);
  if (faf && !(await d.get('SELECT 1 AS x FROM jogos WHERE fonte_id = ?', faf.id)))
    for (const [id, dh, comp, casa, fora, est, notas] of D.JOGOS_FAF) await gravarJogo(d, faf, { externo_id: id, competicao: comp, casa, fora, data_hora: dh, estadio: est, estado: 'agendado', confianca: 'por confirmar', notas }, estadioDe, 'dados iniciais', c);
  // 6. eventos reais publicados em plataformas de bilhética
  for (const e of D.EVENTOS_REAIS) {
    const f = await d.get('SELECT * FROM fontes WHERE nome = ?', e.fonte || 'Ticket.ao'); if (!f) continue;
    if (await d.get('SELECT 1 AS x FROM eventos WHERE fonte_id = ? AND externo_id = ?', f.id, e.id)) continue;
    await d.run(`INSERT INTO eventos (titulo, provincia_id, local, data, data_fim, hora, categoria, descricao, preco, lotacao, imagem, fonte_id, externo_id, fonte_nome, fonte_url, fonte_tipo, confianca, estado, bilhetes_url, latitude, longitude, coord_estado, coord_fonte, verificado_em, atualizado_em)
      VALUES (?,?,?,?,?,?,?,?,?,100000,?,?,?,?,?,'secundaria','fonte identificada','agendado',?,?,?,?,?,?,?)`,
      e.titulo, luanda, e.local, e.data, e.dataFim || null, e.hora, e.cat, `Preço publicado: ${e.precoTxt}. Bilhetes à venda em ${e.fonte || 'Ticket.ao'}.`, e.preco, `/img/${e.img}.jpg`, f.id, e.id, f.nome, e.url, e.url,
      e.geo?.lat ?? null, e.geo?.lon ?? null, e.geo?.estado ?? null, e.geo?.fonte ?? null, hoje, hoje);
  }
  // 7. eventos de demonstração: ficam marcados como exemplo; em produção deixam de ser mostrados
  await d.run(`UPDATE eventos SET fonte_tipo = 'exemplo', confianca = 'por confirmar', fonte_nome = 'Exemplo de demonstração' WHERE fonte_id IS NULL AND (fonte_tipo IS NULL OR fonte_tipo = '')`);
  await d.run(`UPDATE eventos SET ativo = 0 WHERE fonte_tipo = 'exemplo' AND titulo LIKE 'Girabola:%'`); // os jogos reais estão na Central de Futebol
  if (desativarExemplos) await d.run(`UPDATE eventos SET ativo = 0 WHERE fonte_tipo = 'exemplo'`);
  // 8. obedecer ao mapa oficial de municípios: município e província vêm do mapa; pontos fora do mapa perdem as coordenadas
  c.mapa = await aplicarMapa(d);
  return c;
}

// v3.5: nome oficial «Quedas de Calandula»; experiências passam a ter a localização do lugar onde acontecem
async function aplicarDadosV35(d) {
  const trocar = (col) => `REPLACE(REPLACE(REPLACE(${col}, 'Cataratas da Kalandula', 'Quedas de Calandula'), 'cataratas da Kalandula', 'quedas de Calandula'), 'Kalandula', 'Calandula')`;
  for (const [t, cols] of [['destinos', ['nome', 'descricao', 'historia', 'quando_ir', 'dica', 'i18n']], ['experiencias', ['titulo', 'descricao', 'descricao_longa', 'local', 'i18n']], ['eventos', ['titulo', 'descricao']], ['notificacoes', ['titulo', 'corpo']], ['reservas', ['item_nome']]]) {
    const existentes = (await d.all(`SELECT column_name FROM information_schema.columns WHERE table_name = ?`, t)).map(c => c.column_name);
    for (const c of cols.filter(c => existentes.includes(c))) await d.run(`UPDATE ${t} SET ${c} = ${trocar(c)} WHERE ${c} LIKE '%Kalandula%'`);
  }
  await d.run(`UPDATE destinos SET palavras_chave = COALESCE(palavras_chave, '') || ',kalandula,calandula,quedas de calandula' WHERE nome = 'Quedas de Calandula' AND COALESCE(palavras_chave, '') NOT LIKE '%quedas de calandula%'`);
  await require('./osm').localizarExperiencias(d);
}

module.exports = { aplicarDadosV34, aplicarDadosV35, aplicarMapa };
