-- O site acessa o banco somente pelo backend com Prisma.
-- Bloqueia acesso direto pela Data API ate o Supabase Auth ser implementado.

ALTER TABLE "public"."site_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."hero" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."destaques" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."visite_a_gente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."visite_imagens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."galeria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."contato" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."categorias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."produtos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."hero_imagens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."restaurante" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."horarios" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  "public"."site_config",
  "public"."hero",
  "public"."destaques",
  "public"."visite_a_gente",
  "public"."visite_imagens",
  "public"."galeria",
  "public"."contato",
  "public"."admin_users",
  "public"."categorias",
  "public"."produtos",
  "public"."hero_imagens",
  "public"."restaurante",
  "public"."horarios"
FROM anon, authenticated;

REVOKE ALL ON SEQUENCE
  "public"."destaques_id_seq",
  "public"."visite_imagens_id_seq",
  "public"."galeria_id_seq",
  "public"."contato_id_seq",
  "public"."admin_users_id_seq",
  "public"."categorias_id_seq",
  "public"."produtos_id_seq",
  "public"."hero_imagens_id_seq",
  "public"."horarios_id_seq"
FROM anon, authenticated;
