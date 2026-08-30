// ============================================================================
// Reordenar arrastando - funciona com mouse e com o dedo (Pointer Events
// cobre os dois ao mesmo tempo, sem precisar de biblioteca externa).
//
// Cada item da lista precisa de [data-arraste-item] com um data-id, e uma
// "alcinha" dentro dele marcada com [data-arraste-alca]. So a alcinha inicia
// o arraste - o resto do item continua clicavel normalmente (editar, etc.).
//
// IMPORTANTE: tornarReordenavel(container, callback) e chamada de novo toda
// vez que a lista e re-renderizada (o `container` e sempre o mesmo elemento,
// so o innerHTML muda). Por isso os listeners de pointer sao instalados UMA
// UNICA VEZ por container (controlado por container.__arrasteInstalado) - so
// o callback e atualizado a cada chamada. Sem isso, cada re-renderizacao
// empilhava mais um conjunto de listeners no mesmo elemento, e varias
// instancias concorrentes do arraste passavam a brigar pelo mesmo evento,
// cada uma reordenando o DOM do seu jeito - e' isso que fazia o item "pular"
// pra um lugar errado (geralmente o fim da lista).
// ============================================================================

const DURACAO_PEGAR = 140;
const DURACAO_SOLTAR = 220;
// Leve overshoot ("estica e assenta") - mesma curva usada no CSS pro deslize
// dos vizinhos (.lista--arrastando .item), pra tudo se mover com a mesma cara.
const CURVA_MOLA = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export function tornarReordenavel(container, aoSoltar) {
  // Sempre aponta pro callback mais recente (ele muda a cada re-renderizacao,
  // porque fecha sobre o array `itens` daquela renderizacao especifica).
  container.__aoSoltarArraste = aoSoltar;
  if (container.__arrasteInstalado) return;
  container.__arrasteInstalado = true;

  let item = null;
  let inicioY = 0;
  let deslocamento = 0;

  function aplicarTransform() {
    item.style.transform = `translateY(${deslocamento}px) scale(1.035)`;
  }

  // FLIP de um vizinho deslocado: aplica o deslocamento invertido sem
  // transicao, forca o navegador a "commitar" isso com um reflow, e solta a
  // transicao (herdada da classe .lista--arrastando) pra ele deslizar suave
  // ate a posicao final. E o mesmo truque de toda lib de lista arrastavel.
  function flip(vizinho, deltaPx) {
    vizinho.style.transition = 'none';
    vizinho.style.transform = `translateY(${deltaPx}px)`;
    vizinho.getBoundingClientRect(); // forca o reflow antes de soltar a transicao
    vizinho.style.transition = '';
    vizinho.style.transform = '';
  }

  container.addEventListener('pointerdown', (e) => {
    const alca = e.target.closest('[data-arraste-alca]');
    if (!alca) return;
    const alvo = alca.closest('[data-arraste-item]');
    if (!alvo) return;

    e.preventDefault();
    item = alvo;
    inicioY = e.clientY;
    deslocamento = 0;
    item.setPointerCapture(e.pointerId);
    container.classList.add('lista--arrastando');
    document.body.classList.add('arraste-ativo');

    // "Pega" o item: um pop rapido de escala + sombra, com transicao. Isso
    // fica animando livremente ate o PRIMEIRO movimento de verdade - se o
    // usuario arrasta rapido (comum em arrastes de uma posicao so), o pop
    // e' cortado no meio, o que e' imperceptivel. O que NAO pode acontecer e'
    // usar um temporizador fixo pra desligar a transicao: se o movimento
    // comecasse antes do temporizador disparar, a transicao ainda ativa
    // suavizava (atrasava) as primeiras atualizacoes de posicao, fazendo o
    // item ficar pra tras do ponteiro logo no inicio de arrastes curtos.
    item.classList.add('arrastando');
    item.style.transition = `transform ${DURACAO_PEGAR}ms ${CURVA_MOLA}, box-shadow ${DURACAO_PEGAR}ms ease`;
    item.style.transform = 'scale(1.035)';
    item.style.boxShadow = 'var(--sombra-alta)';
  });

  container.addEventListener('pointermove', (e) => {
    if (!item) return;
    // A partir do primeiro movimento, o item precisa seguir o ponteiro 1:1 -
    // nenhuma transicao pode suavizar/atrasar essa atualizacao.
    if (item.style.transition !== 'none') item.style.transition = 'none';
    deslocamento = e.clientY - inicioY;
    aplicarTransform();

    // Continua verificando vizinhos (nao so um) - um arraste rapido pode
    // atravessar varias posicoes num unico evento de movimento, e o item
    // precisa terminar exatamente onde o ponteiro esta, nao ficar pra tras.
    let continuarVerificando = true;
    while (continuarVerificando) {
      continuarVerificando = false;

      const retAtual = item.getBoundingClientRect();
      const centroAtual = retAtual.top + retAtual.height / 2;
      const alturaItem = retAtual.height;
      const todos = [...container.children];
      const indice = todos.indexOf(item);

      if (deslocamento > 0) {
        const proximo = todos[indice + 1];
        if (proximo) {
          const r = proximo.getBoundingClientRect();
          if (centroAtual > r.top + r.height / 2) {
            container.insertBefore(proximo, item);
            // o vizinho subiu exatamente a altura do item arrastado
            flip(proximo, -alturaItem);
            inicioY += r.height;
            deslocamento -= r.height;
            aplicarTransform();
            continuarVerificando = true;
          }
        }
      } else if (deslocamento < 0) {
        const anterior = todos[indice - 1];
        if (anterior) {
          const r = anterior.getBoundingClientRect();
          if (centroAtual < r.top + r.height / 2) {
            container.insertBefore(item, anterior);
            // o vizinho desceu exatamente a altura do item arrastado
            flip(anterior, alturaItem);
            inicioY -= r.height;
            deslocamento += r.height;
            aplicarTransform();
            continuarVerificando = true;
          }
        }
      }
    }
  });

  function soltar(e) {
    if (!item) return;
    const alvo = item;
    item = null;

    try { alvo.releasePointerCapture(e.pointerId); } catch { /* ja liberado */ }

    // "Encaixa": anima de volta pro tamanho normal, na posicao final (0,0) -
    // que ja e' a posicao correta, porque o DOM foi reordenado durante o
    // arraste. A curva com leve overshoot da' a sensacao de mola/encaixe.
    alvo.style.transition = `transform ${DURACAO_SOLTAR}ms ${CURVA_MOLA}, box-shadow ${DURACAO_SOLTAR}ms ease`;
    alvo.style.transform = '';
    alvo.style.boxShadow = '';

    const finalizar = () => {
      alvo.classList.remove('arrastando');
      alvo.style.transition = '';
      container.classList.remove('lista--arrastando');
      document.body.classList.remove('arraste-ativo');
    };
    alvo.addEventListener('transitionend', finalizar, { once: true });
    setTimeout(finalizar, DURACAO_SOLTAR + 60); // salvaguarda caso transitionend nao dispare

    const ids = [...container.children].map((el) => el.dataset.id).filter(Boolean);
    container.__aoSoltarArraste?.(ids);
  }

  container.addEventListener('pointerup', soltar);
  container.addEventListener('pointercancel', soltar);
}

// Marcacao HTML da alcinha, reaproveitada em toda lista arrastavel do painel.
export const ALCA_HTML = `
  <button type="button" class="alca" data-arraste-alca aria-label="Arrastar para reordenar" title="Arrastar para reordenar">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
      <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
      <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
    </svg>
  </button>`;
