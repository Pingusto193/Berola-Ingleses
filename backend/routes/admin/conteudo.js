// Secoes de conteudo do site que ja existiam antes do CMS:
// botao do topo, hero, "visite a gente", cards de destaque e galeria.
import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { rota, texto, inteiro, url, id } from '../../lib/validacao.js';

export const rotasConteudo = Router();

rotasConteudo.put(
  '/config',
  rota(async (req, res) => {
    const corpo = req.body || {};
    const dados = {};
    if (corpo.ctaHeaderTexto !== undefined) {
      dados.ctaHeaderTexto = texto(corpo.ctaHeaderTexto, 'texto do botão', {
        min: 1, max: 40, obrigatorio: true,
      });
    }
    if (corpo.ctaHeaderLink !== undefined) {
      dados.ctaHeaderLink = url(corpo.ctaHeaderLink, 'link do botão') ?? '#contato';
    }
    if (corpo.tituloDestaques !== undefined) {
      dados.tituloDestaques = texto(corpo.tituloDestaques, 'título dos destaques', { min: 1, max: 100, obrigatorio: true });
    }
    if (corpo.subtituloDestaques !== undefined) {
      dados.subtituloDestaques = texto(corpo.subtituloDestaques, 'subtítulo dos destaques', { max: 300 });
    }
    if (corpo.tituloCardapio !== undefined) {
      dados.tituloCardapio = texto(corpo.tituloCardapio, 'título do cardápio', { min: 1, max: 100, obrigatorio: true });
    }
    if (corpo.subtituloCardapio !== undefined) {
      dados.subtituloCardapio = texto(corpo.subtituloCardapio, 'subtítulo do cardápio', { max: 300 });
    }
    res.json(await prisma.siteConfig.update({ where: { id: 1 }, data: dados }));
  })
);

rotasConteudo.put(
  '/hero',
  rota(async (req, res) => {
    const corpo = req.body || {};
    const dados = {};
    if (corpo.headline !== undefined) {
      dados.headline = texto(corpo.headline, 'título', { min: 1, max: 200, obrigatorio: true });
    }
    if (corpo.subtitulo !== undefined) {
      dados.subtitulo = texto(corpo.subtitulo, 'subtítulo', { max: 500 });
    }
    if (corpo.textoBotao !== undefined) {
      dados.textoBotao = texto(corpo.textoBotao, 'texto do botão', { max: 40 });
    }
    if (corpo.linkBotao !== undefined) {
      dados.linkBotao = url(corpo.linkBotao, 'link do botão') ?? '#contato';
    }
    if (corpo.videoUrl !== undefined) {
      dados.videoUrl = url(corpo.videoUrl, 'vídeo');
    }
    if (corpo.imagemFallbackUrl !== undefined) {
      dados.imagemFallbackUrl = url(corpo.imagemFallbackUrl, 'imagem de fallback');
    }
    res.json(await prisma.hero.update({ where: { id: 1 }, data: dados }));
  })
);

rotasConteudo.put(
  '/visite',
  rota(async (req, res) => {
    const corpo = req.body || {};
    const dados = {};
    if (corpo.titulo !== undefined) {
      dados.titulo = texto(corpo.titulo, 'título', { min: 1, max: 120, obrigatorio: true });
    }
    if (corpo.texto !== undefined) {
      dados.texto = texto(corpo.texto, 'texto', { max: 2000 });
    }
    if (corpo.textoBotao !== undefined) {
      dados.textoBotao = texto(corpo.textoBotao, 'texto do botão', { max: 40 });
    }
    if (corpo.linkBotao !== undefined) {
      dados.linkBotao = url(corpo.linkBotao, 'link do botão') ?? '#contato';
    }
    res.json(await prisma.visiteAGente.update({ where: { id: 1 }, data: dados }));
  })
);

