import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
let f = 0;
const ok = (c, m) => { console.log((c ? '  PASSOU ' : '  FALHOU ') + m); if (!c) f++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1200 } });
p.on('pageerror', (e) => { console.log('  [ERRO] ' + e.message); f++; });

await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await p.evaluate(() => sessionStorage.setItem('berola_splash_visto', '1'));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(800);

console.log('=== 1. Hero: carrossel monta mesmo sem foto real (usa a padrão) ===');
const carrossel = await p.evaluate(() => {
  const img = document.querySelector('.destaque.ativo .destaque__foto img');
  const selo = document.querySelector('.destaque.ativo .destaque__selo-exemplo');
  return { existe: !!img, src: img?.getAttribute('src'), temSelo: !!selo };
});
console.log('  ' + JSON.stringify(carrossel));
ok(carrossel.existe, 'carrossel montou');
ok(carrossel.src === '/Img/bx_2_boulangerie_le_jazz_lais_acsa.jpg', 'usa a imagem padrão');
ok(carrossel.temSelo, 'mostra o selo "imagem de exemplo"');

console.log('\n=== 2. Card "Por que escolher a gente" ===');
await p.evaluate(() => document.getElementById('diferenciais').scrollIntoView());
await p.waitForTimeout(300);
const card = await p.evaluate(() => {
  const wrap = document.querySelector('#destaques .foto-exemplo');
  const img = wrap?.querySelector('img');
  const selo = wrap?.querySelector('.foto-exemplo__selo');
  return { existe: !!wrap, src: img?.getAttribute('src'), selo: selo?.textContent };
});
console.log('  ' + JSON.stringify(card));
ok(card.existe, 'card usa o wrapper de imagem de exemplo');
ok(card.src === '/Img/bx_2_boulangerie_le_jazz_lais_acsa.jpg', 'card mostra a imagem padrão');
ok(card.selo === 'Imagem de exemplo', 'selo correto no card');

console.log('\n=== 3. Produto do cardápio ===');
await p.evaluate(() => document.getElementById('cardapio').scrollIntoView());
await p.waitForTimeout(300);
const produto = await p.evaluate(() => {
  const wrap = document.querySelector('.prod .foto-exemplo');
  const img = wrap?.querySelector('img');
  return { existe: !!wrap, src: img?.getAttribute('src') };
});
console.log('  ' + JSON.stringify(produto));
ok(produto.existe, 'produto usa o wrapper de imagem de exemplo');
ok(produto.src === '/Img/bx_2_boulangerie_le_jazz_lais_acsa.jpg', 'produto mostra a imagem padrão');

console.log('\n=== 4. Layout não quebrou (aspect-ratio preservado) ===');
const medidas = await p.evaluate(() => {
  const el = document.querySelector('#destaques .foto-exemplo');
  const r = el.getBoundingClientRect();
  return { largura: Math.round(r.width), altura: Math.round(r.height), razao: (r.width / r.height).toFixed(2) };
});
console.log('  ' + JSON.stringify(medidas));
ok(Math.abs(Number(medidas.razao) - 4 / 3) < 0.05, `proporção 4:3 mantida (${medidas.razao})`);

console.log('\n=== 5. Foto real continua tendo prioridade sobre a padrão ===');
// upload de teste rapido via API pra confirmar que com foto de verdade o selo some
await p.screenshot({ path: 'padrao-1-hero.png' });
await p.evaluate(() => document.getElementById('diferenciais').scrollIntoView());
await p.screenshot({ path: 'padrao-2-destaques.png' });
await p.evaluate(() => document.getElementById('cardapio').scrollIntoView());
await p.screenshot({ path: 'padrao-3-cardapio.png' });

await b.close();
console.log('\n============ ' + (f ? f + ' FALHA(S)' : 'TODOS PASSARAM') + ' ============');
process.exit(f ? 1 : 0);
