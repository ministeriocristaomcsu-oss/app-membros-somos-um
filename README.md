# App de membros — Ministério Cristão Somos Um

Site estático (HTML puro, sem build) publicado na Netlify: https://crm-ministerio-somos-um.netlify.app

- `index.html`: app da secretaria (membros, aniversários, Kids e Jovens, visitantes, pedidos)
- `atualizar.html`: link público para o membro atualizar o cadastro
- `visitante.html`: cadastro de visitantes pelo QR code
- `presenca.html`: presença pelo QR code (o membro digita o WhatsApp e marca ele e os filhos); `cartaz-presenca.html?c=<código>` imprime o QR de cada culto ou célula
- `certificado.html`: certificado de apresentação de criança (3 modelos, imprimir ou salvar em PDF); logos em `img/`
- `supabase/sql/2026-11-22-presenca.sql`: tabelas da presença (atividades, presencas, ausencias_contatos)
- `supabase/functions/resumo-diario`: e-mail das 7h (inclui "Sentimos falta": 3 semanas sem presença) (Edge Function do Supabase; não é publicada pela Netlify)

Banco: Supabase `kucctooazibqfzlmqsws`. Na Netlify: sem comando de build, pasta de publicação `.` (raiz).

Publicação: cada envio na branch main publica sozinho na Netlify (repositório público desde 13/11/2026; não há dados de membros nem senhas no código).
