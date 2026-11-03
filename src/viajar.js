// Angola 365º — COMO VIAJAR: como chegar a um destino a partir de onde o turista está.
// Separação: dados de referência (capitais, aeroportos) · conectores por transportadora · motor de pesquisa ·
// viagens do turista (histórico e estados) · monitorização das integrações.
// Regra: nunca inventar horários, preços ou disponibilidade; nunca dar uma viagem como reservada sem resposta do operador.
const { get, all, run, tx, parseJSON } = require('./db');
const { erro } = require('./http');
const { localizar } = require('./geo');

const str = (v, max = 300) => (v == null ? '' : String(v)).trim().slice(0, max);
const enc = encodeURIComponent;
const dataOk = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !isNaN(Date.parse(d + 'T12:00:00Z'));
const hojeAO = () => new Date(Date.now() + 36e5).toISOString().slice(0, 10);
const agoraSQL = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
function distanciaKm(a, b, c, d) { const R = 6371, r = x => x * Math.PI / 180; const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

// ---------- dados de referência ----------
// Capitais de província (coordenadas aproximadas do centro da cidade): usadas quando o turista escolhe a origem à mão
const CAPITAIS = {
  Luanda: ['Luanda', -8.8383, 13.2344], 'Icolo e Bengo': ['Catete', -9.1095, 13.693], Bengo: ['Caxito', -8.5786, 13.6644], Benguela: ['Benguela', -12.5763, 13.4055],
  'Bié': ['Cuito', -12.3833, 16.9333], Cabinda: ['Cabinda', -5.55, 12.2], Cuando: ['Mavinga', -15.7922, 20.3567], Cubango: ['Menongue', -14.6585, 17.691],
  'Cuanza Norte': ['Ndalatando', -9.2978, 14.9116], 'Cuanza Sul': ['Sumbe', -11.2061, 13.8437], Cunene: ['Ondjiva', -17.0667, 15.7333], Huambo: ['Huambo', -12.7761, 15.7392],
  'Huíla': ['Lubango', -14.9172, 13.4925], 'Lunda Norte': ['Dundo', -7.3801, 20.8352], 'Lunda Sul': ['Saurimo', -9.6608, 20.3916], Malanje: ['Malanje', -9.5402, 16.341],
  Moxico: ['Luena', -11.7833, 19.9167], 'Moxico Leste': ['Cazombo', -11.8866, 22.9147], Namibe: ['Moçâmedes', -15.1961, 12.1522], 'Uíge': ['Uíge', -7.6087, 15.0613], Zaire: ['Mbanza Kongo', -6.267, 14.2401],
};
// Aeroportos com voos domésticos, por província. Luanda: desde 1/2/2025 os voos domésticos partem do novo aeroporto.
const AEROPORTOS = {
  Luanda: 'Aeroporto Internacional Dr. António Agostinho Neto (Icolo e Bengo)', 'Icolo e Bengo': 'Aeroporto Internacional Dr. António Agostinho Neto', Bengo: 'Aeroporto Internacional Dr. António Agostinho Neto (Icolo e Bengo)',
  Cabinda: 'Aeroporto de Cabinda', Benguela: 'Aeroporto da Catumbela', 'Bié': 'Aeroporto Joaquim Kapango (Cuito)', 'Lunda Norte': 'Aeroporto do Dundo', Huambo: 'Aeroporto Albano Machado (Huambo)',
  'Huíla': 'Aeroporto da Mukanka (Lubango)', Moxico: 'Aeroporto do Luena', Cubango: 'Aeroporto de Menongue', Namibe: 'Aeroporto Welwitschia Mirabilis (Moçâmedes)',
  Cunene: 'Aeroporto de Ondjiva', 'Lunda Sul': 'Aeroporto de Saurimo', Zaire: 'Aeroporto do Soyo',
};
// Províncias sem ligação terrestre directa ao resto do país
const SO_AR_MAR = new Set(['Cabinda']);

// ---------- conectores (um por transportadora, independentes) ----------
// nivel 2 = abre a plataforma com os campos preenchidos (só parâmetros publicados pelo operador ou gerados pelo seu formulário público)
const CONECTORES = {
  nawabus: {
    cidades: { Luanda: 'Luanda', Bengo: 'Luanda', 'Icolo e Bengo': 'Luanda', Benguela: 'Benguela', 'Cuanza Sul': 'Cuanza Sul', Huambo: 'Huambo', 'Huíla': 'Lubango', Malanje: 'Malanje', 'Cuanza Norte': 'Ndalatando', 'Uíge': 'Uíge', Zaire: 'Soyo', Cabinda: 'Cabinda', Namibe: 'Namibe' },
    campos: ['origem', 'destino', 'data_ida', 'tipo_viagem'],
    url: (o, d, v) => `https://www.nawabus.ao/search?origin=${enc(o)}&destination=${enc(d)}&date=${v.data_ida || hojeAO()}&tripType=one-way`,
  },
  macon: {
    // códigos publicados no formulário do site da MACON (macontransp.com), terminal principal de cada capital
    cidades: { Luanda: '228', Bengo: '228', 'Icolo e Bengo': '228', Benguela: '21817', 'Cuanza Sul': '21815', 'Cuanza Norte': '21812', Huambo: '21827', 'Huíla': '21820', Namibe: '21818', Malanje: '21947', 'Uíge': '21813', Zaire: '21590', Cabinda: '211', 'Bié': '21830', Cunene: '21832', 'Lunda Norte': '21842', 'Lunda Sul': '21835', Cubango: '21837' },
    campos: ['origem', 'destino', 'data_ida', 'data_volta'],
    url: (o, d, v) => `https://www.webrodoviaria.com.br/VendaWebMacon/busca?origemCodigo=${o}&destinoCodigo=${d}&dataInicial=${v.data_ida || ''}&dataFinal=${v.tipo_viagem === 'ida_volta' ? v.data_volta || '' : ''}`,
  },
  huambo_expresso: {
    // valores do formulário público (GET) de huamboexpresso-bilhetes.ao
    cidades: { Luanda: '200*LUANDA - TERMINAL DA GAMEK', Bengo: '200*LUANDA - TERMINAL DA GAMEK', 'Icolo e Bengo': '200*LUANDA - TERMINAL DA GAMEK', Huambo: '100*HUAMBO - TERMINAL - CIDADE BAIXA', Benguela: '600*BENGUELA - TERMINAL - DOMINGOS DO Ó', 'Huíla': '400*LUBANGO - TERMINAL - TCHIOCO', Namibe: '750*NAMIBE', 'Cuanza Sul': '500*SUMBE', 'Bié': '300*KUITO', Cunene: '701*ONDJIVA', Zaire: '210*SOYO' },
    campos: ['origem', 'destino', 'data_ida'],
    url: (o, d, v) => `https://huamboexpresso-bilhetes.ao/encontre/viagem?province_origem=${enc(o)}&province_destine=${enc(d)}&name=${v.data_ida || ''}`,
  },
};
const ESTADOS_VISIVEIS = ['activa', 'em_integracao', 'apenas_redireccionamento', 'aguarda_parceria'];
const ROTULO_ESTADO = { pesquisa: 'Pesquisa iniciada', redireccionada: 'Redireccionamento efectuado', reserva_pendente: 'Reserva pendente', reserva_confirmada: 'Reserva confirmada', reserva_cancelada: 'Reserva cancelada' };

// Como abrir esta transportadora para esta viagem: { url, preenchido:[campos], modo }
function ligacao(t, v) {
  const c = CONECTORES[t.conector];
  const usaConector = c && t.nivel_integracao <= 2 && ['activa', 'em_integracao'].includes(t.estado_integracao);
  if (usaConector) {
    const o = c.cidades[v.origem_provincia], d = c.cidades[v.destino_provincia];
    if (o && d && o !== d) return { url: c.url(o, d, v), preenchido: c.campos.filter(k => k !== 'data_volta' || v.tipo_viagem === 'ida_volta'), modo: t.estado_integracao === 'activa' ? 'preenchido' : 'preenchido_a_confirmar' };
  }
  return { url: t.site, preenchido: [], modo: 'site' };
}
const serve = (t, prov) => { const c = parseJSON(t.cobertura, []); return c.includes(prov); };

// Resolve um ponto (coordenadas, província ou item do catálogo) para nome, província e município do mapa oficial
async function resolverPonto(p, listarPublico) {
  if (!p || typeof p !== 'object') erro(400, 'Indique a origem e o destino.');
  if (p.tipo && p.id) {
    const T = { destino: 'destinos', experiencia: 'experiencias', alojamento: 'alojamentos', restaurante: 'restaurantes', evento: 'eventos' }[p.tipo];
    if (!T) erro(400, 'Destino inválido.');
    const it = (await listarPublico(T, 'pt')).find(x => x.id === Number(p.id)); if (!it) erro(404, 'Destino não encontrado.');
    const lat = it.latitude, lon = it.longitude, l = lat != null ? localizar(lat, lon) : null;
    const prov = l?.provincia || it.provincia; if (!prov) erro(400, 'Este destino ainda não tem localização confirmada.');
    return { nome: it.nome || it.titulo, provincia: prov, municipio: l?.municipio || it.municipio || null, lat: lat ?? CAPITAIS[prov]?.[1], lon: lon ?? CAPITAIS[prov]?.[2], tipo: p.tipo, id: it.id, aproximado: lat == null };
  }
  if (p.lat != null && p.lon != null) {
    const lat = Number(p.lat), lon = Number(p.lon); const l = localizar(lat, lon);
    if (!l) erro(400, 'A localização fica fora de Angola. Escolha a origem à mão.');
    return { nome: str(p.nome, 120) || `${l.municipio}, ${l.provincia}`, provincia: l.provincia, municipio: l.municipio, lat, lon };
  }
  const prov = str(p.provincia, 40); if (!CAPITAIS[prov]) erro(400, 'Província desconhecida.');
  const [cap, lat, lon] = CAPITAIS[prov];
  return { nome: str(p.nome, 120) || `${cap} (${prov})`, provincia: prov, municipio: null, lat, lon, aproximado: true };
}

function registar({ api, auth, admin, corpo, auditar, listarPublico, notificar }) {
  const minhaViagem = async (req, id) => { const v = await get('SELECT * FROM viagens WHERE id = ? AND utilizador_id = ?', Number(id), req.user.id); if (!v) erro(404, 'Viagem não encontrada.'); return v; };
  const evento = (d, vid, tipo, tid = null, detalhe = null) => d.run('INSERT INTO viagem_eventos (viagem_id, tipo, transportadora_id, detalhe) VALUES (?,?,?,?)', vid, tipo, tid, detalhe == null ? null : str(detalhe, 1000));

  api.get('/api/viagens/referencia', async () => ({ capitais: Object.fromEntries(Object.entries(CAPITAIS).map(([p, [c, la, lo]]) => [p, { capital: c, lat: la, lon: lo }])), aeroportos: AEROPORTOS, estados: ROTULO_ESTADO }));

  // Motor de pesquisa: origem + destino → tipo de deslocação e opções por categoria (só dados confirmados ou marcados como estimativa)
  api.post('/api/viagens/pesquisar', corpo, async req => {
    await auth(req);
    const b = req.dados || {};
    const tipo_viagem = b.tipo_viagem === 'ida_volta' ? 'ida_volta' : 'ida';
    const passageiros = Math.round(Number(b.passageiros || 1)); if (!(passageiros >= 1 && passageiros <= 20)) erro(400, 'Passageiros: de 1 a 20.');
    const data_ida = str(b.data_ida, 10) || null, data_volta = tipo_viagem === 'ida_volta' ? str(b.data_volta, 10) || null : null;
    if (data_ida && (!dataOk(data_ida) || data_ida < hojeAO())) erro(400, 'A data de partida tem de ser hoje ou uma data futura.');
    if (data_volta && (!dataOk(data_volta) || (data_ida && data_volta < data_ida))) erro(400, 'A data de regresso tem de ser depois da partida.');
    const O = await resolverPonto(b.origem, listarPublico), D = await resolverPonto(b.destino, listarPublico);
    const inter = O.provincia !== D.provincia;
    const v = { origem_provincia: O.provincia, destino_provincia: D.provincia, data_ida, data_volta, tipo_viagem, passageiros };

    const T = await all(`SELECT * FROM transportadoras WHERE ativo = 1 AND estado_integracao IN (${ESTADOS_VISIVEIS.map(() => '?').join(',')}) ORDER BY ordem, nome`, ...ESTADOS_VISIVEIS);
    const R = inter ? await all(`SELECT r.*, po.nome AS origem, pd.nome AS destino, ta.nome AS terminal_origem, tb.nome AS terminal_destino FROM rotas r JOIN provincias po ON po.id = r.origem_provincia_id JOIN provincias pd ON pd.id = r.destino_provincia_id
      LEFT JOIN terminais ta ON ta.id = r.terminal_origem_id LEFT JOIN terminais tb ON tb.id = r.terminal_destino_id WHERE r.ativo = 1 AND po.nome = ? AND pd.nome = ?`, O.provincia, D.provincia) : [];
    const termin = await all(`SELECT t.id, t.nome, t.transportadora_id, t.tipo, t.endereco, t.latitude, t.longitude, p.nome AS provincia FROM terminais t LEFT JOIN provincias p ON p.id = t.provincia_id WHERE t.ativo = 1 AND p.nome IN (?, ?)`, O.provincia, D.provincia);
    const opcao = t => {
      const l = ligacao(t, v); const rotas = R.filter(r => r.transportadora_id === t.id).map(r => ({ ...r, horarios: parseJSON(r.horarios, []) }));
      const cobre = serve(t, O.provincia) && serve(t, D.provincia);
      const confirmada = rotas.find(r => r.preco != null || r.duracao_min || r.horarios.length);
      return { id: t.id, nome: t.nome, categoria: t.categoria, logotipo: t.logotipo, site: t.site, telefone: t.telefone, whatsapp: t.whatsapp, descricao: t.descricao, nivel: t.nivel_integracao, estado_integracao: t.estado_integracao, limitacoes: t.limitacoes,
        cobertura: rotas.length ? 'rota_registada' : cobre ? 'provincias_servidas' : parseJSON(t.cobertura, []).length ? 'nao_indicada' : 'a_confirmar',
        modo: l.modo, preenchido: l.preenchido, rotas, preco: confirmada?.preco ?? null, duracao_min: confirmada?.duracao_min ?? null, horarios: confirmada?.horarios || [], fonte: confirmada?.fonte_url || null, verificado_em: confirmada?.verificado_em || null, aviso: rotas.find(r => r.aviso)?.aviso || null,
        terminais: termin.filter(x => x.transportadora_id === t.id || (x.transportadora_id == null && x.tipo === (t.categoria === 'aereo' ? 'aeroporto' : 'rodoviario'))) };
    };
    const util = o => o.cobertura !== 'nao_indicada';
    const rodoviario = inter && !SO_AR_MAR.has(O.provincia) && !SO_AR_MAR.has(D.provincia) ? T.filter(t => t.categoria === 'rodoviario').map(opcao).filter(util) : [];
    const aereo = inter && AEROPORTOS[O.provincia] && AEROPORTOS[D.provincia] && AEROPORTOS[O.provincia] !== AEROPORTOS[D.provincia] ? T.filter(t => t.categoria === 'aereo').map(opcao).filter(util) : [];
    // Viagem de carro: estimativas (linha recta × 1,3; média de 60 km/h; 9 l/100 km)
    const reta = distanciaKm(O.lat, O.lon, D.lat, D.lon), estrada = Math.round(reta * 1.3);
    const carro = SO_AR_MAR.has(O.provincia) !== SO_AR_MAR.has(D.provincia) ? { possivel: false, motivo: 'Cabinda não tem ligação terrestre directa ao resto de Angola: a viagem faz-se de avião ou de barco.' }
      : { possivel: true, linha_recta_km: Math.round(reta), estrada_km_estimada: estrada, tempo_min_estimado: Math.round(estrada / 60 * 60), consumo_litros_estimado: Math.round(estrada * 9 / 100), pressupostos: 'Estimativas: distância em linha recta × 1,3, média de 60 km/h e consumo de 9 litros por 100 km. Confirme o percurso no Google Maps ou no Waze.' };

    // a mesma pesquisa repetida nas últimas 24 h reaproveita o registo (não enche «As minhas viagens»)
    const igual = await get(`SELECT id FROM viagens WHERE utilizador_id = ? AND estado = 'pesquisa' AND origem_nome = ? AND destino_nome = ? AND tipo_viagem = ? AND COALESCE(data_ida, '') = ? AND COALESCE(data_volta, '') = ? AND passageiros = ? AND criado_em >= ? ORDER BY id DESC LIMIT 1`,
      req.user.id, O.nome, D.nome, tipo_viagem, data_ida || '', data_volta || '', passageiros, new Date(Date.now() - 864e5).toISOString().slice(0, 19).replace('T', ' '));
    const vid = igual ? igual.id : (await run(`INSERT INTO viagens (utilizador_id, origem_nome, origem_provincia, origem_municipio, origem_lat, origem_lon, destino_nome, destino_provincia, destino_municipio, destino_lat, destino_lon, destino_tipo, destino_item_id, interprovincial, tipo_viagem, data_ida, data_volta, passageiros, categoria)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`, req.user.id, O.nome, O.provincia, O.municipio, O.lat, O.lon, D.nome, D.provincia, D.municipio, D.lat, D.lon, D.tipo || null, D.id || null, inter ? 1 : 0, tipo_viagem, data_ida, data_volta, passageiros, str(b.categoria, 20) || null)).id;
    if (!igual) await evento({ run }, vid, 'pesquisa', null, `${O.provincia} → ${D.provincia}`);
    return { viagem_id: vid, origem: O, destino: D, interprovincial: inter, titulo: inter ? `Como viajar de ${O.provincia} para ${D.provincia}?` : `Como chegar a ${D.nome}?`,
      aeroportos: { origem: AEROPORTOS[O.provincia] || null, destino: AEROPORTOS[D.provincia] || null }, rodoviario, aereo, carro, so_ar_mar: SO_AR_MAR.has(O.provincia) || SO_AR_MAR.has(D.provincia) };
  });

  // «Continuar na plataforma»: valida, prepara a ligação do conector, regista o redireccionamento
  api.post('/api/viagens/:id/continuar', corpo, async req => {
    await auth(req); const v = await minhaViagem(req, req.params.id);
    const t = await get('SELECT * FROM transportadoras WHERE id = ? AND ativo = 1', Number(req.dados?.transportadora_id));
    if (!t || !ESTADOS_VISIVEIS.includes(t.estado_integracao)) erro(404, 'Transportadora indisponível.');
    if (v.data_ida && v.data_ida < hojeAO()) erro(400, 'A data de partida já passou. Faça uma nova pesquisa.');
    const l = ligacao(t, v); if (!l.url) erro(409, 'Esta transportadora não tem plataforma online. Use os contactos indicados.');
    await tx(async d => {
      await d.run(`UPDATE viagens SET transportadora_id = ?, categoria = ?, estado = CASE WHEN estado = 'pesquisa' THEN 'redireccionada' ELSE estado END, atualizado_em = ? WHERE id = ?`, t.id, t.categoria, agoraSQL(), v.id);
      await evento(d, v.id, 'redireccionamento', t.id, `${l.modo} · ${l.url.slice(0, 300)}`);
    });
    return { url: l.url, modo: l.modo, preenchido: l.preenchido, transportadora: t.nome };
  });

  // As minhas viagens
  api.get('/api/viagens', async req => {
    await auth(req);
    const L = await all(`SELECT v.*, t.nome AS transportadora, t.site AS transportadora_site FROM viagens v LEFT JOIN transportadoras t ON t.id = v.transportadora_id WHERE v.utilizador_id = ? ORDER BY v.criado_em DESC, v.id DESC LIMIT 100`, req.user.id);
    return L.map(x => ({ ...x, estado_rotulo: ROTULO_ESTADO[x.estado] }));
  });
  // O turista regista a referência de uma reserva feita na plataforma do operador.
  // Fica «reserva pendente»: só passa a confirmada com resposta do operador (integração ou confirmação na administração).
  api.patch('/api/viagens/:id', corpo, async req => {
    await auth(req); const v = await minhaViagem(req, req.params.id); const b = req.dados || {};
    if (b.acao === 'referencia') {
      const ref = str(b.referencia, 60); if (ref.length < 3) erro(400, 'Indique a referência da reserva dada pela transportadora.');
      if (!v.transportadora_id) erro(400, 'Escolha primeiro a transportadora.');
      if (['reserva_confirmada', 'reserva_cancelada'].includes(v.estado)) erro(409, 'Esta viagem já não pode ser alterada.');
      await tx(async d => { await d.run(`UPDATE viagens SET referencia = ?, estado = 'reserva_pendente', atualizado_em = ? WHERE id = ?`, ref, agoraSQL(), v.id); await evento(d, v.id, 'referencia_registada', v.transportadora_id, ref); });
    } else if (b.acao === 'cancelar') {
      if (v.estado === 'reserva_confirmada') erro(409, 'Uma reserva confirmada cancela-se junto da transportadora.');
      await tx(async d => { await d.run(`UPDATE viagens SET estado = 'reserva_cancelada', atualizado_em = ? WHERE id = ?`, agoraSQL(), v.id); await evento(d, v.id, 'cancelada', v.transportadora_id); });
    } else erro(400, 'Acção desconhecida.');
    return get('SELECT * FROM viagens WHERE id = ?', v.id);
  });
  api.delete('/api/viagens/:id', async req => { await auth(req); const v = await minhaViagem(req, req.params.id); await run('DELETE FROM viagens WHERE id = ?', v.id); return { apagada: true }; });

  // ---------- administração: monitorização e confirmação de reservas ----------
  api.get('/api/admin/transportes', async req => {
    await admin(req);
    const T = await all(`SELECT t.id, t.nome, t.categoria, t.conector, t.nivel_integracao, t.estado_integracao, t.ultima_verificacao, t.ultimo_estado, t.ultimo_tempo_ms, t.ultimo_erro, t.ativo,
      (SELECT COUNT(*)::int FROM viagens v WHERE v.transportadora_id = t.id) AS viagens,
      (SELECT COUNT(*)::int FROM viagem_eventos e WHERE e.transportadora_id = t.id AND e.tipo = 'redireccionamento') AS redireccionamentos,
      (SELECT COUNT(*)::int FROM viagens v WHERE v.transportadora_id = t.id AND v.estado = 'reserva_pendente') AS reservas_pendentes,
      (SELECT COUNT(*)::int FROM viagens v WHERE v.transportadora_id = t.id AND v.estado = 'reserva_confirmada') AS reservas_confirmadas FROM transportadoras t ORDER BY t.ordem, t.nome`);
    const resumo = await get(`SELECT COUNT(*)::int AS pesquisas, COUNT(*) FILTER (WHERE interprovincial = 1)::int AS interprovinciais FROM viagens`);
    const pares = await all(`SELECT origem_provincia, destino_provincia, COUNT(*)::int AS n FROM viagens GROUP BY 1, 2 ORDER BY n DESC LIMIT 10`);
    const pendentes = await all(`SELECT v.id, v.origem_provincia, v.destino_provincia, v.data_ida, v.passageiros, v.referencia, v.atualizado_em, t.nome AS transportadora, u.nome AS cliente, u.email FROM viagens v JOIN utilizadores u ON u.id = v.utilizador_id LEFT JOIN transportadoras t ON t.id = v.transportadora_id WHERE v.estado = 'reserva_pendente' ORDER BY v.atualizado_em DESC LIMIT 50`);
    const verificacoes = await all('SELECT x.*, t.nome FROM verificacoes_transporte x JOIN transportadoras t ON t.id = x.transportadora_id ORDER BY x.id DESC LIMIT 40');
    return { transportadoras: T, resumo, pares, pendentes, verificacoes };
  });
  // A administração regista a resposta do operador (por e-mail, telefone ou sistema do operador)
  api.patch('/api/admin/viagens/:id', corpo, async req => {
    await admin(req);
    const v = await get('SELECT * FROM viagens WHERE id = ?', Number(req.params.id)); if (!v) erro(404, 'Viagem não encontrada.');
    const estado = str(req.dados?.estado, 30), como = str(req.dados?.confirmado_por, 200);
    if (!['reserva_confirmada', 'reserva_cancelada'].includes(estado)) erro(400, 'Estado inválido.');
    if (v.estado !== 'reserva_pendente') erro(409, 'Só reservas pendentes podem ser confirmadas ou recusadas.');
    if (estado === 'reserva_confirmada' && como.length < 3) erro(400, 'Indique como o operador confirmou (ex.: e-mail da MACON de 3/11).');
    await tx(async d => {
      await d.run('UPDATE viagens SET estado = ?, confirmado_por = ?, atualizado_em = ? WHERE id = ?', estado, como || null, agoraSQL(), v.id);
      await evento(d, v.id, estado === 'reserva_confirmada' ? 'confirmada_pelo_operador' : 'recusada_pelo_operador', v.transportadora_id, como);
      await notificar(d, v.utilizador_id, estado === 'reserva_confirmada' ? 'Viagem confirmada pela transportadora' : 'Reserva não confirmada', `${v.origem_provincia} → ${v.destino_provincia}${v.referencia ? ' · ref. ' + v.referencia : ''}`, estado === 'reserva_confirmada' ? 'check' : 'x', 'viagens');
    });
    await auditar(req, 'viagem_' + estado, 'viagens', v.id, como);
    return { ok: true };
  });
  // Verificação das ligações de cada transportadora (semanal pela tarefa agendada, ou a pedido no painel)
  async function verificarTodas() {
    const T = await all('SELECT * FROM transportadoras WHERE ativo = 1');
    const amanha = new Date(Date.now() + 864e5 + 36e5).toISOString().slice(0, 10);
    const out = [];
    for (const t of T) {
      const l = ligacao(t, { origem_provincia: 'Luanda', destino_provincia: t.categoria === 'aereo' ? 'Huíla' : 'Benguela', data_ida: amanha, tipo_viagem: 'ida', passageiros: 1 });
      if (!l.url) continue;
      const t0 = Date.now(); let st = null, er = null;
      try { const r = await fetch(l.url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Angola365-verificacao/1.0 (+https://turismo-digital-360.vercel.app)' }, signal: AbortSignal.timeout(15000) }); st = r.status; } catch (e) { er = str(e.message, 200); }
      const ms = Date.now() - t0;
      await run('INSERT INTO verificacoes_transporte (transportadora_id, url, estado_http, tempo_ms, erro) VALUES (?,?,?,?,?)', t.id, l.url.slice(0, 500), st, ms, er);
      await run('UPDATE transportadoras SET ultima_verificacao = ?, ultimo_estado = ?, ultimo_tempo_ms = ?, ultimo_erro = ? WHERE id = ?', agoraSQL(), st ? `HTTP ${st}` : 'sem resposta', ms, er || (st >= 400 ? `HTTP ${st}` : null), t.id);
      out.push({ nome: t.nome, estado_http: st, tempo_ms: ms, erro: er });
    }
    await run(`DELETE FROM verificacoes_transporte WHERE id NOT IN (SELECT id FROM verificacoes_transporte ORDER BY id DESC LIMIT 2000)`);
    return out;
  }
  api.post('/api/admin/transportes/verificar', async req => { await admin(req); return { resultados: await verificarTodas() }; });
  api.get('/api/cron/transportes', async req => {
    const s = process.env.CRON_SECRET; if (s && req.headers.authorization !== `Bearer ${s}`) erro(401, 'Não autorizado.');
    return { resultados: await verificarTodas() };
  });
}

module.exports = { registar, ligacao, CONECTORES, CAPITAIS, AEROPORTOS };
