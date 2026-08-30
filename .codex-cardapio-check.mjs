const porta = Number(process.env.CDP_PORT || 9334);
const conteudo = await fetch('http://localhost:3000/api/conteudo').then((resposta) => resposta.json());
const categorias = conteudo.cardapio || [];
const totalProdutos = categorias.reduce((total, categoria) => total + (categoria.produtos || []).length, 0);

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alvo = await fetch(`http://127.0.0.1:${porta}/json/new?about%3Ablank`, { method: 'PUT' })
  .then((resposta) => resposta.json());
const socket = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let proximoId = 1;
const pendentes = new Map();
const eventos = new Map();

socket.addEventListener('message', ({ data }) => {
  const mensagem = JSON.parse(data);
  if (mensagem.id) {
    const pendente = pendentes.get(mensagem.id);
    if (!pendente) return;
    pendentes.delete(mensagem.id);
    if (mensagem.error) pendente.reject(new Error(mensagem.error.message));
    else pendente.resolve(mensagem.result);
    return;
  }
  eventos.get(mensagem.method)?.shift()?.(mensagem.params);
});

function enviar(method, params = {}) {
  const id = proximoId++;
  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

function proximoEvento(nome) {
  return new Promise((resolve) => {
    const fila = eventos.get(nome) || [];
    fila.push(resolve);
    eventos.set(nome, fila);
  });
}

async function avaliar(expression) {
  const resultado = await enviar('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (resultado.exceptionDetails) throw new Error(resultado.exceptionDetails.text);
  return resultado.result.value;
}

async function navegar(url) {
  const carregou = proximoEvento('Page.loadEventFired');
  await enviar('Page.navigate', { url });
  await carregou;
  await esperar(500);
}

async function aguardar(expression, limiteMs = 10000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    if (await avaliar(expression)) return;
    await esperar(100);
  }
  throw new Error(`Tempo esgotado aguardando: ${expression}`);
}

async function definirViewport(largura) {
  await enviar('Emulation.setDeviceMetricsOverride', {
    width: largura,
    height: 900,
    deviceScaleFactor: 1,
    mobile: largura <= 430,
    screenWidth: largura,
    screenHeight: 900,
  });
  await esperar(100);
}

try {
  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await definirViewport(430);
  await navegar('http://localhost:3000/');
  await aguardar(`document.querySelectorAll('#cardapio-filtros button').length === ${categorias.length + 1}`);

  const nomesEsperados = ['Todos', ...categorias.map((categoria) => categoria.nome)];
  const nomesFiltros = await avaliar(`[...document.querySelectorAll('#cardapio-filtros button')].map((botao) => botao.textContent.trim())`);
  const filtrosDinamicos = JSON.stringify(nomesFiltros) === JSON.stringify(nomesEsperados);

  const filtragens = [];
  for (const filtro of [{ id: 'todos', produtos: categorias.flatMap((categoria) => categoria.produtos || []) },
    ...categorias.map((categoria) => ({ id: String(categoria.id), produtos: categoria.produtos || [] }))]) {
    await avaliar(`(() => {
      const secao = document.querySelector('#cardapio');
      window.scrollTo(0, secao.offsetTop);
      const botao = [...document.querySelectorAll('#cardapio-filtros button')]
        .find((item) => item.dataset.categoria === ${JSON.stringify(filtro.id)});
      botao.focus({ preventScroll: true });
      botao.click();
      return true;
    })()`);
    await esperar(230);
    const resultado = await avaliar(`(() => ({
      nomes: [...document.querySelectorAll('#cardapio-lista .prod h4')].map((titulo) => titulo.textContent.trim()),
      ativos: [...document.querySelectorAll('#cardapio-filtros [aria-pressed="true"]')].map((botao) => botao.dataset.categoria),
      foco: document.activeElement?.dataset?.categoria || null,
      scrollY: window.scrollY,
      topoSecao: document.querySelector('#cardapio').offsetTop,
      hash: location.hash,
      animacao: getComputedStyle(document.querySelector('#cardapio-lista .cardapio-grid')).animationDuration
    }))()`);
    const esperados = filtro.produtos.map((produto) => produto.nome);
    filtragens.push({
      id: filtro.id,
      quantidade: resultado.nomes.length,
      esperada: esperados.length,
      produtosCorretos: JSON.stringify(resultado.nomes) === JSON.stringify(esperados),
      unicoAtivo: resultado.ativos.length === 1 && resultado.ativos[0] === filtro.id,
      focoPreservado: resultado.foco === filtro.id,
      semSalto: Math.abs(resultado.scrollY - resultado.topoSecao) <= 1 && resultado.hash === '',
      animacao: resultado.animacao,
    });
  }

  const viewports = [];
  for (const largura of [320, 390, 430, 1024, 1440]) {
    await definirViewport(largura);
    const resultado = await avaliar(`(() => {
      const barra = document.querySelector('#cardapio-filtros');
      const ultimo = barra.lastElementChild;
      const scrollYAntes = window.scrollY;
      barra.scrollLeft = barra.scrollWidth;
      const barraRect = barra.getBoundingClientRect();
      const ultimoRect = ultimo.getBoundingClientRect();
      const css = getComputedStyle(barra);
      window.scrollTo(99999, window.scrollY);
      return {
        viewport: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        paginaScrollX: window.scrollX,
        paginaScrollYInalterado: window.scrollY === scrollYAntes,
        barraClientWidth: barra.clientWidth,
        barraScrollWidth: barra.scrollWidth,
        barraOverflowX: css.overflowX,
        barraFlexWrap: css.flexWrap,
        ultimoVisivel: ultimoRect.right <= barraRect.right + 1 && ultimoRect.left >= barraRect.left - 1,
      };
    })()`);
    viewports.push({ largura, ...resultado });
  }

  const passouFiltragem = filtrosDinamicos && totalProdutos > 0 && filtragens.every((item) =>
    item.quantidade === item.esperada && item.produtosCorretos && item.unicoAtivo &&
    item.focoPreservado && item.semSalto
  );
  const passouViewports = viewports.every((item) =>
    item.documentWidth <= item.viewport + 1 && item.bodyWidth <= item.viewport + 1 &&
    item.paginaScrollX === 0 && item.paginaScrollYInalterado && item.barraClientWidth <= item.viewport &&
    item.barraOverflowX === 'auto' && item.barraFlexWrap === 'nowrap' && item.ultimoVisivel
  );
  const mobileTemScrollLocal = viewports.filter((item) => item.largura <= 430)
    .some((item) => item.barraScrollWidth > item.barraClientWidth);

  const resumo = {
    categorias: categorias.length,
    produtos: totalProdutos,
    filtrosDinamicos,
    filtragens,
    viewports,
    mobileTemScrollLocal,
    passou: passouFiltragem && passouViewports && mobileTemScrollLocal,
  };
  console.log(JSON.stringify(resumo, null, 2));
  if (!resumo.passou) process.exitCode = 1;
} finally {
  try { await enviar('Browser.close'); } catch {}
  socket.close();
}
