// ============================================================================
// Popula o banco com o conteudo inicial.
//
// Idempotente: pode rodar quantas vezes quiser sem duplicar nada nem
// sobrescrever o que o admin ja editou pelo painel.
//
// As imagens ficam null de proposito - e isso que faz o site renderizar os
// placeholders tracejados no lugar das fotos.
// ============================================================================
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { hashSenha, gerarSenhaForte, TAMANHO_MINIMO_SENHA } from '../lib/seguranca.js';

async function semearAdmin() {
  const usuario = process.env.ADMIN_USER || 'admin';
  const jaExiste = await prisma.adminUser.findUnique({ where: { usuario } });

  if (jaExiste) {
    console.log(`Admin "${usuario}" já existe — senha preservada.`);
    return null;
  }

  let senha = process.env.ADMIN_PASSWORD;
  let gerada = false;

  if (!senha || senha.length < TAMANHO_MINIMO_SENHA) {
    if (senha) {
      console.warn(
        `ADMIN_PASSWORD tem ${senha.length} caracteres — o mínimo é ${TAMANHO_MINIMO_SENHA}. Gerando uma senha forte.`
      );
    }
    senha = gerarSenhaForte(32);
    gerada = true;
  }

  await prisma.adminUser.create({
    data: { usuario, senhaHash: await hashSenha(senha) },
  });

  console.log(`Admin "${usuario}" criado.`);
  return gerada ? senha : null;
}

async function semearConteudo() {
  await prisma.siteConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ctaHeaderTexto: 'Peça Agora', ctaHeaderLink: '#cardapio' },
  });

  await prisma.hero.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      headline: 'Café fresquinho,\naqui nos Ingleses',
      subtitulo:
        'Um espaço no bairro Ingleses pra tomar um bom café, com calma, do jeito que você gosta.',
      textoBotao: 'Ver Cardápio',
      linkBotao: '#cardapio',
    },
  });

  if ((await prisma.destaque.count()) === 0) {
    await prisma.destaque.createMany({
      data: [
        {
          titulo: 'Café de Verdade',
          texto: 'Grãos selecionados e torra fresca. Do espresso curto ao coado lento, feito na hora pra você.',
          textoBotao: 'Ver Cardápio', linkBotao: '#cardapio', ordem: 1,
        },
        {
          titulo: 'Ambiente Gostoso',
          texto: 'Um espaço tranquilo pra tomar um café com calma, sozinho, com amigos ou pra trabalhar um pouco.',
          textoBotao: 'Saiba Mais', linkBotao: '#sobre', ordem: 2,
        },
        {
          titulo: 'Feito na Casa',
          texto: 'Bolos, salgados e doces preparados aqui todo dia. O cheiro na porta já entrega.',
          textoBotao: 'Ver Cardápio', linkBotao: '#cardapio', ordem: 3,
        },
      ],
    });
  }

  await prisma.visiteAGente.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      titulo: 'Visite a gente hoje',
      texto:
        'Estamos nos Ingleses, pertinho da praia. Passa aqui pra tomar um café, trabalhar um pouco ou só relaxar.\n\nTem wi-fi, tem tomada e tem gente boa.',
      textoBotao: 'Como Chegar',
      linkBotao: '#contato',
    },
  });

  if ((await prisma.visiteImagem.count()) === 0) {
    await prisma.visiteImagem.createMany({
      data: [
        { altText: 'Foto da fachada da cafeteria', ordem: 1 },
        { altText: 'Foto do salão interno', ordem: 2 },
        { altText: 'Foto do balcão', ordem: 3 },
      ],
    });
  }

  if ((await prisma.galeriaItem.count()) === 0) {
    await prisma.galeriaItem.createMany({
      data: [
        { altText: 'Foto do ambiente', ordem: 1 },
        { altText: 'Foto de um café', ordem: 2 },
        { altText: 'Foto de um doce da casa', ordem: 3 },
        { altText: 'Foto da mesa de conversação', ordem: 4 },
        { altText: 'Foto do balcão de doces', ordem: 5 },
        { altText: 'Foto da varanda', ordem: 6 },
      ],
    });
  }

  if ((await prisma.heroImagem.count()) === 0) {
    await prisma.heroImagem.createMany({
      // Sem foto eles nao aparecem no site - servem so pra mostrar ao dono
      // onde ficam os destaques do inicio quando ele abrir o painel.
      data: [
        { nome: 'Seu produto em destaque', tipo: 'destaque', altText: 'Primeiro destaque do início', ordem: 1 },
        { nome: 'Uma promoção da casa', tipo: 'promocao', altText: 'Segundo destaque do início', ordem: 2 },
      ],
    });
  }
}

