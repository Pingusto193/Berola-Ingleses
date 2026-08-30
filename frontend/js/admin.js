// Esta pagina (/admin/painel) so existe para quem tem sessao. Sem sessao,
// manda de volta pra pagina de login de verdade - nunca mostra o painel
// vazio nem alterna div escondida na mesma URL.
import * as api from './api.js';
import { tornarReordenavel, ALCA_HTML } from './dragorder.js';
import { chegandoComCirculo } from './transicao.js';

const $ = (id) => document.getElementById(id);
const telaPainel = $('tela-painel');

function mandarParaLogin() {
  window.location.href = '/admin';
}

// Cache do que ja foi carregado, para os selects e a tela de produtos
const estado = { categorias: [], produtos: [], conteudo: null };

// =========================================================== Utilidades ====

const esc = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

let relogioToast;
function toast(msg, erro = false) {
  const el = $('toast');
  el.textContent = msg;
  el.style.background = erro ? '#b91c1c' : 'var(--marinho)';
  el.hidden = false;
  el.classList.remove('escondendo');
  clearTimeout(relogioToast);
  relogioToast = setTimeout(() => {
    el.classList.add('escondendo');
    setTimeout(() => { el.hidden = true; }, 250);
  }, 3000);
}

// Envolve a acao: botao vira "Salvando...", nao aceita clique duplo,
// e o erro do backend aparece como toast em vez de sumir no console.
async function comBotao(botao, acao, msgOk, rotulo = 'Salvando…') {
  const original = botao.textContent;
  botao.disabled = true;
  botao.textContent = rotulo;
  try {
    const r = await acao();
    if (msgOk) toast(msgOk);
    return r;
  } catch (e) {
    if (e.status === 401) {
      toast('Sessão expirada. Entre de novo.', true);
      mandarParaLogin();
      return;
    }
    toast(e.message || 'Não consegui salvar', true);
    throw e;
  } finally {
    botao.disabled = false;
    botao.textContent = original;
  }
}

function vazio(mensagem, textoBotao, acaoBotao) {
  const btn = textoBotao
    ? `<button class="btn-a btn-a--primario" data-novo="${acaoBotao}" type="button">${esc(textoBotao)}</button>`
    : '';
  return `<div class="vazio"><p>${esc(mensagem)}</p>${btn}</div>`;
}

function preencher(prefixo, obj, campos) {
  for (const campo of campos) {
    const el = $(prefixo + '-' + campo);
    if (el) el.value = obj?.[campo] ?? '';
  }
}
function coletar(prefixo, campos) {
  const saida = {};
  for (const campo of campos) {
    const el = $(prefixo + '-' + campo);
    if (el) saida[campo] = el.value;
  }
  return saida;
}

function pintarPreview(el, url, rotulo) {
  if (url) {
    el.classList.add('tem-foto');
    el.innerHTML = /\.(mp4|webm)$/i.test(url)
      ? `<video src="${esc(url)}" muted></video>`
      : `<img src="${esc(url)}" alt="">`;
  } else {
    el.classList.remove('tem-foto');
    el.textContent = rotulo;
  }
}

// Liga o arraste numa lista e persiste a nova ordem no backend.
// `itens` e o array em memoria (pra saber a ordem atual sem reconsultar);
// `aoSalvarUm(id, ordem)` e a chamada de API que grava cada item movido.
// `recarregar` e a funcao que busca a lista de novo do servidor - so e usada
// se o salvamento falhar, pra tela nunca ficar mostrando uma ordem que na
// verdade nao foi gravada (o usuario e avisado E a tela volta a bater com o
// banco, em vez de continuar mudando "silenciosamente").
function ligarReordenacao(container, itens, aoSalvarUm, recarregar) {
  if (!container || !itens.length) return;
  tornarReordenavel(container, async (idsNaOrdemNova) => {
    const mudancas = idsNaOrdemNova
      .map((idTexto, indice) => ({ id: Number(idTexto), ordem: indice + 1 }))
      .filter(({ id, ordem }) => itens.find((it) => it.id === id)?.ordem !== ordem);

    if (!mudancas.length) return;
    try {
      await Promise.all(mudancas.map(({ id, ordem }) => aoSalvarUm(id, ordem)));
      for (const { id, ordem } of mudancas) {
        const item = itens.find((it) => it.id === id);
        if (item) item.ordem = ordem;
      }
      toast('Ordem salva.');
    } catch (e) {
      toast(e.message || 'Não consegui salvar a nova ordem. Restaurando…', true);
      await recarregar?.();
    }
  });
}

// ================================================================ Modal ====

let aoConfirmarModal = null;

function abrirModal(titulo, html, aoConfirmar, textoConfirmar = 'Salvar') {
  $('modal-titulo').textContent = titulo;
  $('modal-corpo').innerHTML = html;
  $('modal-confirmar').textContent = textoConfirmar;
  aoConfirmarModal = aoConfirmar;
  $('modal').hidden = false;
  $('modal-corpo').querySelector('input, select, textarea')?.focus();
}

function fecharModal() {
  $('modal').hidden = true;
  aoConfirmarModal = null;
}

$('modal-cancelar').addEventListener('click', fecharModal);
$('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') fecharModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('modal').hidden) fecharModal();
});

$('modal-confirmar').addEventListener('click', async (e) => {
  if (!aoConfirmarModal) return;
  try {
    await comBotao(e.target, aoConfirmarModal, null);
    fecharModal();
  } catch {
    /* erro ja virou toast; modal fica aberto pro usuario corrigir */
  }
});

