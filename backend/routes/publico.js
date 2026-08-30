// ============================================================================
// Rotas PUBLICAS - somente leitura, sem autenticacao.
//
// Regra: aqui nunca sai registro inativo nem deletado. O que o visitante ve e
// exatamente o que o admin marcou como ativo.
// ============================================================================
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { rota } from '../lib/validacao.js';

export const rotasPublicas = Router();

const soVisiveis = { ativo: true, deletadoEm: null };

// Campos que o site publico precisa de um produto. Evita mandar timestamps
// e flags internas para o browser.
const CAMPOS_PRODUTO = {
  id: true,
  nome: true,
  descricao: true,
  precoCentavos: true,
  imagemUrl: true,
  altText: true,
  link: true,
  disponivel: true,
  destaque: true,
  ordem: true,
  categoriaId: true,
};

// --------------------------------------------------------------- Cardapio

rotasPublicas.get(
  '/categorias',
  rota(async (_req, res) => {
    const categorias = await prisma.categoria.findMany({
      where: soVisiveis,
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        nome: true,
        descricao: true,
        imagemUrl: true,
        altText: true,
        ordem: true,
      },
    });
    res.json(categorias);
  })
);

rotasPublicas.get(
  '/produtos',
  rota(async (req, res) => {
    const where = { ...soVisiveis };
    // ?categoria=3 filtra por categoria
    if (req.query.categoria) {
      const n = Number(req.query.categoria);
      if (Number.isInteger(n) && n > 0) where.categoriaId = n;
    }
    const produtos = await prisma.produto.findMany({
      where,
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      select: CAMPOS_PRODUTO,
    });
    res.json(produtos);
  })
);

rotasPublicas.get(
  '/produtos/destaques',
  rota(async (_req, res) => {
    const produtos = await prisma.produto.findMany({
      where: { ...soVisiveis, destaque: true },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      select: CAMPOS_PRODUTO,
    });
    res.json(produtos);
  })
);

// Cardapio montado: categorias ativas ja com seus produtos ativos dentro.
// Uma chamada so, que e o que a pagina de cardapio precisa.
rotasPublicas.get(
  '/cardapio',
  rota(async (_req, res) => {
    const categorias = await prisma.categoria.findMany({
      where: soVisiveis,
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        nome: true,
        descricao: true,
        imagemUrl: true,
        altText: true,
        produtos: {
          where: soVisiveis,
          orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
          select: CAMPOS_PRODUTO,
        },
      },
    });
    res.json(categorias);
  })
);

// ------------------------------------------------------- Imagens de destaque

rotasPublicas.get(
  '/hero-imagens',
  rota(async (_req, res) => {
    const imagens = await prisma.heroImagem.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      select: {
        id: true, imagemUrl: true, altText: true, ordem: true,
        nome: true, descricao: true, tipo: true, textoPromocional: true,
        precoCentavos: true, precoAntigoCentavos: true,
      },
    });
    res.json(imagens);
  })
);

// ----------------------------------------------------------- Estabelecimento

rotasPublicas.get(
  '/restaurante',
  rota(async (_req, res) => {
    const [restaurante, horarios, contatos] = await Promise.all([
      prisma.restaurante.findUnique({ where: { id: 1 } }),
      prisma.horarioFuncionamento.findMany({ orderBy: { diaSemana: 'asc' } }),
      prisma.contato.findMany({
        where: { ativo: true },
        orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
        select: { id: true, tipo: true, rotulo: true, valor: true, link: true },
      }),
    ]);
    res.json({ restaurante, horarios, contatos });
  })
);

rotasPublicas.get(
  '/contatos',
  rota(async (_req, res) => {
    const contatos = await prisma.contato.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      select: { id: true, tipo: true, rotulo: true, valor: true, link: true },
    });
    res.json(contatos);
  })
);

// --------------------------------------------------------- Conteudo do site

// Tudo que a home precisa numa chamada so - o front renderiza de uma vez.
rotasPublicas.get(
  '/conteudo',
  rota(async (_req, res) => {
    const [
      config,
      hero,
      heroImagens,
      destaques,
      visite,
      visiteImagens,
      galeria,
      contato,
      cardapio,
      restaurante,
      horarios,
    ] = await Promise.all([
      prisma.siteConfig.findUnique({ where: { id: 1 } }),
      prisma.hero.findUnique({ where: { id: 1 } }),
      prisma.heroImagem.findMany({
        where: { ativo: true },
        orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      }),
      prisma.destaque.findMany({ orderBy: { ordem: 'asc' } }),
      prisma.visiteAGente.findUnique({ where: { id: 1 } }),
      prisma.visiteImagem.findMany({ orderBy: { ordem: 'asc' } }),
      prisma.galeriaItem.findMany({ orderBy: { ordem: 'asc' } }),
      prisma.contato.findMany({
        where: { ativo: true },
        orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
        select: { id: true, tipo: true, rotulo: true, valor: true, link: true },
      }),
      prisma.categoria.findMany({
        where: soVisiveis,
        orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          nome: true,
          descricao: true,
          produtos: {
            where: soVisiveis,
            orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
            select: CAMPOS_PRODUTO,
          },
        },
      }),
      prisma.restaurante.findUnique({ where: { id: 1 } }),
      prisma.horarioFuncionamento.findMany({ orderBy: { diaSemana: 'asc' } }),
    ]);

    res.json({
      config,
      hero,
      heroImagens,
      destaques,
      visite: visite ? { ...visite, imagens: visiteImagens } : null,
      galeria,
      contato,
      cardapio,
      restaurante,
      horarios,
    });
  })
);
