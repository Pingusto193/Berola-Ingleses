// Intro: aparece uma vez por sessao de navegacao, e pulavel e respeita
// prefers-reduced-motion.

const CHAVE = 'berola_splash_visto';

export function iniciarSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;

  const jaViu = sessionStorage.getItem(CHAVE) === '1';
  const menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const video = splash.querySelector('.splash__video');

  // Quem ja viu nesta sessao, ou pediu menos movimento, vai direto pro site -
  // e o video nem chega a tocar escondido: tira ele da pagina de uma vez.
  if (jaViu || menosMovimento) {
    sessionStorage.setItem(CHAVE, '1');
    video?.remove();
    return;
  }

  splash.hidden = false;
  document.body.style.overflow = 'hidden';

  let encerrado = false;
  function encerrar() {
    if (encerrado) return;
    encerrado = true;
    sessionStorage.setItem(CHAVE, '1');
    splash.classList.add('saindo');
    document.body.style.overflow = '';
    video?.pause(); // para de gastar CPU/rede assim que a saida comeca
    setTimeout(() => {
      splash.hidden = true;
      video?.remove(); // nada de video decodificando escondido atras do site
    }, 850); // bate com a transicao dos paineis no CSS
  }

  const relogio = setTimeout(encerrar, 1800);
  splash.addEventListener('click', () => { clearTimeout(relogio); encerrar(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      clearTimeout(relogio);
      encerrar();
    }
  }, { once: true });
}
