// ============================================================================
// Validacao e sanitizacao das entradas.
//
// O BACKEND e a fonte de verdade: nada aqui confia no que o painel mandou.
// Cada helper devolve o valor ja normalizado, ou lanca ErroValidacao, que o
// tratador de rota converte em HTTP 400 com uma mensagem util.
// ============================================================================

export class ErroValidacao extends Error {
  constructor(mensagem, campo) {
    super(mensagem);
    this.nome = 'ErroValidacao';
    this.status = 400;
    this.campo = campo;
  }
}

const ausente = (v) => v === undefined || v === null;

// Remove caracteres de controle (inclusive \0) que nao tem uso em texto vindo
// de formulario e podem baguncar log e renderizacao.
function limpar(texto) {
  let saida = String();
  for (const ch of texto) {
    const cod = ch.codePointAt(0);
    if (cod > 31 && cod !== 127) saida += ch;
  }
  return saida.trim();
}

export function texto(valor, campo, { min = 0, max = 2000, obrigatorio = false, padrao = '' } = {}) {
  if (ausente(valor) || valor === '') {
    if (obrigatorio) throw new ErroValidacao(`"${campo}" é obrigatório`, campo);
    return padrao;
  }
  if (typeof valor !== 'string') {
    throw new ErroValidacao(`"${campo}" deve ser texto`, campo);
  }
  const limpo = limpar(valor);
  if (limpo.length < min) {
    throw new ErroValidacao(`"${campo}" precisa de pelo menos ${min} caracteres`, campo);
  }
  if (limpo.length > max) {
    throw new ErroValidacao(`"${campo}" passa de ${max} caracteres`, campo);
  }
  return limpo;
}

export function inteiro(valor, campo, { min = -2147483648, max = 2147483647, padrao = 0 } = {}) {
  if (ausente(valor) || valor === '') return padrao;
  const n = typeof valor === 'number' ? valor : Number(String(valor).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new ErroValidacao(`"${campo}" deve ser um número inteiro`, campo);
  }
  if (n < min) throw new ErroValidacao(`"${campo}" não pode ser menor que ${min}`, campo);
  if (n > max) throw new ErroValidacao(`"${campo}" não pode ser maior que ${max}`, campo);
  return n;
}

export function booleano(valor, campo, padrao = false) {
  if (ausente(valor) || valor === '') return padrao;
  if (typeof valor === 'boolean') return valor;
  if (valor === 'true' || valor === 1 || valor === '1') return true;
  if (valor === 'false' || valor === 0 || valor === '0') return false;
  throw new ErroValidacao(`"${campo}" deve ser verdadeiro ou falso`, campo);
}

// Aceita http/https (links externos), mailto/tel (contato) e caminho interno
// comecando com / (uploads e ancoras do proprio site). Bloqueia javascript:
// e data:, que sao os vetores de XSS quando o link vai parar num href.
export function url(valor, campo, { obrigatorio = false } = {}) {
  if (ausente(valor) || valor === '') {
    if (obrigatorio) throw new ErroValidacao(`"${campo}" é obrigatório`, campo);
    return null;
  }
  if (typeof valor !== 'string') {
    throw new ErroValidacao(`"${campo}" deve ser texto`, campo);
  }
  const limpo = limpar(valor);
  if (limpo.length > 2048) {
    throw new ErroValidacao(`"${campo}" é longo demais`, campo);
  }
  if (limpo.startsWith('/') || limpo.startsWith('#')) return limpo;

  let parsed;
  try {
    parsed = new URL(limpo);
  } catch {
    throw new ErroValidacao(`"${campo}" não é um link válido`, campo);
  }
  const PROTOCOLOS_OK = ['http:', 'https:', 'mailto:', 'tel:'];
  if (!PROTOCOLOS_OK.includes(parsed.protocol)) {
    throw new ErroValidacao(`"${campo}" usa um protocolo não permitido`, campo);
  }
  return limpo;
}

// Aceita "18,90", "18.90", "R$ 18,90" ou 1890 (ja em centavos vindo do painel).
// Devolve SEMPRE centavos, como inteiro.
export function precoCentavos(valor, campo, { obrigatorio = false } = {}) {
  if (ausente(valor) || valor === '') {
    if (obrigatorio) throw new ErroValidacao(`"${campo}" é obrigatório`, campo);
    return 0;
  }
  if (typeof valor === 'number') {
    if (!Number.isInteger(valor)) {
      throw new ErroValidacao(`"${campo}" deve vir em centavos (inteiro)`, campo);
    }
    if (valor < 0) throw new ErroValidacao(`"${campo}" não pode ser negativo`, campo);
    if (valor > 100000000) throw new ErroValidacao(`"${campo}" é alto demais`, campo);
    return valor;
  }

  const bruto = String(valor).replace(/[R$\s]/gi, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(bruto)) {
    throw new ErroValidacao(`"${campo}" deve ser um valor como 18,90`, campo);
  }
  const centavos = Math.round(Number(bruto) * 100);
  if (centavos < 0) throw new ErroValidacao(`"${campo}" não pode ser negativo`, campo);
  if (centavos > 100000000) throw new ErroValidacao(`"${campo}" é alto demais`, campo);
  return centavos;
}

export function id(valor, campo = 'id') {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) {
    throw new ErroValidacao(`"${campo}" inválido`, campo);
  }
  return n;
}

// "08:00" - usado nos horarios de funcionamento
export function hora(valor, campo, padrao = '00:00') {
  if (ausente(valor) || valor === '') return padrao;
  const limpo = String(valor).trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(limpo)) {
    throw new ErroValidacao(`"${campo}" deve estar no formato HH:MM`, campo);
  }
  return limpo;
}

// Envolve um handler async: erro de validacao vira 400 com mensagem,
// qualquer outro vira 500 generico (sem vazar stack trace pro cliente).
export function rota(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      if (e instanceof ErroValidacao) {
        return res.status(400).json({ erro: e.message, campo: e.campo });
      }
      // Erros conhecidos do Prisma que merecem status proprio
      if (e?.code === 'P2025') {
        return res.status(404).json({ erro: 'Registro não encontrado' });
      }
      if (e?.code === 'P2002') {
        return res.status(409).json({ erro: 'Já existe um registro com esse valor' });
      }
      if (e?.code === 'P2003') {
        return res.status(409).json({ erro: 'Existe outro registro dependendo deste' });
      }
      console.error('[erro]', req.method, req.path, '-', e?.message || e);
      res.status(500).json({ erro: 'Erro interno do servidor' });
    }
  };
}

// Preco OPCIONAL: campo vazio vira null ("esse destaque nao tem preco"), que e
// diferente de 0 (que seria "de graca"). Fora isso, mesmas regras de
// precoCentavos - devolve sempre centavos como inteiro.
export function precoOpcional(valor, campo) {
  if (ausente(valor) || String(valor).trim() === '') return null;
  return precoCentavos(valor, campo);
}