// Numero maximo de cards - protege o layout publico, nao e limite tecnico
// arbitrario (o grid de 3 colunas comeca a ficar ruim acima disso).
const MAX_DESTAQUES = 8;

rotasConteudo.post(
  '/destaques',
  rota(async (_req, res) => {
    const total = await prisma.destaque.count();
    if (total >= MAX_DESTAQUES) {
      return res.status(400).json({
        erro: `Máximo de ${MAX_DESTAQUES} cards. Remova um para adicionar outro.`,
      });
    }
    const ultimo = await prisma.destaque.findFirst({ orderBy: { ordem: 'desc' } });
    const criado = await prisma.destaque.create({
      data: {
        titulo: 'Novo destaque',
        texto: '',
        textoBotao: 'Saiba Mais',
        linkBotao: '#cardapio',
        ordem: (ultimo?.ordem ?? 0) + 1,
      },
    });
    res.status(201).json(criado);
  })
);

rotasConteudo.delete(
  '/destaques/:id',
  rota(async (req, res) => {
    await prisma.destaque.delete({ where: { id: id(req.params.id) } });
    res.json({ ok: true });
  })
);

rotasConteudo.put(
  '/destaques/:id',
  rota(async (req, res) => {
    const corpo = req.body || {};
    const dados = {};
    if (corpo.imagemUrl !== undefined) dados.imagemUrl = url(corpo.imagemUrl, 'imagem');
    if (corpo.altText !== undefined) {
      dados.altText = texto(corpo.altText, 'texto alternativo', { max: 200 });
    }
    if (corpo.titulo !== undefined) {
      dados.titulo = texto(corpo.titulo, 'título', { min: 1, max: 80, obrigatorio: true });
    }
    if (corpo.texto !== undefined) dados.texto = texto(corpo.texto, 'texto', { max: 600 });
    if (corpo.textoBotao !== undefined) {
      dados.textoBotao = texto(corpo.textoBotao, 'texto do botão', { max: 40 });
    }
    if (corpo.linkBotao !== undefined) {
      dados.linkBotao = url(corpo.linkBotao, 'link do botão') ?? '#cardapio';
    }
    if (corpo.ordem !== undefined) {
      dados.ordem = inteiro(corpo.ordem, 'ordem', { min: 0, max: 9999 });
    }
    res.json(await prisma.destaque.update({ where: { id: id(req.params.id) }, data: dados }));
  })
);

// Galeria e fotos da secao "Visite a gente" - mesmas operacoes, models diferentes
for (const [caminho, model, rotulo] of [
  ['galeria', 'galeriaItem', 'Foto da galeria'],
  ['visite-imagens', 'visiteImagem', 'Foto do local'],
]) {
  rotasConteudo.post(
    '/' + caminho,
    rota(async (_req, res) => {
      const ultimo = await prisma[model].findFirst({ orderBy: { ordem: 'desc' } });
      const criado = await prisma[model].create({
        data: { altText: rotulo, ordem: (ultimo?.ordem ?? 0) + 1 },
      });
      res.status(201).json(criado);
    })
  );

  rotasConteudo.put(
    '/' + caminho + '/:id',
    rota(async (req, res) => {
      const corpo = req.body || {};
      const dados = {};
      if (corpo.imagemUrl !== undefined) dados.imagemUrl = url(corpo.imagemUrl, 'imagem');
      if (corpo.altText !== undefined) {
        dados.altText = texto(corpo.altText, 'texto alternativo', { max: 200 });
      }
      if (corpo.ordem !== undefined) {
        dados.ordem = inteiro(corpo.ordem, 'ordem', { min: 0, max: 9999 });
      }
      res.json(await prisma[model].update({ where: { id: id(req.params.id) }, data: dados }));
    })
  );

  rotasConteudo.delete(
    '/' + caminho + '/:id',
    rota(async (req, res) => {
      await prisma[model].delete({ where: { id: id(req.params.id) } });
      res.json({ ok: true });
    })
  );
}
