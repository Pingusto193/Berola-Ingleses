// Monta todas as rotas administrativas sob /api/admin.
// A protecao (exigirAuth) e aplicada no server.js, uma vez, para o router
// inteiro - nao ha como esquecer de proteger uma rota nova aqui dentro.
import { Router } from 'express';

import { rotasUpload } from './upload.js';
import { rotasCategorias } from './categorias.js';
import { rotasProdutos } from './produtos.js';
import { rotasMidia } from './midia.js';
import { rotasEstabelecimento } from './estabelecimento.js';
import { rotasConteudo } from './conteudo.js';

export const rotasAdmin = Router();

rotasAdmin.use(rotasUpload);
rotasAdmin.use(rotasCategorias);
rotasAdmin.use(rotasProdutos);
rotasAdmin.use(rotasMidia);
rotasAdmin.use(rotasEstabelecimento);
rotasAdmin.use(rotasConteudo);
