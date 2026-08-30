import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { verificarSenha } from '../lib/seguranca.js';
import { texto } from '../lib/validacao.js';
import {
  criarSessao,
  encerrarSessao,
  sessaoAtual,
  verificarLimite,
  registrarFalha,
  limparFalhas,
} from '../middleware/auth.js';

export const rotasAuth = Router();

// Mensagem unica para usuario inexistente E senha errada: revelar qual dos
// dois falhou entrega ao atacante quais usuarios existem.
const CREDENCIAL_INVALIDA = 'Usuário ou senha incorretos';

rotasAuth.post('/login', async (req, res) => {
  try {
    const limite = verificarLimite(req);
    if (limite.bloqueado) {
      return res.status(429).json({
        erro: `Muitas tentativas. Tente de novo em ${Math.ceil(limite.segundos / 60)} min.`,
      });
    }

    let usuario;
    let senha;
    try {
      usuario = texto(req.body?.usuario, 'usuário', { max: 100, obrigatorio: true });
      senha = texto(req.body?.senha, 'senha', { max: 200, obrigatorio: true });
    } catch {
      registrarFalha(req);
      return res.status(401).json({ erro: CREDENCIAL_INVALIDA });
    }

    const admin = await prisma.adminUser.findUnique({ where: { usuario } });

    // Mesmo sem o usuario existir, roda uma verificacao falsa para o tempo de
    // resposta nao denunciar quais usuarios estao cadastrados.
    const hashParaComparar = admin?.senhaHash ?? 'scrypt$32768$8$1$00$00';
    const ok = await verificarSenha(senha, hashParaComparar);

    if (!admin || !ok) {
      registrarFalha(req);
      // Log sem senha, sem token - so o usuario tentado
      console.warn('[auth] login recusado para usuário:', usuario);
      return res.status(401).json({ erro: CREDENCIAL_INVALIDA });
    }

    limparFalhas(req);
    criarSessao(res, admin.usuario);
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { ultimoLogin: new Date() },
    });

    res.json({ ok: true, usuario: admin.usuario });
  } catch (e) {
    console.error('[auth] erro no login:', e?.message || e);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

rotasAuth.post('/logout', (req, res) => {
  encerrarSessao(req, res);
  res.json({ ok: true });
});

rotasAuth.get('/me', (req, res) => {
  const sessao = sessaoAtual(req);
  res.json({ logado: Boolean(sessao), usuario: sessao?.usuario ?? null });
});
