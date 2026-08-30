import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import {
  rota,
  texto,
  inteiro,
  booleano,
  url,
  id,
  precoCentavos,
  ErroValidacao,
} from '../../lib/validacao.js';

export const rotasProdutos = Router();

async function montar(corpo, { parcial = false } = {}) {
  const dados = {};
  const tem = (c) => corpo[c] !== undefined;

  if (!parcial || tem('nome')) {
    dados.nome = texto(corpo.nome, 'nome', { min: 1, max: 120, obrigatorio: true });
  }
  if (!parcial || tem('descricao')) {
    dados.descricao = texto(corpo.descricao, 'descrição', { max: 1000 });
  }
  if (!parcial || tem('preco') || tem('precoCentavos')) {
    // Aceita "18,90" do formulario ou 1890 ja em centavos
    const bruto = tem('preco') ? corpo.preco : corpo.precoCentavos;
    dados.precoCentavos = precoCentavos(bruto, 'preço');
  }
  if (!parcial || tem('imagemUrl')) {
    dados.imagemUrl = url(corpo.imagemUrl, 'imagem');
  }
  if (!parcial || tem('altText')) {
    dados.altText = texto(corpo.altText, 'texto alternativo', { max: 200 });
  }
  if (!parcial || tem('link')) {
    dados.link = url(corpo.link, 'link');
  }
  if (!parcial || tem('disponivel')) {
    dados.disponivel = booleano(corpo.disponivel, 'disponível', true);
  }
  if (!parcial || tem('destaque')) {
    dados.destaque = booleano(corpo.destaque, 'destaque', false);
  }
  if (!parcial || tem('ativo')) {
    dados.ativo = booleano(corpo.ativo, 'ativo', true);
  }
  if (!parcial || tem('ordem')) {
    dados.ordem = inteiro(corpo.ordem, 'ordem', { min: 0, max: 9999 });
  }

  // Relacionamento: nunca aceitar produto apontando pra categoria que nao
  // existe (ou que ja foi removida).
  if (!parcial || tem('categoriaId')) {
    const idCat = id(corpo.categoriaId, 'categoria');
    const categoria = await prisma.categoria.findFirst({
      where: { id: idCat, deletadoEm: null },
    });
    if (!categoria) {
      throw new ErroValidacao('A categoria escolhida não existe', 'categoriaId');
    }
    dados.categoriaId = idCat;
  }

  return dados;
}

rotasProdutos.get(
  '/produtos',
  rota(async (req, res) => {
    const where = { deletadoEm: null };
    if (req.query.categoria) {
      const n = Number(req.query.categoria);
      if (Number.isInteger(n) && n > 0) where.categoriaId = n;
    }
    const produtos = await prisma.produto.findMany({
      where,
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      include: { categoria: { select: { id: true, nome: true } } },
    });
    res.json(produtos);
  })
);

rotasProdutos.get(
  '/produtos/:id',
  rota(async (req, res) => {
    const produto = await prisma.produto.findFirst({
      where: { id: id(req.params.id), deletadoEm: null },
      include: { categoria: { select: { id: true, nome: true } } },
    });
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.json(produto);
  })
);

rotasProdutos.post(
  '/produtos',
  rota(async (req, res) => {
    const dados = await montar(req.body || {});
    if (req.body?.ordem === undefined) {
      const ultimo = await prisma.produto.findFirst({
        where: { categoriaId: dados.categoriaId, deletadoEm: null },
        orderBy: { ordem: 'desc' },
      });
      dados.ordem = (ultimo?.ordem ?? 0) + 1;
    }
    const criado = await prisma.produto.create({
      data: dados,
      include: { categoria: { select: { id: true, nome: true } } },
    });
    console.log('[admin] produto criado:', criado.id, criado.nome);
    res.status(201).json(criado);
  })
);

rotasProdutos.put(
  '/produtos/:id',
  rota(async (req, res) => {
    const idProd = id(req.params.id);
    const existente = await prisma.produto.findFirst({
      where: { id: idProd, deletadoEm: null },
    });
    if (!existente) return res.status(404).json({ erro: 'Produto não encontrado' });

    const dados = await montar(req.body || {}, { parcial: true });
    const atualizado = await prisma.produto.update({
      where: { id: idProd },
      data: dados,
      include: { categoria: { select: { id: true, nome: true } } },
    });
    res.json(atualizado);
  })
);

// Soft delete - o registro fica no banco, so sai do cardapio
rotasProdutos.delete(
  '/produtos/:id',
  rota(async (req, res) => {
    const idProd = id(req.params.id);
    const existente = await prisma.produto.findFirst({
      where: { id: idProd, deletadoEm: null },
    });
    if (!existente) return res.status(404).json({ erro: 'Produto não encontrado' });

    await prisma.produto.update({
      where: { id: idProd },
      data: { deletadoEm: new Date(), ativo: false },
    });
    console.log('[admin] produto removido (soft delete):', idProd);
    res.json({ ok: true });
  })
);
