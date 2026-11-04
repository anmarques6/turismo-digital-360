/* =========================================================
   ANGOLA 365º — Avaliações (estrelas e comentários) de destinos, alojamentos, restaurantes, experiências e pratos
   Uma avaliação por pessoa e por lugar (pode editar ou apagar). As notas vêm só de avaliações reais.
   Carregado depois de app.js.
   ========================================================= */
const ta = s => I18N.t(s);
const estrelasTxt = n => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
// Botão das estrelas nas fichas: mostra a nota e abre as avaliações
function avalBtn(tipo, id, r, n) {
  const tem = Number(r) > 0;
  return `<button type="button" class="aval-btn" data-avaliar="${tipo}:${id}" aria-label="${esc(ta('Ver e escrever avaliações'))}">${tem ? `<span class="star">${ic('star')}</span><b class="num">${Number(r).toFixed(1)}</b> <span class="meta">(${n} ${ta(n === 1 ? 'avaliação' : 'avaliações')})</span>` : `<span class="star">${ic('star')}</span><span>${ta('Seja o primeiro a avaliar')}</span>`}</button>`;
}
function nomeAvaliado(tipo, id) { const it = item(tipo, id); return it ? (it.nome || it.titulo) : ''; }

async function abrirAvaliacoes(tipo, id) {
  const m = openModal(`<div class="modal aval-modal" role="dialog" aria-modal="true" aria-label="${esc(ta('Avaliações'))}"><div class="mb">${modalHead(esc(nomeAvaliado(tipo, id)) || ta('Avaliações'))}<p class="meta">${ta('A carregar…')}</p></div></div>`);
  let A; try { A = await API.get(`/api/avaliacoes-de/${tipo}/${id}`); } catch (er) { m.querySelector('.mb p').textContent = er.message; return; }
  const max = Math.max(1, ...A.distribuicao.map(d => d.total)), minha = A.minha;
  const dataTxt = s => dataSQL(s).toLocaleDateString(I18N.loc, { day: 'numeric', month: 'short', year: 'numeric' });
  m.querySelector('.mb').innerHTML = `${modalHead(esc(nomeAvaliado(tipo, id)) || ta('Avaliações'))}
   <div class="aval-resumo"><div class="aval-media"><b class="num">${A.total ? A.media.toFixed(1) : '—'}</b><span class="aval-estrelas" aria-hidden="true">${estrelasTxt(Math.round(A.media))}</span><small>${A.total} ${ta(A.total === 1 ? 'avaliação' : 'avaliações')}</small></div>
    <div class="aval-dist">${A.distribuicao.map(d => `<div><span>${d.estrelas}★</span><i><b style="width:${(d.total / max * 100).toFixed(0)}%"></b></i><small class="num">${d.total}</small></div>`).join('')}</div></div>
   <form class="aval-form" data-avalf="${tipo}:${id}"><b>${ta(minha ? 'A sua avaliação' : 'Deixe a sua avaliação')}</b>
    <div class="rate" role="radiogroup" aria-label="${esc(ta('Número de estrelas'))}">${[5, 4, 3, 2, 1].map(n => `<input type="radio" id="av${n}" name="nota" value="${n}" ${(minha?.nota || 0) === n ? 'checked' : ''} required><label for="av${n}" title="${n} ${ta(n > 1 ? 'estrelas' : 'estrela')}">★</label>`).join('')}</div>
    <textarea name="comentario" rows="3" maxlength="800" placeholder="${esc(ta('Conte como foi: atendimento, limpeza, preço, o que gostou ou não'))}">${esc(minha?.comentario || '')}</textarea>
    ${minha && !minha.aprovada ? `<p class="aviso-viagem">${ic('clock')} ${ta('A sua avaliação foi ocultada pela moderação.')}</p>` : ''}
    <p class="err" hidden></p>
    <div class="vj-op-bt"><button class="btn btn-red" type="submit">${ic('check')} ${ta(minha ? 'Actualizar avaliação' : 'Publicar avaliação')}</button>${minha ? `<button type="button" class="btn btn-ghost" data-aval-apagar="${minha.id}:${tipo}:${id}">${ic('trash')} ${ta('Apagar')}</button>` : ''}</div>
    <small class="meta">${ta('As avaliações são públicas com o seu primeiro nome e a inicial do apelido. Seja respeitoso: comentários ofensivos são removidos.')}</small></form>
   <div class="aval-lista">${A.lista.map(a => `<article><div class="aval-topo"><span class="aval-estrelas" aria-label="${a.nota} ${ta('estrelas')}">${estrelasTxt(a.nota)}</span><b>${esc(a.autor_nome)}</b>${a.autor_cidade ? `<small class="meta">${esc(a.autor_cidade)}</small>` : ''}${a.reserva_verificada ? `<span class="pill p-green">${ic('check')} ${ta('Reserva verificada')}</span>` : ''}<small class="meta" style="margin-left:auto">${dataTxt(a.criado_em)}${a.editado_em ? ' · ' + ta('editada') : ''}</small></div>${a.comentario ? `<p>${esc(a.comentario)}</p>` : ''}</article>`).join('') || `<p class="meta">${ta('Ainda não há avaliações. Seja o primeiro a partilhar a sua experiência.')}</p>`}</div>`;
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-avaliar],[data-aval-apagar]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (b.dataset.avaliar) { const [t, id] = b.dataset.avaliar.split(':'); return abrirAvaliacoes(t, +id); }
  const [aid, t, id] = b.dataset.avalApagar.split(':');
  if (b.dataset.confirmar !== '1') { b.dataset.confirmar = '1'; b.classList.add('pn-confirmar'); toast(ta('Toque outra vez para apagar.')); setTimeout(() => { b.dataset.confirmar = ''; b.classList.remove('pn-confirmar'); }, 4000); return; }
  try { await API.del('/api/avaliacoes/' + aid); toast(ta('Avaliação apagada.')); await carregarCatalogo(); render(); abrirAvaliacoes(t, +id); } catch (er) { toast(er.message); }
}, true);
document.addEventListener('submit', async e => {
  const f = e.target; if (!f.matches('[data-avalf]')) return; e.preventDefault();
  const [tipo, id] = f.dataset.avalf.split(':'); const fd = new FormData(f); const err = f.querySelector('.err'); err.hidden = true;
  if (!fd.get('nota')) { err.hidden = false; err.textContent = ta('Escolha de 1 a 5 estrelas.'); return; }
  try { const r = await API.post('/api/avaliacoes', { tipo, item_id: +id, nota: +fd.get('nota'), comentario: fd.get('comentario') }); toast(ta(r.editada ? 'Avaliação actualizada.' : 'Obrigado pela sua avaliação!')); await carregarCatalogo(); render(); abrirAvaliacoes(tipo, +id); }
  catch (er) { err.hidden = false; err.textContent = er.message; }
});
