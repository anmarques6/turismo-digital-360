/* Cliente da API — partilhado pelo site e pelo painel de administração */
const API = (() => {
  const KEY = location.pathname.startsWith('/admin') ? 'td360_admin_token' : 'td360_token';
  let token = null;
  try { token = localStorage.getItem(KEY); } catch (e) {}
  async function pedir(metodo, url, dados) {
    const op = { method: metodo, headers: {} };
    if (token) op.headers.Authorization = 'Bearer ' + token;
    if (dados !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(dados); }
    let res;
    try { res = await fetch(url, op); } catch (e) { const err = new Error('Sem ligação ao servidor. Verifique a internet.'); err.status = 0; throw err; }
    if (res.headers.get('content-type')?.includes('text/csv')) return res.blob();
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(j.erro || 'Ocorreu um erro.'); err.status = res.status; err.dados = j; if (res.status === 401 && token) API.onExpira?.(); throw err; }
    return j;
  }
  return {
    get token() { return token; },
    setToken(t) { token = t; try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch (e) {} },
    get: u => pedir('GET', u), post: (u, d = {}) => pedir('POST', u, d), put: (u, d) => pedir('PUT', u, d),
    patch: (u, d) => pedir('PATCH', u, d), del: (u, d) => pedir('DELETE', u, d),
    onExpira: null,
  };
})();

/* Fim de sessão por inactividade: sem rato, teclado, toque ou deslocamento durante `limite` segundos
   (60 por omissão, definido pelo servidor), a sessão termina. Enquanto há actividade, avisa o servidor a cada 20 s. */
const Inatividade = (() => {
  let limite = 60, ultimo = Date.now(), ultimoSinal = 0, ligado = false, aviso = null, aoTerminar = null;
  const tr = s => (typeof I18N !== 'undefined' ? I18N.t(s) : s);
  const marcar = () => { ultimo = Date.now(); if (aviso) { aviso.remove(); aviso = null; } };
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll', 'input'].forEach(ev => addEventListener(ev, marcar, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) verificar(); });
  function mostrarAviso(seg) {
    if (!aviso) {
      aviso = document.createElement('div'); aviso.className = 'aviso-sessao'; aviso.setAttribute('role', 'alert');
      aviso.innerHTML = '<span></span><button type="button" class="btn btn-gold"></button>';
      aviso.querySelector('button').textContent = tr('Continuar ligado');
      aviso.querySelector('button').addEventListener('click', marcar);
      document.body.appendChild(aviso);
    }
    aviso.querySelector('span').textContent = tr('Por segurança, a sessão termina dentro de {s} s por inactividade.').replace('{s}', seg);
  }
  function verificar() {
    if (!ligado || !API.token) return;
    const parado = (Date.now() - ultimo) / 1000;
    if (parado >= limite) { desligar(); aoTerminar && aoTerminar(); return; }
    if (parado >= limite - 15) mostrarAviso(Math.ceil(limite - parado));
    if (parado < 20 && Date.now() - ultimoSinal > 20000) { ultimoSinal = Date.now(); API.post('/api/auth/ativo').catch(() => {}); }
  }
  setInterval(verificar, 1000);
  function ligar(fn, seg) { aoTerminar = fn; if (seg) limite = seg; ultimo = Date.now(); ultimoSinal = Date.now(); ligado = true; }
  function desligar() { ligado = false; if (aviso) { aviso.remove(); aviso = null; } }
  return { ligar, desligar, marcar, get limite() { return limite; } };
})();

/* Notificações no telemóvel/computador (Web Push): regista o service worker e a subscrição da conta */
const Push = (() => {
  const suportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
  // pedir = true: pede autorização (só depois de um toque da pessoa); false: só subscreve se já estiver autorizado
  async function activar(pedir) {
    if (!suportado() || !API.token) return 'indisponivel';
    if (Notification.permission === 'denied') return 'negado';
    if (Notification.permission !== 'granted') { if (!pedir) return 'por-pedir'; if (await Notification.requestPermission() !== 'granted') return 'negado'; }
    try {
      const { chave } = await API.get('/api/push/chave'); if (!chave) return 'sem-servidor';
      const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(chave) });
      await API.post('/api/push/subscrever', sub.toJSON()); return 'ok';
    } catch (e) { return 'erro'; }
  }
  async function cancelar() {
    if (!suportado()) return;
    try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if (sub) { await API.post('/api/push/cancelar', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); } } catch (e) {}
  }
  return { activar, cancelar, suportado };
})();
