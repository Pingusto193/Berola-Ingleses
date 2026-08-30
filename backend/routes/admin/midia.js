// Destaques do inicio: o carrossel do topo do site.
// Só a foto importa - nome, selo, preco e texto promocional sao todos
// opcionais, entao um destaque pode ser publicado so com a imagem.
import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { rota, texto, inteiro, booleano, url, id, precoOpcional } from '../../lib/validacao.js';

export const rotasMidia = Router();

function montar(corpo, { parcial = false } = {}) {
  const dados = {};
  const tem = (c) => corpo[c] !== undefined;

  if (!parcial || tem('imagemUrl')) {
    dados.imagemUrl = url(corpo.imagemUrl, 'imagem');
  }
  if (!parcial || tem('altText')) {
    dados.altText = texto(corpo.altText, 'descrição da imagem', { max: 200 });
  }
  if (!parcial || tem('nome')) {
    dados.nome = texto(corpo.nome, 'nome', { max: 80 });
  }
  if (!parcial || tem('descricao')) {
    dados.descricao = texto(corpo.descricao, 'descrição', { max: 200 });
  }
  if (!parcial || tem('tipo')) {
    // Selo livre, so normalizado - o painel oferece uma lista, mas nada
    // impede o dono de inventar um selo proprio depois.
    dados.tipo = texto(corpo.tipo, 'tipo de destaque', { max: 30 });
  }
  if (!parcial || tem('textoPromocional')) {
    dados.textoPromocional = texto(corpo.textoPromocional, 'texto promocional', { max: 120 });
  }
  if (!parcial || tem('precoCentavos')) {
    dados.precoCentavos = precoOpcional(corpo.precoCentavos, 'preço');
  }
  if (!parcial || tem('precoAntigoCentavos')) {
    dados.precoAntigoCentavos = precoOpcional(corpo.precoAntigoCentavos, 'preço antigo');
  }
  if (!parcial || tem('ordem')) {
    dados.ordem = inteiro(corpo.ordem, 'ordem', { min: 0, max: 9999 });
  }
  if (!parcial || tem('ativo')) {
    dados.ativo = booleano(corpo.ativo, 'ativo', true);
  }
  return dados;
}

rotasMidia.get(
  '/hero-imagens',
  rota(async (_req, res) => {
    const imagens = await prisma.heroImagem.findMany({
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
    });
    res.json(imagens);
  })
);

rotasMidia.post(
  '/hero-imagens',
  rota(async (req, res) => {
    const dados = montar(req.body || {});
    if (req.body?.ordem === undefined) {
      const ultima = await prisma.heroImagem.findFirst({ orderBy: { ordem: 'desc' } });
      dados.ordem = (ultima?.ordem ?? 0) + 1;
    }
    if (!dados.altText) dados.altText = 'Destaque do início';
    const criada = await prisma.heroImagem.create({ data: dados });
    res.status(201).json(criada);
  })
);

rotasMidia.put(
  '/hero-imagens/:id',
  rota(async (req, res) => {
    const dados = montar(req.body || {}, { parcial: true });
    const atualizada = await prisma.heroImagem.update({
      where: { id: id(req.params.id) },
      data: dados,
    });
    res.json(atualizada);
  })
);

rotasMidia.delete(
  '/hero-imagens/:id',
  rota(async (req, res) => {
    await prisma.heroImagem.delete({ where: { id: id(req.params.id) } });
    console.log('[admin] imagem de destaque removida:', req.params.id);
    res.json({ ok: true });
  })
);