// Confirmacao antes de excluir - evita exclusao acidental
function confirmar(titulo, mensagem, aoConfirmar) {
  abrirModal(titulo, `<p>${esc(mensagem)}</p>`, aoConfirmar, 'Excluir');
  $('modal-confirmar').classList.remove('btn-a--primario');
  $('modal-confirmar').classList.add('btn-a--perigo');
}

function restaurarBotaoModal() {
  $('modal-confirmar').classList.add('btn-a--primario');
  $('modal-confirmar').classList.remove('btn-a--perigo');
}

$('btn-sair').addEventListener('click', async () => {
  try { await api.logout(); } catch { /* desloga localmente de qualquer forma */ }
  mandarParaLogin();
});

// ============================================================ Navegacao ====

let secaoAtual = 'categorias';

async function irPara(secao) {
  secaoAtual = secao;
  document.querySelectorAll('.menu__item').forEach((b) =>
    b.classList.toggle('ativo', b.dataset.secao === secao)
  );
  document.querySelectorAll('.secao-admin').forEach((s) => {
    s.hidden = s.dataset.secao !== secao;
  });
  await carregarSecao(secao);
}

$('menu').addEventListener('click', (e) => {
  const botao = e.target.closest('.menu__item');
  if (botao) irPara(botao.dataset.secao);
});

const CARREGADORES = {
  categorias: carregarCategorias,
  produtos: carregarProdutos,
  'hero-imagens': carregarHeroImagens,
  restaurante: carregarRestaurante,
  contatos: carregarContatos,
  horarios: carregarHorarios,
  site: carregarSite,
};

async function carregarSecao(secao) {
  try {
    await CARREGADORES[secao]?.();
  } catch (e) {
    if (e.status === 401) return mandarParaLogin();
    toast(e.message || 'Erro ao carregar', true);
  }
}

async function abrirPainel() {
  telaPainel.hidden = false;
  await irPara('categorias');
}

// =========================================================== Categorias ====

async function carregarCategorias() {
  const alvo = $('lista-categorias');
  alvo.innerHTML = '<div class="carregando">Carregando…</div>';
  estado.categorias = await api.listarCategorias();

  if (!estado.categorias.length) {
    alvo.innerHTML = vazio('Nenhuma categoria cadastrada.', '+ Adicionar categoria', 'categoria');
    return;
  }

  alvo.innerHTML = estado.categorias
    .map(
      (c) => `
    <div class="item ${c.ativo ? '' : 'item--inativo'}" data-arraste-item data-id="${c.id}">
      <div class="item__linha">
        ${ALCA_HTML}
        <div class="item__topo">
          <div>
            <div class="item__nome">${esc(c.nome)}</div>
            <div class="item__meta">
              ${c._count.produtos} produto(s)
              ${c.ativo ? '' : ' · <strong>inativa</strong>'}
            </div>
          </div>
          <div class="item__acoes">
            <button class="btn-a btn-a--fantasma" data-acao="editar" type="button">Editar</button>
            <button class="btn-a btn-a--fantasma" data-acao="alternar" type="button">
              ${c.ativo ? 'Desativar' : 'Ativar'}
            </button>
            <button class="btn-a btn-a--perigo" data-acao="excluir" type="button">Excluir</button>
          </div>
        </div>
      </div>
    </div>`
    )
    .join('');

  alvo.querySelectorAll('.item').forEach((item) => {
    const c = estado.categorias.find((x) => x.id === Number(item.dataset.id));
    item.querySelector('[data-acao="editar"]').onclick = () => formCategoria(c);
    item.querySelector('[data-acao="alternar"]').onclick = (e) =>
      comBotao(
        e.target,
        async () => {
          await api.salvarCategoria(c.id, { ativo: !c.ativo });
          await carregarCategorias();
        },
        c.ativo ? 'Categoria desativada' : 'Categoria ativada'
      );
    item.querySelector('[data-acao="excluir"]').onclick = () =>
      confirmar('Excluir categoria', `Tem certeza que deseja excluir "${c.nome}"?`, async () => {
        await api.excluirCategoria(c.id);
        toast('Categoria excluída');
        restaurarBotaoModal();
        await carregarCategorias();
      });
  });

  ligarReordenacao(alvo, estado.categorias, (id, ordem) => api.salvarCategoria(id, { ordem }), carregarCategorias);
}

function formCategoria(c = null) {
  restaurarBotaoModal();
  abrirModal(
    c ? 'Editar categoria' : 'Nova categoria',
    `
    <div class="campo">
      <label for="f-cat-nome">Nome *</label>
      <input type="text" id="f-cat-nome" value="${esc(c?.nome ?? '')}">
    </div>
    <div class="campo">
      <label for="f-cat-descricao">Descrição</label>
      <textarea id="f-cat-descricao">${esc(c?.descricao ?? '')}</textarea>
    </div>
    <label class="toggle">
      <input type="checkbox" id="f-cat-ativo" ${c?.ativo !== false ? 'checked' : ''}>
      Categoria ativa
    </label>`,
    async () => {
      const dados = {
        nome: $('f-cat-nome').value,
        descricao: $('f-cat-descricao').value,
        ativo: $('f-cat-ativo').checked,
      };
      if (c) await api.salvarCategoria(c.id, dados);
      else await api.criarCategoria(dados);
      toast(c ? 'Categoria atualizada' : 'Categoria criada');
      await carregarCategorias();
    }
  );
}

// ============================================================= Produtos ====

