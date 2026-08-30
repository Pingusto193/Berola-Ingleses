// ============================================================================
// Sessao do painel administrativo.
//
// A senha vive no banco como hash scrypt (ver lib/seguranca.js) - nunca em
// texto puro, nunca no frontend, nunca no log.
//
// A sessao e um token aleatorio de 256 bits guardado em memoria com prazo de
// validade, entregue como cookie httpOnly. Em memoria significa que reiniciar
// o servidor desloga todo mundo, o que e aceitavel aqui e some quando o
// Supabase Auth entrar no lugar.
// ============================================================================
import { randomBytes } from 'node:crypto';

const COOKIE = 'berola_admin';
const DURACAO_SESSAO = 1000 * 60 * 60 * 8; // 8 horas

// token -> { usuario, expiraEm }
const sessoes = new Map();

// Limpa sessoes vencidas de tempos em tempos para a memoria nao crescer sem fim
const LIMPEZA = setInterval(() => {
  const agora = Date.now();
  for (const [token, dados] of sessoes) {
    if (dados.expiraEm <= agora) sessoes.delete(token);
  }
}, 1000 * 60 * 10);
LIMPEZA.unref?.();

export function criarSessao(res, usuario) {
  const token = randomBytes(32).toString('hex');
  sessoes.set(token, { usuario, expiraEm: Date.now() + DURACAO_SESSAO });
  res.cookie(COOKIE, token, {
    httpOnly: true,               // JS da pagina nao le o cookie
    sameSite: 'strict',           // nao viaja em requisicao de outro site (CSRF)
    secure: process.env.NODE_ENV === 'producao',
    maxAge: DURACAO_SESSAO,
    path: '/',
  });
  return token;
}

export function encerrarSessao(req, res) {
  const token = lerCookie(req, COOKIE);
  if (token) sessoes.delete(token);
  res.clearCookie(COOKIE, { path: '/' });
}

export function sessaoAtual(req) {
  const token = lerCookie(req, COOKIE);
  if (!token) return null;
  const dados = sessoes.get(token);
  if (!dados) return null;
  if (dados.expiraEm <= Date.now()) {
    sessoes.delete(token);
    return null;
  }
  return dados;
}

// Parser de cookie manual - evita a dependencia cookie-parser
function lerCookie(req, nome) {
  const bruto = req.headers.cookie;
  if (!bruto) return null;
  for (const parte of bruto.split(';')) {
    const [chave, ...resto] = parte.trim().split('=');
    if (chave === nome) return decodeURIComponent(resto.join('='));
  }
  return null;
}

export function exigirAuth(req, res, next) {
  const sessao = sessaoAtual(req);
  if (!sessao) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }
  req.admin = { usuario: sessao.usuario };
  next();
}

// ---------------------------------------------------------------------------
// Rate limiting do login
//
// Janela deslizante por IP. Depois de MAX_TENTATIVAS erros o IP fica bloqueado
// por BLOQUEIO_MS. Um login bem-sucedido zera o contador.
// ---------------------------------------------------------------------------

const MAX_TENTATIVAS = 5;
const JANELA_MS = 1000 * 60 * 15;
const BLOQUEIO_MS = 1000 * 60 * 15;

// ip -> { tentativas, primeiraEm, bloqueadoAte }
const tentativas = new Map();

const LIMPEZA_TENTATIVAS = setInterval(() => {
  const agora = Date.now();
  for (const [ip, dados] of tentativas) {
    const vencido = agora - dados.primeiraEm > JANELA_MS;
    const desbloqueado = !dados.bloqueadoAte || dados.bloqueadoAte <= agora;
    if (vencido && desbloqueado) tentativas.delete(ip);
  }
}, 1000 * 60 * 5);
LIMPEZA_TENTATIVAS.unref?.();

function chaveIp(req) {
  return req.ip || req.socket?.remoteAddress || 'desconhecido';
}

export function verificarLimite(req) {
  const dados = tentativas.get(chaveIp(req));
  if (!dados?.bloqueadoAte) return { bloqueado: false };
  const restante = dados.bloqueadoAte - Date.now();
  if (restante <= 0) return { bloqueado: false };
  return { bloqueado: true, segundos: Math.ceil(restante / 1000) };
}

export function registrarFalha(req) {
  const ip = chaveIp(req);
  const agora = Date.now();
  const dados = tentativas.get(ip);

  if (!dados || agora - dados.primeiraEm > JANELA_MS) {
    tentativas.set(ip, { tentativas: 1, primeiraEm: agora, bloqueadoAte: null });
    return;
  }
  dados.tentativas += 1;
  if (dados.tentativas >= MAX_TENTATIVAS) {
    dados.bloqueadoAte = agora + BLOQUEIO_MS;
    dados.tentativas = 0;
    dados.primeiraEm = agora;
  }
}

export function limparFalhas(req) {
  tentativas.delete(chaveIp(req));
}
