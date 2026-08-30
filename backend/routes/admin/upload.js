// ============================================================================
// Upload de midia.
//
// O arquivo chega como base64 no corpo do JSON (sem multer, sem dependencia
// nova). Quando o Supabase Storage entrar, este arquivo some e o upload vai
// direto do browser pro bucket.
//
// SEGURANCA: o `tipo` que o browser manda NAO e confiavel - qualquer cliente
// pode dizer que um .exe e "image/png". Por isso o tipo declarado e conferido
// contra os magic bytes reais do conteudo, e a extensao gravada em disco vem
// do que foi detectado, nunca do nome original do arquivo.
// ============================================================================
import { Router } from 'express';
import { writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ErroValidacao, rota } from '../../lib/validacao.js';

export const rotasUpload = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PASTA_UPLOADS = path.join(__dirname, '..', '..', 'uploads');

const LIMITE_IMAGEM = 8 * 1024 * 1024; // 8MB
const LIMITE_VIDEO = 12 * 1024 * 1024; // 12MB

// Cada formato tem uma assinatura no inicio do arquivo. Se o conteudo nao
// bater com nenhuma delas, o upload e recusado.
const ASSINATURAS = [
  {
    mime: 'image/jpeg',
    ext: '.jpg',
    tipo: 'imagem',
    testar: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    ext: '.png',
    tipo: 'imagem',
    testar: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: 'image/webp',
    ext: '.webp',
    tipo: 'imagem',
    testar: (b) =>
      b.slice(0, 4).toString('latin1') === 'RIFF' &&
      b.slice(8, 12).toString('latin1') === 'WEBP',
  },
  {
    mime: 'image/gif',
    ext: '.gif',
    tipo: 'imagem',
    testar: (b) => {
      const cabecalho = b.slice(0, 6).toString('latin1');
      return cabecalho === 'GIF87a' || cabecalho === 'GIF89a';
    },
  },
  {
    mime: 'video/mp4',
    ext: '.mp4',
    tipo: 'video',
    testar: (b) => b.slice(4, 8).toString('latin1') === 'ftyp',
  },
  {
    mime: 'video/webm',
    ext: '.webm',
    tipo: 'video',
    testar: (b) =>
      b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  },
];

function detectar(buffer) {
  if (buffer.length < 16) return null;
  return ASSINATURAS.find((a) => a.testar(buffer)) ?? null;
}

rotasUpload.post(
  '/upload',
  rota(async (req, res) => {
    const { dados, tipo } = req.body || {};

    if (typeof dados !== 'string' || dados.length === 0) {
      throw new ErroValidacao('Nenhum arquivo recebido', 'dados');
    }
    // Base64 cresce ~33%; corta cedo o que obviamente estoura o limite,
    // antes de gastar memoria decodificando.
    if (dados.length > LIMITE_VIDEO * 1.4) {
      return res.status(413).json({ erro: 'Arquivo grande demais' });
    }

    let buffer;
    try {
      buffer = Buffer.from(dados, 'base64');
    } catch {
      throw new ErroValidacao('Arquivo corrompido', 'dados');
    }

    const detectado = detectar(buffer);
    if (!detectado) {
      throw new ErroValidacao(
        'Formato não suportado. Envie JPG, PNG, WebP, GIF, MP4 ou WebM.',
        'dados'
      );
    }

    // O tipo declarado pelo cliente tem que bater com o conteudo real
    if (tipo && tipo !== detectado.mime) {
      console.warn(
        '[upload] tipo declarado (%s) diferente do detectado (%s) - recusado',
        String(tipo).slice(0, 40),
        detectado.mime
      );
      throw new ErroValidacao('O arquivo não corresponde ao tipo informado', 'tipo');
    }

    const limite = detectado.tipo === 'video' ? LIMITE_VIDEO : LIMITE_IMAGEM;
    if (buffer.length > limite) {
      return res.status(413).json({
        erro: `Arquivo acima de ${Math.round(limite / 1024 / 1024)}MB`,
      });
    }

    await mkdir(PASTA_UPLOADS, { recursive: true });
    // Nome aleatorio + extensao detectada: o nome original do usuario nunca
    // toca o sistema de arquivos (evita path traversal e extensao dupla).
    const nome = randomBytes(16).toString('hex') + detectado.ext;
    await writeFile(path.join(PASTA_UPLOADS, nome), buffer);

    console.log('[upload] %s (%s, %dKB)', nome, detectado.mime, Math.round(buffer.length / 1024));

    res.status(201).json({
      url: '/uploads/' + nome,
      mime: detectado.mime,
      bytes: buffer.length,
    });
  })
);

// PENDENCIA documentada: nao ha recompressao/redimensionamento no servidor.
// Fazer isso exige sharp (binario nativo pesado) ou um servico externo. Por
// enquanto o limite de tamanho segura o pior caso, e o painel avisa o usuario.
// Quando o Supabase Storage entrar, ele ja oferece transformacao de imagem
// na propria URL, o que resolve isso sem dependencia nova.
