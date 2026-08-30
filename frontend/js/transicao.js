// ============================================================================
// Transicao de circulo entre paginas.
//
// O site nao e uma SPA - cada tela (site publico, login, painel) e uma
// pagina HTML separada, navegacao de verdade. Pra dar a sensacao de uma
// transicao continua mesmo assim: a pagina de ORIGEM fecha com um circulo
// que cresce a partir do ponto clicado ate cobrir a tela inteira, e SO
// DEPOIS navega; a pagina de DESTINO ja carrega coberta por esse mesmo
// circulo, que entao encolhe e revela o conteudo por baixo.
// ============================================================================

const DURACAO = 550;
const CURVA = 'cubic-bezier(0.65, 0, 0.35, 1)';
const COR = '#1E3A8A'; // --marinho

const semMovimento = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function raioParaCobrirTela(x, y) {
  // distancia ate o canto mais longe - garante que o circulo cobre a tela
  // inteira, nao so o meio
  const dx = Math.max(x, window.innerWidth - x);
  const dy = Math.max(y, window.innerHeight - y);
  return Math.hypot(dx, dy);
}

// A pagina de destino ja pode trazer essa div pronta no HTML (evita o
// "flash" do conteudo real aparecendo um instante antes do circulo cobrir).
// Se nao existir, cria uma na hora - usado no lado de quem esta SAINDO.
function pegarOuCriarCobertura() {
  let el = document.getElementById('cobertura-circulo');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'cobertura-circulo';
  document.body.prepend(el);
  return el;
}

function estilizar(el) {
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2000',
    background: COR,
    pointerEvents: 'none',
  });
}

// Chama no clique de um link/botao que vai navegar pra outra pagina. Segura
// a navegacao, expande um circulo a partir do ponto clicado (ou do centro do
// elemento, se vier de um botao de formulario) ate cobrir a tela, e so
// entao segue pro destino.
export function saindoComCirculo(origemXY, destino) {
  if (semMovimento()) {
    window.location.href = destino;
    return;
  }

  const { x, y } = origemXY;
  const raio = raioParaCobrirTela(x, y);

  const circulo = pegarOuCriarCobertura();
  estilizar(circulo);
  circulo.style.clipPath = `circle(0px at ${x}px ${y}px)`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      circulo.style.transition = `clip-path ${DURACAO}ms ${CURVA}`;
      circulo.style.clipPath = `circle(${raio}px at ${x}px ${y}px)`;
    });
  });

  setTimeout(() => { window.location.href = destino; }, DURACAO);
}

// Chama assim que uma pagina "recebida" de outra pelo saindoComCirculo()
// termina de carregar: ela comeca coberta pelo circulo (a div
// #cobertura-circulo, se existir no HTML, ja cobre tudo por padrao) e o
// circulo encolhe a partir do centro da tela, revelando o conteudo.
export function chegandoComCirculo() {
  const el = document.getElementById('cobertura-circulo');
  if (!el) return;

  if (semMovimento()) {
    el.remove();
    return;
  }

  const x = window.innerWidth / 2;
  const y = window.innerHeight / 2;
  const raio = raioParaCobrirTela(x, y);

  estilizar(el);
  el.style.clipPath = `circle(${raio}px at ${x}px ${y}px)`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = `clip-path ${DURACAO}ms ${CURVA}`;
      el.style.clipPath = `circle(0px at ${x}px ${y}px)`;
    });
  });

  setTimeout(() => el.remove(), DURACAO + 80);
}