async function carregarProdutos() {
  const alvo = $('lista-produtos');
  alvo.innerHTML = '<div class="carregando">Carregando…</div>';

  [estado.produtos, estado.categorias] = await Promise.all([
    api.listarProdutos(),
    api.listarCategorias(),
  ]);

  // Select de filtro
  const filtro = $('filtro-categoria');
  const selecionado = filtro.value;
  filtro.innerHTML =
    '<option value="">Todas</option>' +
    estado.categorias.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  filtro.value = selecionado;

  if (!estado.categorias.length) {
    alvo.innerHTML = vazio(
      'Crie uma categoria antes de cadastrar produtos.',
      '+ Adicionar categoria',
      'categoria'
    );
    return;
  }

  const lista = filtro.value
    ? estado.produtos.filter((p) => p.categoriaId === Number(filtro.value))
    : estado.produtos;

  if (!lista.length) {
    alvo.innerHTML = vazio('Nenhum produto cadastrado.', '+ Adicionar primeiro produto', 'produto');
    return;
  }

  alvo.innerHTML = lista
    .map((p) => {
      const mini = p.imagemUrl
        ? `<div class="produto__mini tem-foto"><img src="${esc(p.imagemUrl)}" alt=""></div>`
        : '<div class="produto__mini">sem foto</div>';
      const tags = [
        p.ativo ? '' : '<span class="tag tag--off">inativo</span>',
        p.disponivel
          ? '<span class="tag tag--ok">disponível</span>'
          : '<span class="tag tag--alerta">indisponível</span>',
        p.destaque ? '<span class="tag tag--destaque">destaque</span>' : '',
      ].join('');
      return `
      <div class="item ${p.ativo ? '' : 'item--inativo'}" data-arraste-item data-id="${p.id}">
        <div class="item__linha">
          ${ALCA_HTML}
          <div class="produto">
            ${mini}
            <div class="produto__dados">
              <div class="item__nome">${esc(p.nome)}</div>
              <div class="item__meta">${esc(p.categoria?.nome ?? '—')}</div>
              <div class="produto__preco">${esc(api.formatarPreco(p.precoCentavos))}</div>
              <div class="tags">${tags}</div>
            </div>
            <div class="item__acoes">
              <button class="btn-a btn-a--fantasma" data-acao="editar" type="button">Editar</button>
              <button class="btn-a btn-a--fantasma" data-acao="disp" type="button">
                ${p.disponivel ? 'Marcar esgotado' : 'Marcar disponível'}
              </button>
              <button class="btn-a btn-a--fantasma" data-acao="alternar" type="button">
                ${p.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button class="btn-a btn-a--perigo" data-acao="excluir" type="button">Excluir</button>
            </div>
          </div>
        </div>
      </div>`;
    })
    .join('');

  alvo.querySelectorAll('.item').forEach((item) => {
    const p = estado.produtos.find((x) => x.id === Number(item.dataset.id));
    item.querySelector('[data-acao="editar"]').onclick = () => formProduto(p);
    item.querySelector('[data-acao="disp"]').onclick = (e) =>
      comBotao(
        e.target,
        async () => {
          await api.salvarProduto(p.id, { disponivel: !p.disponivel });
          await carregarProdutos();
        },
        p.disponivel ? 'Marcado como esgotado' : 'Marcado como disponível'
      );
    item.querySelector('[data-acao="alternar"]').onclick = (e) =>
      comBotao(
        e.target,
        async () => {
          await api.salvarProduto(p.id, { ativo: !p.ativo });
          await carregarProdutos();
        },
        p.ativo ? 'Produto desativado' : 'Produto ativado'
      );
    item.querySelector('[data-acao="excluir"]').onclick = () =>
      confirmar('Excluir produto', `Tem certeza que deseja excluir "${p.nome}"?`, async () => {
        await api.excluirProduto(p.id);
        toast('Produto excluído');
        restaurarBotaoModal();
        await carregarProdutos();
      });
  });

  // A ordem so faz sentido dentro do recorte visivel (Todas ou uma categoria):
  // reindexar so os itens na tela preserva a posicao relativa em cada categoria.
  ligarReordenacao(alvo, lista, (id, ordem) => api.salvarProduto(id, { ordem }), carregarProdutos);
}

$('filtro-categoria').addEventListener('change', () => carregarProdutos());

