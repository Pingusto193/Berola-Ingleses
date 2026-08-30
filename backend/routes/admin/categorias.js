import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { rota, texto, inteiro, booleano, url, id } from '../../lib/validacao.js';

export const rotasCategorias = Router();

// Monta o objeto a gravar. Em PATCH parcial (parcial = true) so entram os
// campos que vieram no corpo, para nao zerar o que o admin nao mexeu.
function montar(corpo, { parcial = false } = {}) {
  const dados = {};
  const tem = (c) => corpo[c] !== undefined;

  if (!parcial || tem('nome')) {
    dados.nome = texto(corpo.nome, 'nome', { min: 1, max: 80, obrigatorio: true });
  }
  if (!parcial || tem('descricao')) {
    dados.descricao = texto(corpo.descricao, 'descrição', { max: 500 });
  }
  if (!parcial || tem('imagemUrl')) {
    dados.imagemUrl = url(corpo.imagemUrl, 'imagem');
  }
  if (!parcial || tem('altText')) {
    dados.altText = texto(corpo.altText, 'texto alternativo', { max: 200 });
  }
  if (!parcial || tem('ordem')) {
    dados.ordem = inteiro(corpo.ordem, 'ordem', { min: 0, max: 9999 });
  }
  if (!parcial || tem('ativo')) {
    dados.ativo = booleano(corpo.ativo, 'ativo', true);
  }
  return dados;
}

// Lista TUDO que nao foi deletado - inclusive inativos, que o admin precisa ver
rotasCategorias.get(
  '/categorias',
  rota(async (_req, res) => {
    const categorias = await prisma.categoria.findMany({
      where: { deletadoEm: null },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      include: {
        _count: { select: { produtos: { where: { deletadoEm: null } } } },
      },
    });
    res.json(categorias);
  })
);

rotasCategorias.post(
  '/categorias',
  rota(async (req, res) => {
    const dados = montar(req.body || {});
    if (!req.body?.ordem) {
      const ultima = await prisma.categoria.findFirst({
        where: { deletadoEm: null },
        orderBy: { ordem: 'desc' },
      });
      dados.ordem = (ultima?.ordem ?? 0) + 1;
    }
    const criada = await prisma.categoria.create({ data: dados });
    console.log('[admin] categoria criada:', criada.id, criada.nome);
    res.status(201).json(criada);
  })
);

rotasCategorias.put(
  '/categorias/:id',
  rota(async (req, res) => {
    const idCat = id(req.params.id);
    const dados = montar(req.body || {}, { parcial: true });

    const existente = await prisma.categoria.findFirst({
      where: { id: idCat, deletadoEm: null },
    });
    if (!existente) return res.status(404).json({ erro: 'Categoria não encontrada' });

    const atualizada = await prisma.categoria.update({ where: { id: idCat }, data: dados });
    res.json(atualizada);
  })
);

// Soft delete: marca deletadoEm em vez de apagar a linha.
// Recusa se ainda houver produto vivo dentro - senao o cardapio fica com
// produto orfao apontando pra categoria que sumiu.
rotasCategorias.delete(
  '/categorias/:id',
  rota(async (req, res) => {
    const idCat = id(req.params.id);

    const existente = await prisma.categoria.findFirst({
      where: { id: idCat, deletadoEm: null },
    });
    if (!existente) return res.status(404).json({ erro: 'Categoria não encontrada' });

    const produtosVivos = await prisma.produto.count({
      where: { categoriaId: idCat, deletadoEm: null },
    });
    if (produtosVivos > 0) {
      return res.status(409).json({
        erro: `Esta categoria ainda tem ${produtosVivos} produto(s). Mova ou remova os produtos primeiro.`,
      });
    }

    await prisma.categoria.update({
      where: { id: idCat },
      data: { deletadoEm: new Date(), ativo: false },
    });
    console.log('[admin] categoria removida (soft delete):', idCat);
    res.json({ ok: true });
  })
);
