// Sincronização de fontes de eventos e futebol: recolha, deduplicação, registo de alterações e alertas.
// Métodos suportados: json_rna (calendário/resultados da Rádio 5), ics (calendários iCal de organizadores), manual.
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, '').replace(/\s+/g, ' ').trim();
const agoraSQL = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const UA = 'Angola365/3.4 (+https://turismo-digital-360.vercel.app; projectos@sigafangola.ao)';

const ESTADO_JOGO = { agendado: 'agendado', terminado: 'terminado', 'ao vivo': 'ao vivo', 'em curso': 'ao vivo', adiado: 'adiado', cancelado: 'cancelado', suspenso: 'adiado' };
const estadoJogo = e => ESTADO_JOGO[norm(e)] || 'agendado';

// Associa o nome do estádio usado pela fonte a um estádio conhecido (nome ou alias)
async function mapaEstadios(d) {
  const L = await d.all('SELECT id, nome, aliases FROM estadios');
  const m = new Map();
  for (const e of L) { m.set(norm(e.nome), e.id); for (const a of JSON.parse(e.aliases || '[]')) m.set(norm(a), e.id); }
  return nome => m.get(norm(nome)) ?? m.get(norm(String(nome || '').replace(/^est[aá]dio (do |da |de )?/i, 'Estádio '))) ?? null;
}

// Insere ou actualiza um jogo; regista cada campo alterado no histórico
async function gravarJogo(d, fonte, j, estadioDe, origem, contadores) {
  const reg = {
    competicao: j.competicao, jornada: j.jornada ?? null, casa: j.casa, fora: j.fora, data_hora: j.data_hora,
    estadio: j.estadio ?? null, estadio_id: j.estadio ? estadioDe(j.estadio) : null, estado: j.estado || 'agendado',
    golos_casa: j.golos_casa ?? null, golos_fora: j.golos_fora ?? null, fonte_nome: fonte.nome, fonte_url: fonte.url,
    confianca: j.confianca || (fonte.oficial ? 'oficial' : 'fonte identificada'), notas: j.notas ?? null, bilhetes_url: j.bilhetes_url ?? null,
  };
  const ex = await d.get('SELECT * FROM jogos WHERE fonte_id = ? AND externo_id = ?', fonte.id, String(j.externo_id));
  const agora = agoraSQL();
  if (!ex) {
    // A mesma partida já existe com outro identificador (a fonte por vezes duplica jogos)?
    const dup = await d.get('SELECT id FROM jogos WHERE fonte_id = ? AND data_hora = ? AND lower(casa) = lower(?) AND lower(fora) = lower(?)', fonte.id, reg.data_hora, reg.casa, reg.fora);
    if (dup) { contadores.duplicados++; return; }
    const ks = Object.keys(reg);
    await d.run(`INSERT INTO jogos (fonte_id, externo_id, ${ks.join(',')}, verificado_em, atualizado_em) VALUES (?,?,${ks.map(() => '?').join(',')},?,?)`, fonte.id, String(j.externo_id), ...ks.map(k => reg[k]), agora, agora);
    contadores.novos++; return;
  }
  const mudou = [];
  for (const k of ['data_hora', 'estadio', 'estadio_id', 'estado', 'golos_casa', 'golos_fora', 'jornada', 'competicao', 'casa', 'fora']) {
    if (String(ex[k] ?? '') !== String(reg[k] ?? '')) mudou.push(k);
  }
  if (mudou.length) {
    for (const k of mudou) await d.run('INSERT INTO historico_alteracoes (tabela, registo_id, campo, antes, depois, origem) VALUES (?,?,?,?,?,?)', 'jogos', ex.id, k, ex[k] == null ? null : String(ex[k]), reg[k] == null ? null : String(reg[k]), origem);
    // um jogo que muda de data fica marcado como adiado só se a fonte o disser; a mudança fica no histórico
    await d.run(`UPDATE jogos SET ${mudou.map(k => k + ' = ?').join(', ')}, verificado_em = ?, atualizado_em = ? WHERE id = ?`, ...mudou.map(k => reg[k]), agora, agora, ex.id);
    contadores.alterados++;
  } else await d.run('UPDATE jogos SET verificado_em = ? WHERE id = ?', agora, ex.id);
}

