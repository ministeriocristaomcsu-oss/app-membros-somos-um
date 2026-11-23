# App de membros — Ministério Cristão Somos Um

Site estático (HTML puro, sem build) publicado no Cloudflare Pages: https://ministeriocristaosomosum.com.br (também em https://app-membros-somos-um.pages.dev). Cada push na `main` publica sozinho.

- `index.html`: app da secretaria (membros, aniversários, Kids e Jovens, visitantes, pedidos)
- `atualizar.html`: link público para o membro atualizar o cadastro
- `visitante.html`: cadastro de visitantes pelo QR code
- `presenca.html`: presença pelo QR code (o membro digita o WhatsApp e marca ele e os filhos); `cartaz-presenca.html?c=<código>` imprime o QR de cada culto ou célula
- `tesouraria.js`: aba Tesouraria (caixa da igreja). Só quem é tesoureiro em Ajustes → Acessos vê; o banco bloqueia os outros (`supabase/sql/2026-11-22-tesouraria.sql`)
- `escalas.js`: aba Escalas da Diaconia (cultos, voluntários, avisos, lembretes por WhatsApp e card do culto). Usa as tabelas do antigo app das Escalas; para liberar a quem tem acesso ao app, rodar `supabase/sql/2026-11-22-escalas.sql`
- `certificado.html`: certificado de apresentação de criança (3 modelos, imprimir ou salvar em PDF); logos em `img/`
- `supabase/sql/2026-11-22-presenca.sql`: tabelas da presença (atividades, presencas, ausencias_contatos)
- `supabase/functions/resumo-diario`: e-mail das 7h (inclui "Sentimos falta": 3 semanas sem presença) (Edge Function do Supabase; não é publicada pela Netlify)

Banco: Supabase `kucctooazibqfzlmqsws`. Na Netlify: sem comando de build, pasta de publicação `.` (raiz).

Publicação: cada envio na branch main publica sozinho na Netlify (repositório público desde 13/11/2026; não há dados de membros nem senhas no código).
