-- AlterTable
ALTER TABLE "hero_imagens" ADD COLUMN     "descricao" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "nome" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "preco_antigo_centavos" INTEGER,
ADD COLUMN     "preco_centavos" INTEGER,
ADD COLUMN     "texto_promocional" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT '';
