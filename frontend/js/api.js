// ============================================================================
// Camada unica de acesso a dados.
//
// Nenhum outro arquivo do front faz fetch. Quando o projeto migrar para o
// Supabase, e SO ESTE ARQUIVO que muda: as funcoes abaixo passam a chamar
// supabase-js no lugar de /api/*. O HTML e o CSS nao precisam ser tocados.
// ============================================================================

async function req(url, opcoes = {}) {
  const temCorpo = opcoes.corpo !== undefined;
  const resposta = await fetch(url, {
    credentials: 'same-origin',
    headers: temCorpo ? { 'Content-Type': 'application/json' } : {},
    method: opcoes.metodo || 'GET',
    body: temCorpo ? JSON.stringify(opcoes.corpo) : undefined,
  });

  if (!resposta.ok) {
    let msg = 'Erro ' + resposta.status;
    try {
      const j = await resposta.json();
      if (j.erro) msg = j.erro;
    } catch {
      /* resposta sem JSON, fica a mensagem padrao */
    }
    const erro = new Error(msg);
    erro.status = resposta.status;
    throw erro;
  }
  if (resposta.status === 204) return null;
  return resposta.json();
}

// ============================================================ PUBLICO =======

export const carregarConteudo = () => req('/api/conteudo');
export const carregarCardapio = () => req('/api/cardapio');
export const carregarProdutosDestaque = () => req('/api/produtos/destaques');
export const carregarRestaurante = () => req('/api/restaurante');

// =============================================================== AUTH =======

export const login = (usuario, senha) =>
  req('/api/auth/login', { metodo: 'POST', corpo: { usuario, senha } });
export const logout = () => req('/api/auth/logout', { metodo: 'POST' });
export const verificarSessao = () => req('/api/auth/me');

// ============================================================== ADMIN =======

// --- Categorias
export const listarCategorias = () => req('/api/admin/categorias');
export const criarCategoria = (dados) =>
  req('/api/admin/categorias', { metodo: 'POST', corpo: dados });
export const salvarCategoria = (id, dados) =>
  req('/api/admin/categorias/' + id, { metodo: 'PUT', corpo: dados });
export const excluirCategoria = (id) =>
  req('/api/admin/categorias/' + id, { metodo: 'DELETE' });

// --- Produtos
export const listarProdutos = () => req('/api/admin/produtos');
export const criarProduto = (dados) =>
  req('/api/admin/produtos', { metodo: 'POST', corpo: dados });
export const salvarProduto = (id, dados) =>
  req('/api/admin/produtos/' + id, { metodo: 'PUT', corpo: dados });
export const excluirProduto = (id) =>
  req('/api/admin/produtos/' + id, { metodo: 'DELETE' });

// --- Imagens de destaque
export const listarHeroImagens = () => req('/api/admin/hero-imagens');
export const criarHeroImagem = (dados = {}) =>
  req('/api/admin/hero-imagens', { metodo: 'POST', corpo: dados });
export const salvarHeroImagem = (id, dados) =>
  req('/api/admin/hero-imagens/' + id, { metodo: 'PUT', corpo: dados });
export const excluirHeroImagem = (id) =>
  req('/api/admin/hero-imagens/' + id, { metodo: 'DELETE' });

// --- Estabelecimento
export const carregarRestauranteAdmin = () => req('/api/admin/restaurante');
export const salvarRestaurante = (dados) =>
  req('/api/admin/restaurante', { metodo: 'PUT', corpo: dados });

export const listarContatos = () => req('/api/admin/contatos');
export const criarContato = (dados) =>
  req('/api/admin/contatos', { metodo: 'POST', corpo: dados });
export const salvarContato = (id, dados) =>
  req('/api/admin/contatos/' + id, { metodo: 'PUT', corpo: dados });
export const excluirContato = (id) =>
  req('/api/admin/contatos/' + id, { metodo: 'DELETE' });

export const listarHorarios = () => req('/api/admin/horarios');
export const salvarHorarios = (horarios) =>
  req('/api/admin/horarios', { metodo: 'PUT', corpo: { horarios } });

// --- Conteudo do site
export const salvarConfig = (dados) =>
  req('/api/admin/config', { metodo: 'PUT', corpo: dados });
export const salvarHero = (dados) =>
  req('/api/admin/hero', { metodo: 'PUT', corpo: dados });
export const salvarVisite = (dados) =>
  req('/api/admin/visite', { metodo: 'PUT', corpo: dados });
export const salvarDestaque = (id, dados) =>
  req('/api/admin/destaques/' + id, { metodo: 'PUT', corpo: dados });

export const criarItem = (lista) => req('/api/admin/' + lista, { metodo: 'POST' });
export const salvarItem = (lista, id, dados) =>
  req('/api/admin/' + lista + '/' + id, { metodo: 'PUT', corpo: dados });
export const removerItem = (lista, id) =>
  req('/api/admin/' + lista + '/' + id, { metodo: 'DELETE' });

// ============================================================= UPLOAD =======

// Le o arquivo no browser e manda como base64.
// Vira upload direto pro Supabase Storage na migracao.
export function enviarArquivo(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não consegui ler o arquivo'));
    leitor.onload = async () => {
      try {
        const base64 = String(leitor.result).split(',')[1];
        const r = await req('/api/admin/upload', {
          metodo: 'POST',
          corpo: { dados: base64, tipo: arquivo.type },
        });
        resolve(r.url);
      } catch (e) {
        reject(e);
      }
    };
    leitor.readAsDataURL(arquivo);
  });
}

// ============================================================ HELPERS =======

// O banco guarda centavos (1890). O painel e o site mostram R$ 18,90.
export const formatarPreco = (centavos) =>
  (Number(centavos || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

// "18,90" -> 1890. Devolve null se nao der pra ler (o backend valida de novo).
export function precoParaCentavos(texto) {
  const bruto = String(texto ?? '').replace(/[R$\s]/gi, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(bruto)) return null;
  return Math.round(Number(bruto) * 100);
}
