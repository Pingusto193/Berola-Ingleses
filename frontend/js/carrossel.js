// ============================================================================
// Carrossel de destaques do hero.
//
// Regras que moldaram esta implementação:
//
// 1. A BARRA É O CRONÔMETRO. O preenchimento não é uma animação separada que
//    "acompanha" o slide: é ele que decide a hora de virar. Um único
//    requestAnimationFrame escreve a barra e, ao chegar em 100%, troca a
//    imagem. Assim barra e troca não têm como sair de sincronia - nem depois
//    de pausar, nem depois de um clique manual.
//
// 2. Nada aparece sem foto. Um destaque sem imagem não é apresentável no topo
//    do site, então ele é ignorado aqui (o painel avisa o dono). Se nenhum
//    tiver foto, o carrossel simplesmente não monta e o hero fica idêntico ao
//    que era antes.
//
// 3. Só a próxima imagem é pré-carregada. Carregar dez fotos grandes de uma
//    vez no primeiro acesso é justamente o que deixa site de restaurante
//    lento no celular.
// ============================================================================

const DURACAO_SLIDE = 4200;   // ms que cada destaque fica na tela
const TOTAL_KB = 6;           // quantidade de movimentos Ken Burns disponíveis

const esc = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const formatarPreco = (centavos) =>
  (Number(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const semMovimento = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Nomes amigáveis dos selos. Um tipo que não esteja aqui é mostrado como o
// dono escreveu - a lista é uma conveniência, não uma trava.
const SELOS = {
  promocao: 'Promoção',
  novidade: 'Novidade',
  'mais-vendido': 'Mais vendido',
  recomendado: 'Recomendado',
  oferta: 'Oferta',
  destaque: 'Destaque',
};

function legenda(d) {
  const partes = [];

  if (d.tipo) {
    partes.push(`<span class="destaque__selo">${esc(SELOS[d.tipo] || d.tipo)}</span>`);
  }
  if (d.nome) partes.push(`<p class="destaque__nome">${esc(d.nome)}</p>`);
  if (d.descricao) partes.push(`<p class="destaque__desc">${esc(d.descricao)}</p>`);

  // Campo vazio não vira caixa vazia: preço só aparece se existir de fato.
  // Preço antigo sozinho não diz nada, então depende do preço atual - e só
  // entra se for realmente maior (senão não é desconto, é erro de digitação).
  if (d.precoCentavos != null) {
    const antigo =
      d.precoAntigoCentavos != null && d.precoAntigoCentavos > d.precoCentavos
        ? `<span class="destaque__preco-antigo">${esc(formatarPreco(d.precoAntigoCentavos))}</span>`
        : '';
    partes.push(
      `<div class="destaque__precos">${antigo}` +
        `<span class="destaque__preco">${esc(formatarPreco(d.precoCentavos))}</span></div>`
    );
  }
  if (d.textoPromocional) {
    partes.push(`<p class="destaque__promo">${esc(d.textoPromocional)}</p>`);
  }

  if (!partes.length) return '';
  return `<figcaption class="destaque__info">${partes.join('')}</figcaption>`;
}

// Enquanto o dono nao sobe fotos de verdade, os destaques usam esta aqui -
// mesma logica do resto do site (main.js tem a mesma constante). Assim o
// carrossel aparece cheio pra testar, e fica visivel que aquilo e' so
// exemplo, esperando a foto real entrar no lugar.
const IMAGEM_PADRAO = '/Img/bx_2_boulangerie_le_jazz_lais_acsa.jpg';

export function montarCarrosselHero(destaques, hero) {
  const lista = destaques || [];
  if (!lista.length || !hero) return;

  const caixa = document.createElement('div');
  caixa.className = 'hero__destaques';

  const slidesHtml = lista
    .map((d, i) => {
      const temFoto = !!d.imagemUrl;
      const src = d.imagemUrl || IMAGEM_PADRAO;
      return `
      <figure class="destaque destaque--kb${(i % TOTAL_KB) + 1}" data-i="${i}">
        <div class="destaque__foto">
          <img src="${esc(src)}" alt="${esc(d.altText || d.nome || '')}"
               ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} draggable="false">
          ${temFoto ? '' : '<span class="destaque__selo-exemplo">Imagem de exemplo</span>'}
        </div>
        ${legenda(d)}
      </figure>`;
    })
    .join('');

  const barrasHtml = lista
    .map(
      (d, i) => `
      <button class="barra" type="button" role="tab" data-i="${i}"
              aria-label="Destaque ${i + 1}${d.nome ? ': ' + esc(d.nome) : ''}"
              aria-selected="${i === 0}">
        <span class="barra__fill"></span>
      </button>`
    )
    .join('');

  caixa.innerHTML =
    `<div class="destaque-palco">${slidesHtml}</div>` +
    `<div class="destaque-barras" role="tablist" aria-label="Destaques do início">${barrasHtml}</div>`;

  hero.prepend(caixa);
  hero.classList.add('hero--com-destaques');

  const slides = [...caixa.querySelectorAll('.destaque')];
  const barras = [...caixa.querySelectorAll('.barra')];
  const preenchimentos = barras.map((b) => b.querySelector('.barra__fill'));

  let atual = 0;
  let inicio = 0;        // timestamp em que o slide atual começou a contar
  let decorrido = 0;     // ms já cumpridos, preservados enquanto está pausado
  let pausado = false;

  function pintarBarras(fracao) {
    preenchimentos.forEach((f, i) => {
      // slides já passados ficam cheios; os que ainda vêm, vazios
      const v = i < atual ? 1 : i > atual ? 0 : fracao;
      f.style.transform = `scaleX(${v})`;
    });
  }

  function preCarregarProxima() {
    const prox = lista[(atual + 1) % lista.length];
    if (prox) new Image().src = prox.imagemUrl || IMAGEM_PADRAO;
  }

  function mostrar(indice) {
    atual = (indice + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle('ativo', i === atual));
    barras.forEach((b, i) => b.setAttribute('aria-selected', String(i === atual)));

    // Reinicia o Ken Burns do slide que entrou. Sem esse "empurrão", a
    // animação só rodaria na primeira volta do carrossel.
    const img = slides[atual].querySelector('img');
    img.style.animation = 'none';
    void img.offsetWidth; // força o reflow pra animação poder recomeçar
    img.style.animation = '';

    decorrido = 0;
    inicio = performance.now();
    pintarBarras(0);
    preCarregarProxima();
  }

  function passo(agora) {
    if (!pausado) {
      const total = decorrido + (agora - inicio);
      const fracao = Math.min(total / DURACAO_SLIDE, 1);
      pintarBarras(fracao);
      if (fracao >= 1) mostrar(atual + 1);
    }
    requestAnimationFrame(passo);
  }

  function irPara(indice) {
    // mostrar() já zera o cronômetro, que é o que "reiniciar o progresso ao
    // trocar na mão" exige. O que NÃO se pode fazer aqui é despausar: se o
    // usuário clicou numa barra, o mouse dele está em cima do carrossel, e
    // despausar faria o slide voltar a correr embaixo do cursor parado.
    // Quem retoma é o pointerleave, quando o mouse realmente sair.
    mostrar(indice);
  }

  barras.forEach((b) => b.addEventListener('click', () => irPara(Number(b.dataset.i))));

  function pausar() {
    if (pausado) return;
    pausado = true;
    decorrido += performance.now() - inicio;
  }
  function retomar() {
    if (!pausado) return;
    pausado = false;
    inicio = performance.now();
  }

  // Pausa no hover só onde existe cursor de verdade: no celular o "hover"
  // herdado do toque deixaria o carrossel parado depois do primeiro swipe.
  if (window.matchMedia('(hover: hover)').matches) {
    caixa.addEventListener('pointerenter', pausar);
    caixa.addEventListener('pointerleave', retomar);
  }

  // Swipe horizontal no celular
  let toqueX = null;
  let toqueY = null;
  caixa.addEventListener(
    'touchstart',
    (e) => {
      toqueX = e.changedTouches[0].clientX;
      toqueY = e.changedTouches[0].clientY;
    },
    { passive: true }
  );
  caixa.addEventListener(
    'touchend',
    (e) => {
      if (toqueX === null) return;
      const dx = e.changedTouches[0].clientX - toqueX;
      const dy = e.changedTouches[0].clientY - toqueY;
      // Só vale como swipe se for claramente horizontal - senão o gesto era
      // rolagem da página, e o carrossel não pode roubar o scroll.
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        irPara(atual + (dx < 0 ? 1 : -1));
      }
      toqueX = toqueY = null;
    },
    { passive: true }
  );

  // Aba escondida não precisa gastar quadro nenhum animando.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pausar();
    else retomar();
  });

  mostrar(0);

  // Um destaque só não é carrossel: mostra a foto e esconde a barra solitária.
  if (lista.length < 2) {
    caixa.querySelector('.destaque-barras').hidden = true;
    return;
  }

  // Quem pediu menos movimento no sistema fica com o primeiro destaque
  // parado, sem troca automática (a navegação pelas barras continua).
  if (semMovimento()) pintarBarras(1);
  else requestAnimationFrame(passo);
}