function formProduto(p = null) {
  restaurarBotaoModal();
  // URL da imagem recem-enviada; so entra no PUT/POST se o usuario trocou a foto
  let imagemPendente;
  const opcoes = estado.categorias
    .map(
      (c) =>
        `<option value="${c.id}" ${p?.categoriaId === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`
    )
    .join('');

  abrirModal(
    p ? 'Editar produto' : 'Novo produto',
    `
    <div class="midia">
      <div class="midia__preview" id="f-prod-prev">Foto do produto</div>
      <div class="midia__controles">
        <div class="campo">
          <label for="f-prod-arquivo">Foto do produto</label>
          <input type="file" id="f-prod-arquivo" accept="image/*">
          <div class="campo__dica">Escolha uma foto do celular ou tire uma na hora. Até 8MB.</div>
        </div>
      </div>
    </div>
    <div class="campo">
      <label for="f-prod-nome">Nome *</label>
      <input type="text" id="f-prod-nome" value="${esc(p?.nome ?? '')}">
    </div>
    <div class="campo">
      <label for="f-prod-categoriaId">Categoria *</label>
      <select id="f-prod-categoriaId">${opcoes}</select>
    </div>
    <div class="campo">
      <label for="f-prod-descricao">Descrição</label>
      <textarea id="f-prod-descricao">${esc(p?.descricao ?? '')}</textarea>
    </div>
    <div class="campo">
      <label for="f-prod-preco">Preço *</label>
      <input type="text" id="f-prod-preco" placeholder="18,90"
             value="${p ? (p.precoCentavos / 100).toFixed(2).replace('.', ',') : ''}">
    </div>
    <div class="campo">
      <label for="f-prod-link">Link do iFood ou pedido (opcional)</label>
      <input type="text" id="f-prod-link" value="${esc(p?.link ?? '')}" placeholder="https://...">
    </div>
    <div class="toggles">
      <label class="toggle">
        <input type="checkbox" id="f-prod-disponivel" ${p?.disponivel !== false ? 'checked' : ''}>
        Disponível
      </label>
      <label class="toggle">
        <input type="checkbox" id="f-prod-destaque" ${p?.destaque ? 'checked' : ''}>
        Em destaque
      </label>
      <label class="toggle">
        <input type="checkbox" id="f-prod-ativo" ${p?.ativo !== false ? 'checked' : ''}>
        Ativo
      </label>
    </div>`,
    async () => {
      const dados = {
        nome: $('f-prod-nome').value,
        categoriaId: Number($('f-prod-categoriaId').value),
        descricao: $('f-prod-descricao').value,
        preco: $('f-prod-preco').value,
        link: $('f-prod-link').value,
        disponivel: $('f-prod-disponivel').checked,
        destaque: $('f-prod-destaque').checked,
        ativo: $('f-prod-ativo').checked,
      };
      if (imagemPendente !== undefined) dados.imagemUrl = imagemPendente;
      if (p) await api.salvarProduto(p.id, dados);
      else await api.criarProduto(dados);
      toast(p ? 'Produto atualizado' : 'Produto criado');
      await carregarProdutos();
    }
  );

  // Upload dentro do modal: sobe na hora e guarda a URL para salvar junto
  pintarPreview($('f-prod-prev'), p?.imagemUrl, 'Foto do produto');
  $('f-prod-arquivo').addEventListener('change', async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const prev = $('f-prod-prev');
    prev.textContent = 'Enviando…';
    try {
      imagemPendente = await api.enviarArquivo(arquivo);
      pintarPreview(prev, imagemPendente, 'Foto do produto');
      toast('Imagem enviada');
    } catch (err) {
      pintarPreview(prev, p?.imagemUrl, 'Foto do produto');
      toast(err.message || 'Falha no upload', true);
    } finally {
      e.target.value = '';
    }
  });
}

// =================================================== Destaques do início ====
// O carrossel do topo do site. Só a foto é obrigatória: nome, selo, preço e
// texto promocional são todos opcionais, então dá pra publicar um destaque
// só com a imagem e ir completando depois.

const TIPOS_DESTAQUE = [
  ['', 'Nenhum'],
  ['promocao', 'Promoção'],
  ['novidade', 'Novidade'],
  ['mais-vendido', 'Mais vendido'],
  ['recomendado', 'Recomendado'],
  ['oferta', 'Oferta'],
  ['destaque', 'Destaque'],
];

const rotuloTipo = (t) => TIPOS_DESTAQUE.find(([v]) => v === t)?.[1] || t;

async function carregarHeroImagens() {
  const alvo = $('lista-hero');
  alvo.innerHTML = '<div class="carregando">Carregando…</div>';
  const destaques = await api.listarHeroImagens();

  if (!destaques.length) {
    alvo.innerHTML = vazio('Nenhum destaque cadastrado.', '+ Adicionar destaque', 'hero-imagem');
    return;
  }

  alvo.innerHTML = destaques
    .map((h, i) => {
      const mini = h.imagemUrl
        ? `<div class="produto__mini tem-foto"><img src="${esc(h.imagemUrl)}" alt=""></div>`
        : '<div class="produto__mini">sem foto</div>';

      const preco =
        h.precoCentavos != null
          ? `<div class="produto__preco">${esc(api.formatarPreco(h.precoCentavos))}</div>`
          : '';

      const tags = [
        h.tipo ? `<span class="tag tag--destaque">${esc(rotuloTipo(h.tipo))}</span>` : '',
        h.ativo ? '' : '<span class="tag tag--off">oculto</span>',
        // Sem foto o destaque não tem como aparecer no site - o dono precisa
        // saber disso aqui, senão fica esperando um carrossel que não vem.
        h.imagemUrl ? '' : '<span class="tag tag--alerta">sem foto: não aparece no site</span>',
      ].join('');

      return `
      <div class="item ${h.ativo ? '' : 'item--inativo'}" data-arraste-item data-id="${h.id}">
        <div class="item__linha">
          ${ALCA_HTML}
          <div class="produto">
            ${mini}
            <div class="produto__dados">
              <div class="item__nome">${esc(h.nome || 'Destaque ' + (i + 1))}</div>
              ${h.descricao ? `<div class="item__meta">${esc(h.descricao)}</div>` : ''}
              ${preco}
              <div class="tags">${tags}</div>
            </div>
            <div class="item__acoes">
              <button class="btn-a btn-a--fantasma" data-acao="editar" type="button">Editar</button>
              <button class="btn-a btn-a--fantasma" data-acao="alternar" type="button">
                ${h.ativo ? 'Ocultar' : 'Mostrar'}
              </button>
              <button class="btn-a btn-a--perigo" data-acao="excluir" type="button">Excluir</button>
            </div>
          </div>
        </div>
      </div>`;
    })
    .join('');

  alvo.querySelectorAll('.item').forEach((item) => {
    const h = destaques.find((x) => x.id === Number(item.dataset.id));
    item.querySelector('[data-acao="editar"]').onclick = () => formDestaqueHero(h);
    item.querySelector('[data-acao="alternar"]').onclick = (e) =>
      comBotao(
        e.target,
        async () => {
          await api.salvarHeroImagem(h.id, { ativo: !h.ativo });
          await carregarHeroImagens();
        },
        h.ativo ? 'Destaque oculto no site' : 'Destaque visível no site'
      );
    item.querySelector('[data-acao="excluir"]').onclick = () =>
      confirmar(
        'Excluir destaque',
        `Tem certeza que deseja excluir "${h.nome || 'este destaque'}"?`,
        async () => {
          await api.excluirHeroImagem(h.id);
          toast('Destaque excluído');
          restaurarBotaoModal();
          await carregarHeroImagens();
        }
      );
  });

  ligarReordenacao(alvo, destaques, (id, ordem) => api.salvarHeroImagem(id, { ordem }), carregarHeroImagens);
}

