-- AlterTable
ALTER TABLE "site_config" ADD COLUMN     "subtitulo_cardapio" TEXT NOT NULL DEFAULT 'Tudo o que sai da nossa cozinha e do nosso balcão.',
ADD COLUMN     "subtitulo_destaques" TEXT NOT NULL DEFAULT 'Café bom, comida feita na casa e um lugar pra ficar à vontade.',
ADD COLUMN     "titulo_cardapio" TEXT NOT NULL DEFAULT 'Nosso cardápio',
ADD COLUMN     "titulo_destaques" TEXT NOT NULL DEFAULT 'Por que escolher a gente';
