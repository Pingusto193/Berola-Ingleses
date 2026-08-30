// Dados do estabelecimento: informacoes gerais, contatos e horarios.
import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { rota, texto, inteiro, booleano, url, id, hora } from '../../lib/validacao.js';

export const rotasEstabelecimento = Router();

// ------------------------------------------------------------- Restaurante

rotasEstabelecimento.get(
  '/restaurante',
  rota(async (_req, res) => {
    const dados = await prisma.restaurante.findUnique({ where: { id: 1 } });
    res.json(dados);
  })
);

rotasEstabelecimento.put(
  '/restaurante',
  rota(async (req, res) => {
    const corpo = req.body || {};
    const dados = {};
    if (corpo.nome !== undefined) {
      dados.nome = texto(corpo.nome, 'nome', { min: 1, max: 120, obrigatorio: true });
    }
    if (corpo.sobre !== undefined) {
      dados.sobre = texto(corpo.sobre, 'sobre', { max: 2000 });
    }
    if (corpo.endereco !== undefined) {
      dados.endereco = texto(corpo.endereco, 'endereço', { max: 300 });
    }
    if (corpo.mapaUrl !== undefined) {
      dados.mapaUrl = url(corpo.mapaUrl, 'link do mapa');
    }

    // upsert: se a linha 1 ainda nao existe, cria
    const salvo = await prisma.restaurante.upsert({
      where: { id: 1 },
      update: dados,
      create: { id: 1, ...dados },
    });
    res.json(salvo);
  })
);

// ---------------------------------------------------------------- Contatos

const TIPOS_CONHECIDOS = [
  'whatsapp', 'instagram', 'telefone', 'endereco',
  'horario', 'ifood', 'email', 'facebook', 'tiktok', 'outro',
];

function montarContato(corpo, { parcial = false } = {}) {
  const dados = {};
  const tem = (c) => corpo[c] !== undefined;

  if (!parcial || tem('tipo')) {
    const t = texto(corpo.tipo, 'tipo', { min: 1, max: 40, obrigatorio: true }).toLowerCase();
    // Tipo livre e permitido (o painel pode inventar "delivery"), mas fica
    // normalizado em minusculo para o front escolher o icone certo.
    dados.tipo = TIPOS_CONHECIDOS.includes(t) ? t : t.replace(/[^a-z0-9-]/g, '') || 'outro';
  }
  if (!parcial || tem('rotulo')) {
    dados.rotulo = texto(corpo.rotulo, 'rótulo', { min: 1, max: 60, obrigatorio: true });
  }
  if (!parcial || tem('valor')) {
    dados.valor = texto(corpo.valor, 'valor', { min: 1, max: 300, obrigatorio: true });
  }
  if (!parcial || tem('link')) {
    dados.link = url(corpo.link, 'link');
  }
  if (!parcial || tem('ativo')) {
    dados.ativo = booleano(corpo.ativo, 'ativo', true);
  }
  if (!parcial || tem('ordem')) {
    dados.ordem = inteiro(corpo.ordem, 'ordem', { min: 0, max: 9999 });
  }
  return dados;
}

rotasEstabelecimento.get(
  '/contatos',
  rota(async (_req, res) => {
    const contatos = await prisma.contato.findMany({
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
    });
    res.json(contatos);
  })
);

rotasEstabelecimento.post(
  '/contatos',
  rota(async (req, res) => {
    const dados = montarContato(req.body || {});
    if (req.body?.ordem === undefined) {
      const ultimo = await prisma.contato.findFirst({ orderBy: { ordem: 'desc' } });
      dados.ordem = (ultimo?.ordem ?? 0) + 1;
    }
    const criado = await prisma.contato.create({ data: dados });
    console.log('[admin] contato criado:', criado.id, criado.tipo);
    res.status(201).json(criado);
  })
);

rotasEstabelecimento.put(
  '/contatos/:id',
  rota(async (req, res) => {
    const idCon = id(req.params.id);
    const dados = montarContato(req.body || {}, { parcial: true });
    const atualizado = await prisma.contato.update({ where: { id: idCon }, data: dados });
    res.json(atualizado);
  })
);

// Contato nao tem historico que valha a pena preservar: aqui o delete e real.
rotasEstabelecimento.delete(
  '/contatos/:id',
  rota(async (req, res) => {
    await prisma.contato.delete({ where: { id: id(req.params.id) } });
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- Horarios

rotasEstabelecimento.get(
  '/horarios',
  rota(async (_req, res) => {
    const horarios = await prisma.horarioFuncionamento.findMany({
      orderBy: { diaSemana: 'asc' },
    });
    res.json(horarios);
  })
);

// Recebe os 7 dias de uma vez - e assim que o formulario do painel funciona
rotasEstabelecimento.put(
  '/horarios',
  rota(async (req, res) => {
    const lista = Array.isArray(req.body) ? req.body : req.body?.horarios;
    if (!Array.isArray(lista)) {
      return res.status(400).json({ erro: 'Envie a lista de horários' });
    }

    const salvos = [];
    for (const item of lista) {
      const dia = inteiro(item?.diaSemana, 'dia da semana', { min: 0, max: 6 });
      const dados = {
        aberto: booleano(item?.aberto, 'aberto', true),
        abreEm: hora(item?.abreEm, 'abertura', '08:00'),
        fechaEm: hora(item?.fechaEm, 'fechamento', '19:00'),
      };
      salvos.push(
        await prisma.horarioFuncionamento.upsert({
          where: { diaSemana: dia },
          update: dados,
          create: { diaSemana: dia, ...dados },
        })
      );
    }
    res.json(salvos.sort((a, b) => a.diaSemana - b.diaSemana));
  })
);
