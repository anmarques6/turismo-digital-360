/* =========================================================
   Multilíngua: Português · English · Français · Español
   - O site é escrito em português; este módulo traduz o que aparece no ecrã
     (texto, placeholder, aria-label, title, alt) com o dicionário de i18n-dic.js.
   - Frases com valores (números, nomes) usam regras com expressões regulares.
   - O conteúdo do catálogo vem traduzido da API (/api/catalogo?lang=xx).
   - Para não traduzir um elemento: translate="no".
   ========================================================= */
const I18N = (() => {
  const LINGUAS = {
    pt: { nome: 'Português', curto: 'PT', loc: 'pt-PT', voz: ['pt-PT', 'pt-BR', 'pt'] },
    en: { nome: 'English', curto: 'EN', loc: 'en-GB', voz: ['en-GB', 'en-US', 'en'] },
    fr: { nome: 'Français', curto: 'FR', loc: 'fr-FR', voz: ['fr-FR', 'fr-CA', 'fr'] },
    es: { nome: 'Español', curto: 'ES', loc: 'es-ES', voz: ['es-ES', 'es-MX', 'es'] },
  };
  const ORDEM = ['pt', 'en', 'fr', 'es'];
  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  let lang = 'pt';
  try { const g = localStorage.getItem('td360_lang'); if (LINGUAS[g]) lang = g; else { const n = (navigator.language || 'pt').slice(0, 2); if (LINGUAS[n]) lang = n; } } catch (e) {}

  const D = { en: new Map(), fr: new Map(), es: new Map() };
  const R = { en: [], fr: [], es: [] };
  // linhas: [pt, en, fr, es]
  function dic(linhas) { for (const [pt, en, fr, es] of linhas) { const k = norm(pt); if (en) D.en.set(k, en); if (fr) D.fr.set(k, fr); if (es) D.es.set(k, es); } }
  // linhas: [regex, en, fr, es] — substituição com $1, $2…
  function re(linhas) { for (const [rx, en, fr, es] of linhas) { R.en.push([rx, en]); R.fr.push([rx, fr]); R.es.push([rx, es]); } }

  // Traduz uma frase completa; devolve null se não houver tradução
  function procurar(s, l = lang) {
    if (l === 'pt') return null;
    const k = norm(s); if (!k) return null;
    const d = D[l].get(k); if (d != null) return d;
    for (const [rx, sub] of R[l]) { if (sub != null && rx.test(k)) { rx.lastIndex = 0; return k.replace(rx, (...m) => sub.replace(/\$(\d)/g, (_, i) => { const v = m[+i] ?? ''; return D[l].get(norm(v)) ?? v; })); } }
    // Frases compostas por partes separadas por « · » (ex.: "Experiências · 18/10/2026 · Carteira 360")
    if (k.includes('·')) {
      const partes = k.split('·'); let mudou = false;
      const tr = partes.map(p => { const x = norm(p); if (!x) return p; const y = procurarSimples(x, l); if (y == null) return p; mudou = true; return p.replace(x, y); });
      if (mudou) return tr.join('·').trim();
    }
    return null;
  }
  function procurarSimples(k, l) {
    const d = D[l].get(k); if (d != null) return d;
    for (const [rx, sub] of R[l]) { if (sub != null && rx.test(k)) { rx.lastIndex = 0; return k.replace(rx, (...m) => sub.replace(/\$(\d)/g, (_, i) => { const v = m[+i] ?? ''; return D[l].get(norm(v)) ?? v; })); } }
    return null;
  }
  // t('Olá, {nome}!', {nome}) — usado no código para frases com valores
  function t(s, vars) {
    let r = procurar(s) ?? s;
    if (vars) r = r.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    return r;
  }

  /* ---------- tradução do DOM ---------- */
  const ATRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const SALTAR = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT']);
  const ignorado = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { if (SALTAR.has(e.tagName) || e.getAttribute('translate') === 'no' || e.isContentEditable) return true; } return false; };
  function textoNo(n) {
    const v = n.nodeValue; if (!v || !/[A-Za-zÀ-ÿ]/.test(v)) return;
    const tr = procurar(v); if (tr == null || tr === norm(v)) return;
    const ini = v.match(/^\s*/)[0], fim = v.match(/\s*$/)[0];
    n.nodeValue = ini + tr + fim;
  }
  function elemento(el) {
    for (const a of ATRS) { const v = el.getAttribute(a); if (v) { const tr = procurar(v); if (tr != null) el.setAttribute(a, tr); } }
    if (el.tagName === 'OPTION' && !el.hasAttribute('value')) el.setAttribute('value', el.textContent); // o valor fica em português
  }
  function aplicar(raiz = document.body) {
    if (lang === 'pt' || !raiz) return;
    if (raiz.nodeType === 3) { if (!ignorado(raiz.parentElement)) textoNo(raiz); return; }
    if (raiz.nodeType !== 1) return;
    if (raiz.tagName === 'TEXTAREA') { if (!ignorado(raiz.parentElement)) elemento(raiz); return; }
    if (ignorado(raiz)) return;
    elemento(raiz);
    raiz.querySelectorAll('[placeholder],[aria-label],[title],[alt],option').forEach(el => { if (!ignorado(el.tagName === 'TEXTAREA' ? el.parentElement : el)) elemento(el); });
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, { acceptNode: n => ignorado(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nos = []; while (w.nextNode()) nos.push(w.currentNode);
    nos.forEach(textoNo);
  }
  let obs = null;
  function observar() {
    if (obs) obs.disconnect();
    if (lang === 'pt') return;
    obs = new MutationObserver(muts => {
      obs.disconnect();
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(n => aplicar(n));
        else if (m.type === 'characterData') aplicar(m.target);
        else if (m.type === 'attributes') elemento(m.target);
      }
      obs.observe(document.body, CFG);
    });
    obs.observe(document.body, CFG);
  }
  const CFG = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRS };

  const ouvintes = [];
  function definir(l) {
    if (!LINGUAS[l]) return;
    lang = l;
    try { localStorage.setItem('td360_lang', l); } catch (e) {}
    document.documentElement.lang = l === 'pt' ? 'pt' : l;
    observar();
    ouvintes.forEach(f => { try { f(l); } catch (e) { console.error(e); } });
  }
  function iniciar() { document.documentElement.lang = lang; if (document.body) { observar(); aplicar(document.body); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();

  // Seletor de língua reutilizável
  const seletor = (cls = '') => { const mini = /\bmini\b/.test(cls); return `<label class="lang-sel ${cls}" translate="no"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg><span class="sr">Idioma / Language</span><select data-lang aria-label="Idioma / Language">${ORDEM.map(k => `<option value="${k}" ${k === lang ? 'selected' : ''}>${mini ? LINGUAS[k].curto : LINGUAS[k].curto + ' · ' + LINGUAS[k].nome}</option>`).join('')}</select></label>`; };

  return {
    get lang() { return lang; }, get loc() { return LINGUAS[lang].loc; }, get vozes() { return LINGUAS[lang].voz; },
    LINGUAS, ORDEM, dic, re, t, procurar, aplicar, definir, seletor,
    aoMudar: f => ouvintes.push(f),
  };
})();
const t = I18N.t;
