// ============================================================================
// Hash de senha e geracao de segredos.
//
// Usa scrypt do proprio Node (node:crypto) - nao precisa de bcrypt/argon2 como
// dependencia externa. scrypt e uma KDF com custo de memoria, desenhada
// exatamente para senha, e e o que o Node oferece nativamente.
//
// Formato do hash guardado no banco:
//   scrypt$<N>$<r>$<p>$<salt em hex>$<derivado em hex>
// Os parametros ficam DENTRO do hash, entao da pra endurecer o custo no futuro
// sem invalidar as senhas antigas.
// ============================================================================
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// N=2^15 e o ponto de equilibrio recomendado para login interativo:
// ~100ms por verificacao, caro o bastante para forca bruta offline.
const CUSTO = { N: 32768, r: 8, p: 1 };
const TAMANHO_CHAVE = 64;

export async function hashSenha(senha) {
  if (typeof senha !== 'string' || senha.length === 0) {
    throw new Error('Senha inválida');
  }
  const salt = randomBytes(16);
  const derivado = await scryptAsync(senha, salt, TAMANHO_CHAVE, {
    ...CUSTO,
    maxmem: 256 * 1024 * 1024,
  });
  return [
    'scrypt',
    CUSTO.N,
    CUSTO.r,
    CUSTO.p,
    salt.toString('hex'),
    derivado.toString('hex'),
  ].join('$');
}

export async function verificarSenha(senha, hashGuardado) {
  if (typeof senha !== 'string' || typeof hashGuardado !== 'string') return false;

  const partes = hashGuardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, n, r, p, saltHex, derivadoHex] = partes;
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const esperado = Buffer.from(derivadoHex, 'hex');
    const calculado = await scryptAsync(senha, salt, esperado.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 256 * 1024 * 1024,
    });
    // timingSafeEqual: comparacao em tempo constante, nao vaza o prefixo certo
    return timingSafeEqual(calculado, esperado);
  } catch {
    return false;
  }
}

// Alfabeto sem caracteres ambiguos (0/O, 1/l/I) para a senha poder ser
// digitada a mao sem erro.
const ALFABETO = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_';

export function gerarSenhaForte(tamanho = 32) {
  const bytes = randomBytes(tamanho * 2);
  let saida = '';
  for (let i = 0; saida.length < tamanho; i++) {
    // Descarta valores que cairiam fora de um multiplo do alfabeto,
    // senao os primeiros caracteres ficariam mais provaveis (modulo bias).
    const b = bytes[i % bytes.length];
    const limite = 256 - (256 % ALFABETO.length);
    if (b >= limite) continue;
    saida += ALFABETO[b % ALFABETO.length];
  }
  return saida;
}

export const TAMANHO_MINIMO_SENHA = 24;