// ---------- adaptadores ----------
async function obter(url, op = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: op.accept || 'application/json' }, signal: ctl.signal });
    if (!r.ok) throw new Error(`A fonte respondeu ${r.status}.`);
    return op.texto ? r.text() : r.json();
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'A fonte não respondeu em 15 segundos.' : e.message); }
  finally { clearTimeout(t); }
}

const ADAPTADORES = {
  // OpenStreetMap (Overpass): lugares turísticos publicados; o endereço da fonte é tentado primeiro, depois os servidores alternativos
  async osm(fonte) { const o = require('./osm'); const lugares = await o.lerOSM({ espelhos: [...new Set([fonte.endpoint, ...o.ESPELHOS].filter(Boolean))], ms: Number(process.env.OSM_TEMPO_MS) || 90000 }); return { lugares, aviso: lugares.falhas?.length ? 'Partes por ler: ' + lugares.falhas.join(' | ') : null }; },
  // Rádio 5 / RNA: {"success":true,"data":[{id, data_hora, liga_nome, jornada, casa_nome, fora_nome, estadio_local, estado, pontos_casa, pontos_fora}]}
  async json_rna(fonte) {
    const j = await obter(fonte.endpoint);
    if (!j || j.success !== true || !Array.isArray(j.data)) throw new Error('Formato inesperado: falta success/data.');
    return { jogos: j.data.filter(x => x.id && x.data_hora && x.casa_nome && x.fora_nome).map(x => ({
      externo_id: x.id, competicao: x.liga_nome || 'Girabola', jornada: x.jornada || null, casa: x.casa_nome, fora: x.fora_nome,
      data_hora: String(x.data_hora).slice(0, 16), estadio: x.estadio_local || null, estado: estadoJogo(x.estado),
      golos_casa: x.pontos_casa != null && x.pontos_casa !== '' ? Number(x.pontos_casa) : null,
      golos_fora: x.pontos_fora != null && x.pontos_fora !== '' ? Number(x.pontos_fora) : null,
    })) };
  },
  // iCal (RFC 5545) de organizadores: VEVENT com UID, SUMMARY, DTSTART, DTEND, LOCATION, URL, STATUS
  async ics(fonte) {
    const txt = await obter(fonte.endpoint, { texto: true, accept: 'text/calendar' });
    return { eventos: lerICS(txt) };
  },
};