function formDestaqueHero(h = null) {
  restaurarBotaoModal();
  // URL da foto recém-enviada; só entra no salvamento se o usuário trocou
  let imagemPendente;

  const emReais = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));
  const opcoesTipo = TIPOS_DESTAQUE.map(
    ([valor, rotulo]) =>
      `<option value="${valor}" ${(h?.tipo ?? '') === valor ? 'selected' : ''}>${esc(rotulo)}</option>`
  ).join('');

  abrirModal(
    h ? 'Editar destaque' : 'Novo destaque',
    `
    <div class="midia">
      <div class="midia__preview" id="f-hero-prev">Foto do destaque</div>
      <div class="midia__controles">
        <div class="campo">
          <label for="f-hero-arquivo">Foto *</label>
          <input type="file" id="f-hero-arquivo" accept="image/*">
          <div class="campo__dica">Escolha do celular ou tire na hora. É a foto que aparece grande no início do site.</div>
        </div>
      </div>
    </div>
    <div class="campo">
      <label for="f-hero-nome">Nome</label>
      <input type="text" id="f-hero-nome" value="${esc(h?.nome ?? '')}" placeholder="Cappuccino Especial">
    </div>
    <div class="campo">
      <label for="f-hero-tipo">Tipo de destaque</label>
      <select id="f-hero-tipo">${opcoesTipo}</select>
      <div class="campo__dica">O selo que aparece em cima da foto.</div>
    </div>
    <div class="campo">
      <label for="f-hero-descricao">Descrição curta</label>
      <input type="text" id="f-hero-descricao" value="${esc(h?.descricao ?? '')}" placeholder="Com canela e leite vaporizado">
    </div>
    <div class="linha">
      <div class="campo">
        <label for="f-hero-precoAntigoCentavos">Preço antigo</label>
        <input type="text" id="f-hero-precoAntigoCentavos" placeholder="18,90" value="${emReais(h?.precoAntigoCentavos)}">
        <div class="campo__dica">Aparece riscado. Deixe vazio se não for promoção.</div>
      </div>
      <div class="campo">
        <label for="f-hero-precoCentavos">Preço</label>
        <input type="text" id="f-hero-precoCentavos" placeholder="14,90" value="${emReais(h?.precoCentavos)}">
        <div class="campo__dica">Deixe vazio para não mostrar preço.</div>
      </div>
    </div>
    <div class="campo">
      <label for="f-hero-textoPromocional">Texto promocional</label>
      <input type="text" id="f-hero-textoPromocional" value="${esc(h?.textoPromocional ?? '')}" placeholder="Só nesta semana">
    </div>
    <div class="campo">
      <label for="f-hero-altText">Descrição da imagem (opcional)</label>
      <input type="text" id="f-hero-altText" value="${esc(h?.altText ?? '')}">
      <div class="campo__dica">Descreva brevemente o que aparece na foto. Ajuda na acessibilidade e caso a imagem não carregue.</div>
    </div>
    <label class="toggle">
      <input type="checkbox" id="f-hero-ativo" ${h?.ativo !== false ? 'checked' : ''}>
      Mostrar no site
    </label>`,
    async () => {
      const dados = {
        nome: $('f-hero-nome').value,
        tipo: $('f-hero-tipo').value,
        descricao: $('f-hero-descricao').value,
        precoCentavos: $('f-hero-precoCentavos').value,
        precoAntigoCentavos: $('f-hero-precoAntigoCentavos').value,
        textoPromocional: $('f-hero-textoPromocional').value,
        altText: $('f-hero-altText').value,
        ativo: $('f-hero-ativo').checked,
      };
      if (imagemPendente !== undefined) dados.imagemUrl = imagemPendente;

      if (h) await api.salvarHeroImagem(h.id, dados);
      else await api.criarHeroImagem(dados);
      toast(h ? 'Destaque atualizado' : 'Destaque criado');
      await carregarHeroImagens();
    }
  );

  pintarPreview($('f-hero-prev'), h?.imagemUrl, 'Foto do destaque');
  $('f-hero-arquivo').addEventListener('change', async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const prev = $('f-hero-prev');
    prev.textContent = 'Enviando…';
    try {
      imagemPendente = await api.enviarArquivo(arquivo);
      pintarPreview(prev, imagemPendente, 'Foto do destaque');
      toast('Foto enviada');
    } catch (err) {
      pintarPreview(prev, h?.imagemUrl, 'Foto do destaque');
      toast(err.message || 'Falha no upload', true);
    } finally {
      e.target.value = '';
    }
  });
}

// ========================================================== Restaurante ====

async function carregarRestaurante() {
  const dados = await api.carregarRestauranteAdmin();
  preencher('rest', dados, ['nome', 'sobre', 'endereco', 'mapaUrl']);
}

// ============================================================= Contatos ====

