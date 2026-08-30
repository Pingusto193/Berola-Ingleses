import { carregarConteudo } from './api.js';
import { iniciarSplash } from './splash.js';
import { saindoComCirculo } from './transicao.js';
import { montarCarrosselHero } from './carrossel.js';

iniciarSplash();

// Easter egg: o botao escondido abre o painel com uma transicao de circulo
// que cresce a partir do ponto clicado, cobrindo a tela antes de navegar.
document.getElementById('admin-portal')?.addEventListener('click', (e) => {
  e.preventDefault();
  saindoComCirculo({ x: e.clientX, y: e.clientY }, '/admin');
});
document.getElementById('ano').textContent = new Date().getFullYear();

// --------------------------------------------------------------- Menu mobile
const menuBtn = document.getElementById('menu-btn');
const nav = document.getElementById('nav');
menuBtn.addEventListener('click', () => {
  const aberto = nav.classList.toggle('aberto');
  menuBtn.setAttribute('aria-expanded', String(aberto));
});
nav.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    nav.classList.remove('aberto');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
});

// --------------------------------------------------------------- Utilidades

const esc = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

// Enquanto o dono nao sobe as fotos de verdade, todo espaco de imagem mostra
// esta aqui - assim da pra ver o site "cheio" pra testar, e fica claro pra
// quem esta olhando que ali e onde a foto de cada coisa vai entrar. O selo
// "imagem de exemplo" e so pra nao deixar ninguem achar que e a foto final.
const IMAGEM_PADRAO = '/Img/bx_2_boulangerie_le_jazz_lais_acsa.jpg';

// O coracao da fase sem fotos: se nao ha imagem no banco, usa a imagem
// padrao, no MESMO aspect-ratio que a foto real vai ter. Por isso a troca
// depois nao desloca nada no layout.
function midia(url, alt, ratio, rotulo, classe = '', lazy = true) {
  const cls = [classe, ratio].filter(Boolean).join(' ');
  if (url) {
    return `<img class="foto ${cls}" src="${esc(url)}" alt="${esc(alt)}"${
      lazy ? ' loading="lazy"' : ''
    }>`;
  }
  return `<div class="foto-exemplo ${cls}">
      <img class="foto" src="${IMAGEM_PADRAO}" alt="${esc(rotulo)} (imagem de exemplo, ainda não é a foto real)"${
    lazy ? ' loading="lazy"' : ''
  }>
      <span class="foto-exemplo__selo">Imagem de exemplo</span>
    </div>`;
}

// ------------------------------------------------------------------ Secoes

function montarHero(hero) {
  document.getElementById('hero-headline').textContent = hero.headline;
  document.getElementById('hero-subtitulo').textContent = hero.subtitulo;
  // O hero não tem vídeo/imagem de fundo próprios - esse vídeo agora só
  // aparece na intro (splash.js). Quem preenche visualmente o hero são os
  // destaques (montarCarrosselHero); sem nenhum cadastrado, o gradiente da
  // marca do CSS já cobre o espaço.
}

function montarVisite(visite) {
  document.getElementById('visite-titulo').textContent = visite.titulo;
  document.getElementById('visite-texto').textContent = visite.texto;
  // Sem botao aqui de proposito: "Fale com a gente" (rodape) ja tem a
  // localizacao - um segundo botao "Como Chegar" levando pro mesmo lugar
  // era redundante.

  document.getElementById('visite-fotos').innerHTML = visite.imagens
    .map((img, i) =>
      midia(
        img.imagemUrl,
        img.altText,
        i === 0 ? 'ratio-16-9' : 'ratio-1-1',
        img.altText || 'Foto do local'
      )
    )
    .join('');
}

// Os icones que existem no <svg> de simbolos do index.html. Como o admin pode
// criar um tipo novo, o que nao tiver icone cai num generico em vez de
// renderizar um <use> quebrado.
const ICONES_CONTATO = [
  'whatsapp', 'instagram', 'telefone', 'endereco', 'horario', 'ifood',
  'email', 'facebook', 'tiktok',
];

function montarContato(itens) {
  // A API ja devolve so os contatos ativos - o dado dos inativos fica no banco
  document.getElementById('contato-lista').innerHTML = itens
    .map((c) => {
      const icone = ICONES_CONTATO.includes(c.tipo) ? c.tipo : 'endereco';
      const conteudo = c.link
        ? `<a href="${esc(c.link)}"${
            c.link.startsWith('http') ? ' target="_blank" rel="noopener"' : ''
          }>${esc(c.valor)}</a>`
        : `<span>${esc(c.valor)}</span>`;
      return `
      <div class="contato-item">
        <div class="contato-item__icone">
          <svg aria-hidden="true"><use href="#i-${esc(icone)}"></use></svg>
        </div>
        <div>
          <div class="contato-item__rotulo">${esc(c.rotulo)}</div>
          ${conteudo}
        </div>
      </div>`;
    })
    .join('');
}

// ---------------------------------------------------------------- Cardapio

