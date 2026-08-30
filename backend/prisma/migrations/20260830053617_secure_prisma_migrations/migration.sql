-- A tabela de historico do Prisma nao faz parte da API publica do site.
-- Somente o usuario de banco usado pelo backend e pelas migracoes precisa acessa-la.

ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."_prisma_migrations"
FROM PUBLIC, anon, authenticated;