// Tipos com formulario pronto - rotulo e derivado automaticamente do tipo,
// entao o administrador nunca precisa digitar um "rotulo" tecnico.
const TIPOS_CONTATO = {
  whatsapp: { rotulo: 'WhatsApp', campo: 'Número do WhatsApp', dica: 'Só números, com DDD. Ex: 48999999999', placeholder: '(48) 99999-9999' },
  instagram: { rotulo: 'Instagram', campo: 'Instagram', dica: '', placeholder: '@seuusuario ou link do perfil' },
  telefone: { rotulo: 'Telefone', campo: 'Telefone', dica: '', placeholder: '(48) 3333-3333' },
  email: { rotulo: 'E-mail', campo: 'E-mail', dica: '', placeholder: 'contato@seudominio.com' },
  facebook: { rotulo: 'Facebook', campo: 'Facebook', dica: '', placeholder: '@suapagina ou link' },
  tiktok: { rotulo: 'TikTok', campo: 'TikTok', dica: '', placeholder: '@seuusuario ou link' },
};

async function carregarContatos() {
  const alvo = $('lista-contatos');
  alvo.innerHTML = '<div class="carregando">Carregando…</div>';
  const contatos = await api.listarContatos();

  if (!contatos.length) {
    alvo.innerHTML = vazio('Nenhum contato cadastrado.', '+ Adicionar contato', 'contato');
    return;
  }

  alvo.innerHTML = contatos
    .map(
      (c) => `
    <div class="item ${c.ativo ? '' : 'item--inativo'}" data-arraste-item data-id="${c.id}">
      <div class="item__linha">
        ${ALCA_HTML}
        <div class="item__topo">
          <div>
            <div class="item__nome">${esc(c.rotulo)}</div>
            <div class="item__meta">${esc(c.valor)}</div>
          </div>
          <div class="item__acoes">
            <button class="btn-a btn-a--fantasma" data-acao="editar" type="button">Editar</button>
            <button class="btn-a btn-a--fantasma" data-acao="alternar" type="button">
              ${c.ativo ? 'Ocultar' : 'Mostrar'}
            </button>
            <button class="btn-a btn-a--perigo" data-acao="excluir" type="button">Excluir</button>
          </div>
        </div>
      </div>
    </div>`
    )
    .join('');

  alvo.querySelectorAll('.item').forEach((item) => {
    const c = contatos.find((x) => x.id === Number(item.dataset.id));
    item.querySelector('[data-acao="editar"]').onclick = () => formContato(c);
    item.querySelector('[data-acao="alternar"]').onclick = (e) =>
      comBotao(
        e.target,
        async () => {
          await api.salvarContato(c.id, { ativo: !c.ativo });
          await carregarContatos();
        },
        c.ativo ? 'Contato oculto no site' : 'Contato visível no site'
      );
    item.querySelector('[data-acao="excluir"]').onclick = () =>
      confirmar('Excluir contato', `Excluir "${c.rotulo}"?`, async () => {
        await api.excluirContato(c.id);
        toast('Contato excluído');
        restaurarBotaoModal();
        await carregarContatos();
      });
  });

  ligarReordenacao(alvo, contatos, (id, ordem) => api.salvarContato(id, { ordem }), carregarContatos);
}

// Redesenha os campos de baixo do formulario conforme o tipo escolhido -
// assim so aparece o que faz sentido pra aquele contato.
function redesenharCamposContato(tipo, c) {
  const corpo = $('f-con-campos');
  const info = TIPOS_CONTATO[tipo];

  if (info) {
    corpo.innerHTML = `
      <div class="campo">
        <label for="f-con-valor">${esc(info.campo)} *</label>
        <input type="text" id="f-con-valor" value="${esc(c?.tipo === tipo ? c.valor : '')}" placeholder="${esc(info.placeholder)}">
        ${info.dica ? `<div class="campo__dica">${esc(info.dica)}</div>` : ''}
      </div>`;
  } else {
    // "Outro" (ou um tipo antigo que nao esta na lista curada, como enderec/horario)
    const rotuloAtual = !TIPOS_CONTATO[c?.tipo] ? c?.rotulo ?? '' : '';
    const valorAtual = !TIPOS_CONTATO[c?.tipo] ? c?.valor ?? '' : '';
    corpo.innerHTML = `
      <div class="campo">
        <label for="f-con-nome">Nome do contato *</label>
        <input type="text" id="f-con-nome" value="${esc(rotuloAtual)}" placeholder="Ex: Telegram, Site, Delivery próprio">
      </div>
      <div class="campo">
        <label for="f-con-valor">Link ou informação *</label>
        <input type="text" id="f-con-valor" value="${esc(valorAtual)}" placeholder="https://... ou um texto livre">
      </div>`;
  }
}

function formContato(c = null) {
  restaurarBotaoModal();
  const tipoInicial = TIPOS_CONTATO[c?.tipo] ? c.tipo : 'outro';
  const opcoes =
    Object.entries(TIPOS_CONTATO)
      .map(([valor, info]) => `<option value="${valor}" ${tipoInicial === valor ? 'selected' : ''}>${esc(info.rotulo)}</option>`)
      .join('') + `<option value="outro" ${tipoInicial === 'outro' ? 'selected' : ''}>Outro</option>`;

  abrirModal(
    c ? 'Editar contato' : 'Novo contato',
    `
    <div class="campo">
      <label for="f-con-tipo">Tipo de contato *</label>
      <select id="f-con-tipo">${opcoes}</select>
    </div>
    <div id="f-con-campos"></div>
    <label class="toggle">
      <input type="checkbox" id="f-con-ativo" ${c?.ativo !== false ? 'checked' : ''}>
      Mostrar no site
    </label>`,
    async () => {
      const tipo = $('f-con-tipo').value;
      const info = TIPOS_CONTATO[tipo];
      const dados = {
        tipo,
        rotulo: info ? info.rotulo : $('f-con-nome').value,
        valor: $('f-con-valor').value,
        ativo: $('f-con-ativo').checked,
      };
      // Link clicavel automatico quando da pra deduzir; senao fica so texto exibido
      dados.link = deduzirLink(tipo, dados.valor);

      if (c) await api.salvarContato(c.id, dados);
      else await api.criarContato(dados);
      toast(c ? 'Contato atualizado' : 'Contato criado');
      await carregarContatos();
    }
  );

  redesenharCamposContato(tipoInicial, c);
  $('f-con-tipo').addEventListener('change', (e) => redesenharCamposContato(e.target.value, c));
}

