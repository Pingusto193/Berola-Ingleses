// Pagina de login isolada. Sucesso = navegacao real para /admin/painel,
// nao um "hidden = false" escondido na mesma pagina.
import * as api from './api.js';
import { saindoComCirculo, chegandoComCirculo } from './transicao.js';

const $ = (id) => document.getElementById(id);

// A pagina chegou coberta pelo circulo (veio do botao escondido do site, ou
// de qualquer navegacao pra ca) - encolhe e revela o formulario de login.
chegandoComCirculo();

// Se ja tiver sessao valida, nem mostra o formulario - vai direto pro painel
try {
  const { logado } = await api.verificarSessao();
  if (logado) {
    window.location.replace('/admin/painel');
  } else {
    $('tela-login').hidden = false;
  }
} catch {
  $('tela-login').hidden = false;
}

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const erro = $('login-erro');
  erro.hidden = true;
  const botao = $('btn-entrar');
  const original = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Entrando…';
  try {
    await api.login($('usuario').value, $('senha').value);
    // Senha certa: a mesma transicao de circulo, agora saindo do botao
    // "Entrar", cobre a tela e revela o painel do outro lado.
    const caixa = botao.getBoundingClientRect();
    saindoComCirculo(
      { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 },
      '/admin/painel'
    );
  } catch (err) {
    erro.textContent = err.message || 'Não consegui entrar';
    erro.hidden = false;
    botao.disabled = false;
    botao.textContent = original;
  }
});
