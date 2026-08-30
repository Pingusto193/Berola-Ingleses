import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rotasPublicas } from './routes/publico.js';
import { rotasAuth } from './routes/auth.js';
import { rotasAdmin } from './routes/admin/index.js';
import { exigirAuth } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;

// req.ip confiavel atras de proxy (Render, nginx) - o rate limit do login
// depende disso para nao bloquear todo mundo pelo IP do proxy.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Mesma origem serve site e API, entao CORS fica restrito.
// Se um front separado for hospedado depois, liste a origem dele aqui.
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  })
);

// Cabecalhos de seguranca basicos (sem depender de helmet)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Limite alto porque o upload do admin chega como base64 no corpo do JSON.
// A validacao real de tamanho/tipo acontece em routes/admin/upload.js.
app.use(express.json({ limit: '20mb' }));

// Corpo JSON malformado vira 400, nao 500
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ erro: 'JSON inválido' });
  }
  next(err);
});

// ------------------------------------------------------------------- Rotas

app.use('/api/auth', rotasAuth);
app.use('/api/admin', exigirAuth, rotasAdmin);
app.use('/api', rotasPublicas);

// Midia enviada pelo painel
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    // Nada aqui deve ser executado como script pelo browser
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  })
);

// Site publico
app.use(express.static(path.join(RAIZ, 'frontend')));

// /admin = so a tela de login. /admin/painel = o dashboard, pagina separada
// de verdade (navegacao real, nao div escondida). Quem esta logado e decidido
// pela API, nao por estas rotas - servir o HTML nao expoe dado nenhum; o
// proprio painel.js confere a sessao ao carregar e manda pra /admin se nao
// houver uma.
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(RAIZ, 'frontend', 'admin.html'));
});
app.get('/admin/painel', (_req, res) => {
  res.sendFile(path.join(RAIZ, 'frontend', 'painel.html'));
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ erro: 'Rota não encontrada' });
  }
  res.sendFile(path.join(RAIZ, 'frontend', 'index.html'));
});

// Rede de seguranca: qualquer erro nao tratado vira 500 generico.
// O detalhe fica no log do servidor, nunca na resposta ao cliente.
app.use((err, req, res, _next) => {
  console.error('[erro]', req.method, req.path, '-', err?.message || err);
  if (res.headersSent) return;
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log('Berola Ingleses rodando em http://localhost:' + PORT);
});