function lerICS(txt) {
  const linhas = String(txt).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const out = []; let ev = null;
  const data = v => { const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(v || ''); return m ? { data: `${m[1]}-${m[2]}-${m[3]}`, hora: m[4] ? `${m[4]}:${m[5]}` : '00:00' } : null; };
  const des = v => String(v || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
  for (const l of linhas) {
    if (l === 'BEGIN:VEVENT') ev = {};
    else if (l === 'END:VEVENT') { if (ev?.uid && ev.inicio && ev.titulo) out.push(ev); ev = null; }
    else if (ev) {
      const i = l.indexOf(':'); if (i < 0) continue;
      const chave = l.slice(0, i).split(';')[0].toUpperCase(), v = l.slice(i + 1);
      if (chave === 'UID') ev.uid = v.trim();
      else if (chave === 'SUMMARY') ev.titulo = des(v);
      else if (chave === 'DESCRIPTION') ev.descricao = des(v).slice(0, 1000);
      else if (chave === 'LOCATION') ev.local = des(v);
      else if (chave === 'URL') ev.url = v.trim();
      else if (chave === 'DTSTART') ev.inicio = data(v);
      else if (chave === 'DTEND') ev.fim = data(v);
      else if (chave === 'STATUS') ev.estado = /CANCELLED/i.test(v) ? 'cancelado' : /TENTATIVE/i.test(v) ? 'por confirmar' : 'agendado';
    }
  }
  return out;
}

const ORDEM_CONF = { exemplo: 0, rumor: 1, 'por confirmar': 2, 'notícia': 3, 'fonte identificada': 4, oficial: 5 };
async function gravarEvento(d, fonte, e, origem, c) {
  let ex = await d.get('SELECT * FROM eventos WHERE fonte_id = ? AND externo_id = ?', fonte.id, e.uid);
  const confianca = e.confianca || (e.estado === 'por confirmar' ? 'por confirmar' : (fonte.oficial ? 'oficial' : 'fonte identificada'));
  const reg = { titulo: e.titulo.slice(0, 200), local: (e.local || 'Local por confirmar').slice(0, 200), data: e.inicio.data, hora: e.inicio.hora, data_fim: e.fim?.data || null, descricao: e.descricao || null,
    site_oficial: e.url || null, estado: e.estado === 'por confirmar' || !e.estado ? 'agendado' : e.estado, confianca };
  const agora = agoraSQL();
  if (!ex) {
    // o mesmo evento já existe vindo de outra fonte (mesmo título e data)? não se duplica; uma fonte melhor sobe o grau de confiança
    const igual = (await d.all('SELECT * FROM eventos WHERE data = ? AND ativo = 1', reg.data)).find(x => norm(x.titulo) === norm(reg.titulo) || (norm(x.titulo).length > 12 && (norm(x.titulo).includes(norm(reg.titulo)) || norm(reg.titulo).includes(norm(x.titulo)))));
    if (igual) {
      c.duplicados++;
      if ((ORDEM_CONF[confianca] ?? 0) > (ORDEM_CONF[igual.confianca] ?? 0) && igual.fonte_tipo !== 'exemplo') {
        await d.run('INSERT INTO historico_alteracoes (tabela, registo_id, campo, antes, depois, origem) VALUES (?,?,?,?,?,?)', 'eventos', igual.id, 'confianca', igual.confianca, confianca, origem);
        await d.run('UPDATE eventos SET confianca = ?, verificado_em = ? WHERE id = ?', confianca, agora, igual.id);
      }
      return;
    }
    const prov = e.provincia ? await d.get('SELECT id FROM provincias WHERE nome = ?', e.provincia) : null;
    const tipoFonte = fonte.oficial ? 'oficial' : /^ia_/.test(fonte.metodo) ? 'ia' : 'secundaria';
    const preco = e.preco_texto ? `Preço publicado: ${e.preco_texto}.` : '';
    await d.run(`INSERT INTO eventos (titulo, local, data, hora, data_fim, descricao, site_oficial, estado, confianca, categoria, preco, lotacao, imagem, fonte_id, externo_id, fonte_nome, fonte_url, fonte_tipo, bilhetes_url,
        latitude, longitude, coord_estado, coord_fonte, municipio, provincia_id, atualizado_em, verificado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,1000,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, reg.titulo, reg.local, reg.data, reg.hora, reg.data_fim, [reg.descricao, preco].filter(Boolean).join(' ') || null, reg.site_oficial, reg.estado, reg.confianca,
      e.categoria || 'Cultura', e.imagem || '/img/ev_festival.jpg', fonte.id, e.uid, fonte.nome, e.url || fonte.url, tipoFonte, e.bilhetes_url || null,
      e.lat ?? null, e.lon ?? null, e.coord_estado || null, e.coord_fonte || null, e.municipio || null, prov?.id ?? null, agora, agora);
    c.novos++; return;
  }
  const mudou = Object.keys(reg).filter(k => String(ex[k] ?? '') !== String(reg[k] ?? ''));
  if (mudou.length) {
    for (const k of mudou) await d.run('INSERT INTO historico_alteracoes (tabela, registo_id, campo, antes, depois, origem) VALUES (?,?,?,?,?,?)', 'eventos', ex.id, k, ex[k] == null ? null : String(ex[k]), reg[k] == null ? null : String(reg[k]), origem);
    await d.run(`UPDATE eventos SET ${mudou.map(k => k + ' = ?').join(', ')}, atualizado_em = ?, verificado_em = ? WHERE id = ?`, ...mudou.map(k => reg[k]), agora, agora, ex.id);
    c.alterados++;
  } else await d.run('UPDATE eventos SET verificado_em = ? WHERE id = ?', agora, ex.id);
}

// Corre uma fonte; regista a execução; ao 3.º erro seguido avisa os administradores
async function sincronizarFonte(DB, tx, fonteId, origem = 'admin') {
  const fonte = await DB.get('SELECT * FROM fontes WHERE id = ?', fonteId);
  if (!fonte) throw Object.assign(new Error('Fonte não encontrada.'), { status: 404 });
  if (!ADAPTADORES[fonte.metodo]) throw Object.assign(new Error('Esta fonte é de inserção manual: não tem recolha automática.'), { status: 400 });
  const exec = await DB.get('INSERT INTO sincronizacoes (fonte_id, origem) VALUES (?, ?) RETURNING id', fonte.id, origem);
  const c = { lidos: 0, novos: 0, alterados: 0, duplicados: 0, removidos: 0 };
  try {
    const dados = await ADAPTADORES[fonte.metodo](fonte);
    await tx(async d => {
      const estadioDe = await mapaEstadios(d);
      for (const j of dados.jogos || []) { c.lidos++; await gravarJogo(d, fonte, j, estadioDe, 'sincronizacao:' + fonte.nome, c); }
      for (const e of dados.eventos || []) { c.lidos++; await gravarEvento(d, fonte, e, 'sincronizacao:' + fonte.nome, c); }
      if (dados.lugares) {
        const osm = require('./osm'); const ctx = await osm.contexto(d);
        for (const l of dados.lugares) { c.lidos++; await osm.gravarLugar(d, l, ctx, c); }
        c.alterados += await osm.localizarExperiencias(d);
      }
    });
    await DB.run(`UPDATE sincronizacoes SET fim = ?, estado = 'ok', lidos = ?, novos = ?, alterados = ?, duplicados = ?, erro = ? WHERE id = ?`, agoraSQL(), c.lidos, c.novos, c.alterados, c.duplicados, dados.aviso || null, exec.id);
    await DB.run(`UPDATE fontes SET ultima_sync = ?, ultimo_estado = 'ok', ultimo_erro = NULL, falhas_seguidas = 0 WHERE id = ?`, agoraSQL(), fonte.id);
    return { ...c, estado: 'ok', fonte: fonte.nome };
  } catch (e) {
    const msg = String(e.message || e).slice(0, 500);
    await DB.run(`UPDATE sincronizacoes SET fim = ?, estado = 'erro', erro = ?, lidos = ? WHERE id = ?`, agoraSQL(), msg, c.lidos, exec.id);
    const f = await DB.get(`UPDATE fontes SET ultima_sync = ?, ultimo_estado = 'erro', ultimo_erro = ?, falhas_seguidas = falhas_seguidas + 1 WHERE id = ? RETURNING falhas_seguidas`, agoraSQL(), msg, fonte.id);
    if (f?.falhas_seguidas === 3) {
      const admins = await DB.all(`SELECT id FROM utilizadores WHERE papel = 'admin' AND ativo = 1`);
      for (const a of admins) await DB.run('INSERT INTO notificacoes (utilizador_id, titulo, corpo, icone) VALUES (?,?,?,?)', a.id, 'Fonte de dados com falhas', `«${fonte.nome}» falhou 3 vezes seguidas: ${msg}`, 'bell');
    }
    return { ...c, estado: 'erro', erro: msg, fonte: fonte.nome };
  }
}

// Tarefa diária: corre as fontes automáticas cuja frequência já passou; arquiva eventos passados
async function sincronizarTudo(DB, tx, origem = 'cron', { ia = null, ate = Infinity, lugares = false } = {}) {
  const out = [];
  // lugares: true = só a importação semanal do OpenStreetMap (demora mais); false = todas as outras
  // ia: true = só fontes lidas pela IA; false = só as outras; null = todas. ate = hora limite (ms) para não exceder o tempo da função
  const L = (await DB.all(`SELECT * FROM fontes WHERE ativo = 1 AND metodo <> 'manual' ORDER BY ultima_sync NULLS FIRST, id`)).filter(f => (ia == null || /^ia_/.test(f.metodo) === ia) && (f.metodo === 'osm') === lugares);
  for (const f of L) {
    if (Date.now() > ate) { out.push({ fonte: f.nome, estado: 'adiada', erro: 'tempo esgotado; fica para a próxima execução' }); continue; }
    const devido = !f.ultima_sync || Date.now() - Date.parse(f.ultima_sync.replace(' ', 'T') + 'Z') >= Math.max(1, f.frequencia_h - 1) * 36e5;
    if (devido || origem !== 'cron') out.push(await sincronizarFonte(DB, tx, f.id, origem));
  }
  const hoje = new Date(Date.now() + 36e5).toISOString().slice(0, 10);
  const r = await DB.run(`UPDATE eventos SET estado = 'passado' WHERE COALESCE(data_fim, data) < ? AND estado IN ('agendado','adiado')`, hoje);
  return { fontes: out, eventos_arquivados: r.changes };
}

module.exports = { sincronizarFonte, sincronizarTudo, gravarJogo, mapaEstadios, lerICS, ADAPTADORES, norm };