async function semearEstabelecimento() {
  await prisma.restaurante.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nome: 'Berola Ingleses',
      sobre: 'Cafeteria no bairro Ingleses, em Florianópolis.',
      endereco: 'Rua das Gaivotas, 000 — Ingleses, Florianópolis/SC',
      mapaUrl: null,
    },
  });

  if ((await prisma.contato.count()) === 0) {
    await prisma.contato.createMany({
      data: [
        { tipo: 'whatsapp', rotulo: 'WhatsApp', valor: '(48) 99999-9999', link: 'https://wa.me/5548999999999', ordem: 1 },
        { tipo: 'instagram', rotulo: 'Instagram', valor: '@berolaingleses', link: 'https://instagram.com/berolaingleses', ordem: 2 },
        { tipo: 'telefone', rotulo: 'Telefone', valor: '(48) 3333-3333', link: 'tel:+554833333333', ordem: 3 },
        { tipo: 'endereco', rotulo: 'Endereço', valor: 'Rua das Gaivotas, 000 — Ingleses, Florianópolis/SC', ordem: 4 },
        { tipo: 'ifood', rotulo: 'iFood', valor: 'Peça pelo delivery', link: null, ativo: false, ordem: 5 },
      ],
    });
  }

  if ((await prisma.horarioFuncionamento.count()) === 0) {
    // 0 = domingo ... 6 = sabado
    for (let dia = 0; dia <= 6; dia++) {
      await prisma.horarioFuncionamento.create({
        data: {
          diaSemana: dia,
          aberto: dia !== 0,
          abreEm: dia === 6 ? '09:00' : '08:00',
          fechaEm: dia === 6 ? '18:00' : '19:00',
        },
      });
    }
  }
}

async function semearCardapio() {
  if ((await prisma.categoria.count()) > 0) {
    console.log('Cardápio já tem categorias — nada a semear.');
    return;
  }

  const categorias = [
    { nome: 'Cafés', descricao: 'Do espresso ao coado, sempre na hora.', ordem: 1 },
    { nome: 'Doces', descricao: 'Feitos aqui, todo dia.', ordem: 2 },
    { nome: 'Sucos', descricao: 'Fruta de verdade, sem xarope.', ordem: 3 },
    { nome: 'Breakfast', descricao: 'Pra começar o dia com calma.', ordem: 4 },
  ];

  const criadas = {};
  for (const c of categorias) {
    const cat = await prisma.categoria.create({ data: c });
    criadas[cat.nome] = cat.id;
  }

  // precoCentavos: 1890 = R$ 18,90
  await prisma.produto.createMany({
    data: [
      { nome: 'Cappuccino', descricao: 'Espresso, leite vaporizado e canela.', precoCentavos: 1890, destaque: true, ordem: 1, categoriaId: criadas['Cafés'] },
      { nome: 'Espresso', descricao: 'Curto, intenso, do jeito certo.', precoCentavos: 900, ordem: 2, categoriaId: criadas['Cafés'] },
      { nome: 'Latte', descricao: 'Mais leite, menos amargor.', precoCentavos: 1690, ordem: 3, categoriaId: criadas['Cafés'] },
      { nome: 'Mocha', descricao: 'Café com chocolate meio amargo.', precoCentavos: 2090, ordem: 4, categoriaId: criadas['Cafés'] },

      { nome: 'Cheesecake', descricao: 'Com calda de frutas vermelhas.', precoCentavos: 2400, destaque: true, ordem: 1, categoriaId: criadas['Doces'] },
      { nome: 'Brownie', descricao: 'Denso, com nozes.', precoCentavos: 1600, ordem: 2, categoriaId: criadas['Doces'] },
      { nome: 'Cookie', descricao: 'Gotas de chocolate, macio no meio.', precoCentavos: 1200, disponivel: false, ordem: 3, categoriaId: criadas['Doces'] },

      { nome: 'Suco de Laranja', descricao: 'Espremido na hora.', precoCentavos: 1400, ordem: 1, categoriaId: criadas['Sucos'] },
      { nome: 'Limonada Suíça', descricao: 'Gelada, com leite condensado.', precoCentavos: 1600, ordem: 2, categoriaId: criadas['Sucos'] },

      { nome: 'Tostex Misto', descricao: 'Pão na chapa, queijo e presunto.', precoCentavos: 1900, ordem: 1, categoriaId: criadas['Breakfast'] },
      { nome: 'Ovos Mexidos', descricao: 'Com torrada e manteiga.', precoCentavos: 2200, destaque: true, ordem: 2, categoriaId: criadas['Breakfast'] },
    ],
  });

  console.log('Cardápio de exemplo criado (4 categorias, 11 produtos).');
}

async function main() {
  const senhaGerada = await semearAdmin();
  await semearConteudo();
  await semearEstabelecimento();
  await semearCardapio();

  console.log('\nSeed concluído.');

  if (senhaGerada) {
    console.log('\n' + '='.repeat(64));
    console.log('  SENHA DO ADMIN GERADA — guarde agora, não aparece de novo:');
    console.log('  usuário: ' + (process.env.ADMIN_USER || 'admin'));
    console.log('  senha:   ' + senhaGerada);
    console.log('  Coloque em ADMIN_PASSWORD no .env se quiser reaproveitar.');
    console.log('='.repeat(64) + '\n');
  }
}

main()
  .catch((e) => {
    console.error('Falha no seed:', e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