// A partir do que a pessoa digitou, monta o link clicavel certo pra cada tipo.
// Se ja for um link (comeca com http), usa direto.
function deduzirLink(tipo, valor) {
  const v = String(valor || '').trim();
  if (!v) return null;
  if (v.startsWith('http://') || v.startsWith('https://')) return v;

  const soDigitos = v.replace(/\D/g, '');
  switch (tipo) {
    case 'whatsapp':
      if (!soDigitos) return null;
      return 'https://wa.me/' + (soDigitos.length > 11 ? soDigitos : '55' + soDigitos);
    case 'telefone':
      return soDigitos ? 'tel:+55' + soDigitos : null;
    case 'email':
      return v.includes('@') ? 'mailto:' + v : null;
    case 'instagram':
      return v.startsWith('@') ? 'https://instagram.com/' + v.slice(1) : null;
    case 'tiktok':
      return v.startsWith('@') ? 'https://tiktok.com/@' + v.slice(1) : null;
    default:
      return null;
  }
}

// ============================================================= Horarios ====

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

async function carregarHorarios() {
  const alvo = $('lista-horarios');
  alvo.innerHTML = '<div class="carregando">Carregando…</div>';
  const horarios = await api.listarHorarios();

  // Garante os 7 dias na tela mesmo que o banco tenha menos
  const porDia = new Map(horarios.map((h) => [h.diaSemana, h]));
  alvo.innerHTML = DIAS.map((nome, dia) => {
    const h = porDia.get(dia) ?? { aberto: false, abreEm: '08:00', fechaEm: '19:00' };
    return `
    <div class="item horario-item" data-dia="${dia}">
      <div class="linha-3 horario-item__campos">
        <div class="campo horario-item__campo">
          <label>${esc(nome)}</label>
          <label class="toggle">
            <input type="checkbox" data-campo="aberto" ${h.aberto ? 'checked' : ''}> Aberto
          </label>
        </div>
        <div class="campo horario-item__campo">
          <label>Abre</label>
          <input type="time" data-campo="abreEm" value="${esc(h.abreEm)}">
        </div>
        <div class="campo horario-item__campo">
          <label>Fecha</label>
          <input type="time" data-campo="fechaEm" value="${esc(h.fechaEm)}">
        </div>
      </div>
      <button class="btn-a btn-a--fantasma" data-acao="aplicar-todos" type="button">
        Aplicar este horário a todos os dias
      </button>
    </div>`;
  }).join('');

  alvo.querySelectorAll('[data-acao="aplicar-todos"]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const origem = botao.closest('.item');
      const valores = lerCampos(origem);
      alvo.querySelectorAll('.item').forEach((item) => {
        if (item === origem) return;
        item.querySelector('[data-campo="aberto"]').checked = valores.aberto;
        item.querySelector('[data-campo="abreEm"]').value = valores.abreEm;
        item.querySelector('[data-campo="fechaEm"]').value = valores.fechaEm;
      });
      toast('Horário copiado para os outros dias. Clique em "Salvar horários" para confirmar.');
    });
  });
}

// ===================================================== Conteudo do site ====

async function carregarSite() {
  estado.conteudo = await api.carregarConteudo();
  const d = estado.conteudo;

  preencher('hero', d.hero, ['headline', 'subtitulo']);
  preencher('cfg', d.config, ['tituloDestaques', 'subtituloDestaques', 'tituloCardapio', 'subtituloCardapio']);
  preencher('visite', d.visite, ['titulo', 'texto']);

  montarDestaques(d.destaques ?? []);
  montarVisiteImagens(d.visite?.imagens ?? []);
}

function montarDestaques(lista) {
  const alvo = $('lista-destaques');
  if (!lista.length) {
    alvo.innerHTML = '<p class="campo__dica">Nenhum card ainda.</p>';
    return;
  }
  alvo.innerHTML = lista
    .map(
      (d) => `
    <div class="item" data-arraste-item data-id="${d.id}">
      <div class="item__linha">
        ${ALCA_HTML}
        <div class="item__topo">
          <span class="item__nome">${esc(d.titulo) || 'Card'}</span>
          <button class="btn-a btn-a--perigo" data-acao="excluir" type="button">Excluir</button>
        </div>
      </div>
      <div class="midia">
        <div class="midia__preview" data-prev></div>
        <div class="midia__controles">
          <div class="campo">
            <label>Ícone ou imagem (opcional)</label>
            <input type="file" data-arquivo accept="image/*">
          </div>
        </div>
      </div>
      <div class="campo">
        <label>Título</label>
        <input type="text" data-campo="titulo" value="${esc(d.titulo)}">
      </div>
      <div class="campo">
        <label>Texto</label>
        <textarea data-campo="texto">${esc(d.texto)}</textarea>
      </div>
      <button class="btn-a btn-a--marinho" data-acao="salvar" type="button">Salvar card</button>
    </div>`
    )
    .join('');

  alvo.querySelectorAll('.item').forEach((item, i) => {
    const d = lista[i];
    pintarPreview(item.querySelector('[data-prev]'), d.imagemUrl, 'Ícone ou imagem');
    item.querySelector('[data-arquivo]').onchange = (e) =>
      subirFoto(e.target, item, (url) => api.salvarDestaque(d.id, { imagemUrl: url }));
    item.querySelector('[data-acao="salvar"]').onclick = (e) =>
      comBotao(e.target, () => api.salvarDestaque(d.id, lerCampos(item)), 'Card salvo');
    item.querySelector('[data-acao="excluir"]').onclick = () =>
      confirmar('Excluir card', 'Tem certeza que deseja excluir este card?', async () => {
        await api.removerItem('destaques', d.id);
        toast('Card excluído');
        restaurarBotaoModal();
        await carregarSite();
      });
  });

  ligarReordenacao(alvo, lista, (id, ordem) => api.salvarDestaque(id, { ordem }), carregarSite);
}

