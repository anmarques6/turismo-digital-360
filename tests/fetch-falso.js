// Usado só nos testes: simula as respostas da Google e da Microsoft (o servidor de teste não sai para a internet).
const original = globalThis.fetch;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, op) => {
  const u = String(url);
  if (u.startsWith('https://oauth2.googleapis.com/token')) { const b = new URLSearchParams(String(op.body)); return b.get('code') === 'codigo-bom' ? json({ access_token: 'tok-google' }) : json({ error: 'invalid_grant' }, 400); }
  if (u.startsWith('https://openidconnect.googleapis.com/v1/userinfo')) return json({ sub: 'google-123', email: 'Nova.Google@Exemplo.ao', email_verified: true, name: 'Ana Google' });
  if (u.startsWith('https://login.microsoftonline.com/common/oauth2/v2.0/token')) return json({ access_token: 'tok-ms' });
  if (u.startsWith('https://graph.microsoft.com/oidc/userinfo')) return json({ sub: 'ms-999', email: 'visitante@turismo360.ao', name: 'Alguém' });
  // AI Gateway (compatível com OpenAI): modelos e conversa com ferramentas
  if (u === 'https://ai-gateway.vercel.sh/v1/models') return json({ data: [{ id: 'openai/gpt-4o-mini', type: 'language' }, { id: 'anthropic/claude-haiku-4.5', type: 'language' }] });
  if (u === 'https://ai-gateway.vercel.sh/v1/chat/completions') {
    const b = JSON.parse(op.body); const ult = b.messages[b.messages.length - 1];
    if (b.messages[0].content.startsWith('Extrais eventos')) { // pesquisa diária: a IA "extrai" — inclui de propósito um evento inventado e um passado, que o servidor tem de descartar
      const ano = new Date().getFullYear() + 1;
      const ev = ult.content.includes('Página: https://ticket.ao/')
        ? [{ titulo: 'Festival Kizomba na Baía', data: `${ano}-02-14`, hora: '20:00', local: 'Baía de Luanda', cidade: 'Luanda', categoria: 'Música', preco_texto: '10.000 Kz', url: 'https://ticket.ao/event/kizomba-baia', resumo: 'Noite de kizomba.', confianca: 'fonte identificada' },
           { titulo: 'Concerto Inventado Pela IA', data: `${ano}-03-01`, local: 'Lugar nenhum', categoria: 'Música', url: 'https://ticket.ao/event/kizomba-baia', confianca: 'fonte identificada' },
           { titulo: 'Festival Kizomba Antigo', data: '2020-01-01', local: 'Luanda', categoria: 'Música', url: 'https://ticket.ao/event/kizomba-baia', confianca: 'fonte identificada' }]
        : [{ titulo: 'Carnaval de Benguela poderá ter novo percurso', data: `${ano}-02-10`, local: 'Benguela', cidade: 'Benguela', categoria: 'Festivais', url: 'https://news.exemplo.ao/carnaval-benguela', resumo: 'Previsto, ainda sem confirmação.', confianca: 'rumor' },
           { titulo: 'Festival Kizomba na Baía', data: `${ano}-02-14`, local: 'Baía de Luanda', categoria: 'Música', url: 'https://news.exemplo.ao/kizomba', confianca: 'notícia' },
           { titulo: 'Feira com ligação falsa', data: `${ano}-04-01`, local: 'Luanda', categoria: 'Negócios', url: 'https://inventado.ao/x', confianca: 'notícia' }];
      return json({ choices: [{ message: { role: 'assistant', content: 'Aqui está: ' + JSON.stringify({ eventos: ev }) } }] });
    }
    const chamar = (name, args) => json({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c' + Date.now(), type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] });
    const dizer = content => json({ choices: [{ message: { role: 'assistant', content } }] });
    if (!b.tools?.length || !b.messages[0].content.includes('ENDA AI')) return json({ error: { message: 'pedido mal formado' } }, 400);
    if (ult.role === 'tool') return dizer('Resposta com dados: ' + ult.content.slice(0, 300));
    const t = ult.content;
    if (/FALHA/.test(t)) return json({ error: { message: 'indisponível' } }, 503);
    if (/capital de França/.test(t)) return chamar('fora_do_ambito', { motivo: 'geografia geral' });
    if (/jogo/i.test(t)) return chamar('jogos', {});
    if (/perto/i.test(t)) return chamar('lugares_perto', {});
    if (/guarda/i.test(t)) return chamar('guardar_roteiro', { titulo: 'Luanda em 1 dia', cidade: 'Luanda', itens: [{ dia: 1, periodo: 'Manhã', nome: 'Fortaleza de São Miguel' }] });
    if (/quantas/i.test(t)) return dizer('mensagens=' + b.messages.length + ' modelo=' + b.model);
    return dizer('Olá, sou a ENDA AI.');
  }
  // Rádio 5 (RNA): 1.ª leitura, 2.ª com um jogo alterado e um repetido, depois a fonte falha
  if (u.startsWith('https://teste.rna.ao/ajax_inicio.php?acao=jogos_proximos')) {
    globalThis.__rna = (globalThis.__rna || 0) + 1;
    const base = [{ id: 9001, data_hora: '2027-01-10 15:00:00', liga_nome: 'Girabola', jornada: '15', casa_nome: 'Petro de Luanda', fora_nome: 'Sagrada Esperança', estadio_local: 'Estádio 11 de Novembro', estado: 'agendado' },
      { id: 9002, data_hora: '2027-01-11 16:00:00', liga_nome: 'Girabola', jornada: '15', casa_nome: 'Wiliete', fora_nome: 'Bravos do Maquis', estadio_local: 'Estádio Ombaka', estado: 'agendado' }];
    if (globalThis.__rna === 1) return json({ success: true, data: base });
    if (globalThis.__rna === 2) return json({ success: true, data: [{ ...base[0], data_hora: '2027-01-12 17:00:00', estado: 'adiado' }, base[1], { ...base[1], id: 9003 }] });
    return json({ error: 'manutenção' }, 500);
  }
  if (u.startsWith('https://teste.rna.ao/')) return json({ success: true, data: [] });
  if (u === 'https://ticket.ao/robots.txt') return new Response('User-agent: *\nDisallow: /admin/\n', { status: 200 });
  if (u === 'https://ticket.ao/') return new Response('<html><body><h1>Próximos eventos</h1><a href="/event/kizomba-baia">Festival Kizomba na Baía — 14 Fev, Baía de Luanda, 10.000 Kz</a><a href="/admin/">x</a><a href="/event/feira-concerto">Feira Antiga e Kizomba</a></body></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
  if (u === 'https://news.google.com/robots.txt') return new Response('User-agent: *\nDisallow: /search\nAllow: /rss/search\n', { status: 200 });
  if (u.startsWith('https://news.google.com/rss/search')) return new Response(`<?xml version="1.0"?><rss><channel>
    <item><title>Carnaval de Benguela poderá ter novo percurso em fevereiro</title><link>https://news.exemplo.ao/carnaval-benguela</link><pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate><source>ANGOP</source><description>Organização estuda novo percurso</description></item>
    <item><title>Festival Kizomba na Baía regressa a Luanda</title><link>https://news.exemplo.ao/kizomba</link><pubDate>Mon, 26 Oct 2026 11:00:00 GMT</pubDate><source>Jornal de Angola</source><description>14 de Fevereiro</description></item>
    <item><title>Feira anunciada</title><link>https://news.exemplo.ao/feira</link><pubDate>Mon, 26 Oct 2026 11:00:00 GMT</pubDate></item></channel></rss>`, { status: 200, headers: { 'Content-Type': 'application/rss+xml' } });
  if (u.startsWith('https://nominatim.openstreetmap.org/search')) return json([{ name: 'Marginal de Luanda', display_name: 'Marginal de Luanda, Ingombota, Luanda, Angola', lat: '-8.8147', lon: '13.2302', category: 'highway', type: 'primary', osm_type: 'way', osm_id: 123 }]);
  return original(url, op);
};
