-- CreateTable
CREATE TABLE "site_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cta_header_texto" TEXT NOT NULL,
    "cta_header_link" TEXT NOT NULL,

    CONSTRAINT "site_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hero" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "headline" TEXT NOT NULL,
    "subtitulo" TEXT NOT NULL,
    "texto_botao" TEXT NOT NULL,
    "link_botao" TEXT NOT NULL,
    "video_url" TEXT,
    "imagem_fallback_url" TEXT,

    CONSTRAINT "hero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destaques" (
    "id" SERIAL NOT NULL,
    "imagem_url" TEXT,
    "alt_text" TEXT NOT NULL DEFAULT '',
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "texto_botao" TEXT NOT NULL,
    "link_botao" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "destaques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visite_a_gente" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "texto_botao" TEXT NOT NULL,
    "link_botao" TEXT NOT NULL,

    CONSTRAINT "visite_a_gente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visite_imagens" (
    "id" SERIAL NOT NULL,
    "imagem_url" TEXT,
    "alt_text" TEXT NOT NULL DEFAULT '',
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visite_imagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "galeria" (
    "id" SERIAL NOT NULL,
    "imagem_url" TEXT,
    "alt_text" TEXT NOT NULL DEFAULT '',
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "galeria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contato" (
    "id" SERIAL NOT NULL,
    "canal" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "link" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contato_canal_key" ON "contato"("canal");