function montarVisiteImagens(itens) {
  const alvo = $('lista-visite-imagens');
  if (!itens.length) {
    alvo.innerHTML = '<p class="campo__dica">Nenhuma foto ainda.</p>';
    return;
  }
  alvo.innerHTML = itens
    .map(
      (it, i) => `
    <div class="item" data-arraste-item data-id="${it.id}">
      <div class="item__linha">
        ${ALCA_HTML}
        <div class="item__topo">
          <span class="item__nome">Foto ${i + 1}</span>
          <button class="btn-a btn-a--perigo" data-acao="remover" type="button">Remover</button>
        </div>
      </div>
      <div class="midia">
        <div class="midia__preview" data-prev></div>
        <div class="midia__controles">
          <div class="campo">
            <label>Foto</label>
            <input type="file" data-arquivo accept="image/*">
          </div>
        </div>
      </div>
    </div>`
    )
    .join('');

  alvo.querySelectorAll('.item').forEach((item, i) => {
    const it = itens[i];
    pintarPreview(item.querySelector('[data-prev]'), it.imagemUrl, 'Foto do local');
    item.querySelector('[data-arquivo]').onchange = (e) =>
      subirFoto(e.target, item, (url) => api.salvarItem('visite-imagens', it.id, { imagemUrl: url }));
    item.querySelector('[data-acao="remover"]').onclick = () =>
      confirmar('Remover foto', 'Tem certeza que deseja remover esta foto?', async () => {
        await api.removerItem('visite-imagens', it.id);
        toast('Foto removida');
        restaurarBotaoModal();
        await carregarSite();
      });
  });

  ligarReordenacao(alvo, itens, (id, ordem) => api.salvarItem('visite-imagens', id, { ordem }), carregarSite);
}

// ====================================================== Acoes genericas ====

const SALVAR = {
  restaurante: () => api.salvarRestaurante(coletar('rest', ['nome', 'sobre', 'endereco', 'mapaUrl'])),
  hero: () => api.salvarHero(coletar('hero', ['headline', 'subtitulo'])),
  config: () => api.salvarConfig(coletar('cfg', ['tituloDestaques', 'subtituloDestaques', 'tituloCardapio', 'subtituloCardapio'])),
  visite: () => api.salvarVisite(coletar('visite', ['titulo', 'texto'])),
  horarios: () => {
    const horarios = [...document.querySelectorAll('#lista-horarios .item')].map((item) => ({
      diaSemana: Number(item.dataset.dia),
      ...lerCampos(item),
    }));
    return api.salvarHorarios(horarios);
  },
};

const NOVO = {
  categoria: () => { formCategoria(); return Promise.resolve(); },
  produto: () => { formProduto(); return Promise.resolve(); },
  contato: () => { formContato(); return Promise.resolve(); },
  'hero-imagem': () => { formDestaqueHero(); return Promise.resolve(); },
  destaque: async () => { await api.criarItem('destaques'); await carregarSite(); },
  'visite-imagens': async () => { await api.criarItem('visite-imagens'); await carregarSite(); },
};

document.addEventListener('click', (e) => {
  const salvar = e.target.closest('[data-salvar]');
  if (salvar) {
    comBotao(salvar, SALVAR[salvar.dataset.salvar], 'Alterações salvas.').catch(() => {});
    return;
  }
  const novo = e.target.closest('[data-novo]');
  if (novo) {
    const acao = NOVO[novo.dataset.novo];
    if (acao) comBotao(novo, acao, null, 'Aguarde…').catch(() => {});
  }
});

// ============================================================== Comuns =====

function lerCampos(item) {
  const saida = {};
  item.querySelectorAll('[data-campo]').forEach((el) => {
    saida[el.dataset.campo] = el.type === 'checkbox' ? el.checked : el.value;
  });
  return saida;
}

async function subirFoto(input, item, salvar) {
  const arquivo = input.files?.[0];
  if (!arquivo) return;
  const preview = item.querySelector('[data-prev]');
  const antes = preview.innerHTML;
  preview.textContent = 'Enviando…';
  try {
    const url = await api.enviarArquivo(arquivo);
    pintarPreview(preview, url, '');
    await salvar(url);
    toast('Foto enviada');
  } catch (e) {
    preview.innerHTML = antes;
    toast(e.message || 'Falha no upload', true);
  } finally {
    input.value = '';
  }
}

// ================================================================= Boot ====
// Guarda de sessao da propria pagina: sem sessao valida, sai daqui na hora
// e vai pra tela de login de verdade, em vez de mostrar um painel vazio.

try {
  const { logado } = await api.verificarSessao();
  if (logado) {
    // So revela com a animacao quando o painel de verdade vai aparecer -
    // se nao tiver sessao, o redirecionamento pro login e imediato, sem
    // sentido em encolher o circulo pra so trocar de tela na sequencia.
    chegandoComCirculo();
    await abrirPainel();
  } else {
    mandarParaLogin();
  }
} catch {
  mandarParaLogin();
}