const formatarPreco = (centavos) =>
  (Number(centavos || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

// Produto indisponivel continua aparecendo, mas marcado como esgotado -
// e o comportamento que faz o dono nao precisar apagar o produto quando acaba.
function cartaoProduto(p) {
  const botao = p.link
    ? `<a class="btn btn--primario" href="${esc(p.link)}" target="_blank" rel="noopener">Pedir</a>`
    : '';
  return `
    <article class="prod${p.disponivel ? '' : ' prod--esgotado'}">
      ${midia(p.imagemUrl, p.altText, 'ratio-4-3', 'Foto do produto', 'prod__foto')}
      <div class="prod__corpo">
        <h4>${esc(p.nome)}</h4>
        ${p.descricao ? `<p>${esc(p.descricao)}</p>` : ''}
        <div class="prod__rodape">
          <span class="prod__preco">${esc(formatarPreco(p.precoCentavos))}</span>
          ${p.disponivel ? botao : '<span class="prod__esgotado">Esgotado hoje</span>'}
        </div>
      </div>
    </article>`;
}

function montarCardapio(categorias) {
  const alvo = document.getElementById('cardapio-lista');
  const filtros = document.getElementById('cardapio-filtros');
  const status = document.getElementById('cardapio-status');
  const lista = categorias || [];

  if (!lista.length) {
    filtros.hidden = true;
    status.textContent = '';
    alvo.innerHTML = '<p class="cardapio-vazio">Cardápio em breve.</p>';
    return;
  }

  filtros.hidden = false;
  filtros.innerHTML = `
    <button class="cardapio-filtro" type="button" data-categoria="todos" aria-pressed="true" aria-controls="cardapio-lista">
      Todos
    </button>
    ${lista.map((categoria) => `
      <button class="cardapio-filtro" type="button" data-categoria="${esc(categoria.id)}" aria-pressed="false" aria-controls="cardapio-lista">
        ${esc(categoria.nome)}
      </button>`).join('')}`;

  function mostrarCategoria(id) {
    const categoria = id === 'todos'
      ? null
      : lista.find((item) => String(item.id) === id);
    if (id !== 'todos' && !categoria) return;

    const produtos = categoria
      ? categoria.produtos || []
      : lista.flatMap((item) => item.produtos || []);

    filtros.querySelectorAll('[data-categoria]').forEach((botao) => {
      const selecionado = botao.dataset.categoria === id;
      botao.classList.toggle('ativo', selecionado);
      botao.setAttribute('aria-pressed', String(selecionado));
    });

    const apresentacao = categoria
      ? `<div class="cardapio-categoria">
          <h3>${esc(categoria.nome)}</h3>
          ${categoria.descricao ? `<p>${esc(categoria.descricao)}</p>` : ''}
        </div>`
      : '';

    if (!produtos.length) {
      alvo.innerHTML = `${apresentacao}<p class="cardapio-vazio">Nenhum produto disponível nesta categoria.</p>`;
    } else {
      alvo.innerHTML = `${apresentacao}
        <div class="cardapio-grid">
          ${produtos.map(cartaoProduto).join('')}
        </div>`;
    }

    const quantidade = produtos.length === 1 ? '1 produto exibido' : `${produtos.length} produtos exibidos`;
    status.textContent = categoria ? `${quantidade} em ${categoria.nome}.` : `${quantidade} no cardápio.`;
  }

  filtros.onclick = (evento) => {
    const botao = evento.target.closest('[data-categoria]');
    if (!botao) return;

    mostrarCategoria(botao.dataset.categoria);

    const esquerda = botao.offsetLeft - (filtros.clientWidth - botao.offsetWidth) / 2;
    const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    filtros.scrollTo({
      left: Math.max(0, esquerda),
      behavior: movimentoReduzido ? 'auto' : 'smooth',
    });
  };

  mostrarCategoria('todos');
}

// -------------------------------------------------------------------- Boot

try {
  const dados = await carregarConteudo();

  if (dados.config) {
    const cta = document.getElementById('cta-header');
    cta.textContent = dados.config.ctaHeaderTexto;
    cta.href = dados.config.ctaHeaderLink;

    document.getElementById('destaques-titulo').textContent = dados.config.tituloDestaques;
    document.getElementById('destaques-subtitulo').textContent = dados.config.subtituloDestaques;
    document.getElementById('cardapio-titulo').textContent = dados.config.tituloCardapio;
    document.getElementById('cardapio-subtitulo').textContent = dados.config.subtituloCardapio;
  }
  if (dados.hero) montarHero(dados.hero);
  // Entra depois do hero pra herdar o fundo/vídeo já montado atrás dele
  montarCarrosselHero(dados.heroImagens || [], document.getElementById('inicio'));
  montarCardapio(dados.cardapio || []);
  if (dados.visite) montarVisite(dados.visite);
  montarContato(dados.contato || []);
} catch (e) {
  console.error('Não consegui carregar o conteúdo do site:', e);
  document.getElementById('hero-subtitulo').textContent =
    'Não consegui carregar o conteúdo. Confira se o banco está rodando e se o seed foi executado.';
} finally {
  // Layout do hero decidido: pode mostrar o texto. No finally de propósito -
  // mesmo se a API cair, a mensagem de erro precisa ficar visível.
  document.getElementById('inicio').classList.remove('hero--carregando');
}
