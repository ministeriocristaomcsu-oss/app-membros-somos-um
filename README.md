# App de membros — Ministério Cristão Somos Um

Site estático (HTML puro, sem build) publicado na Netlify: https://crm-ministerio-somos-um.netlify.app

- `index.html`: app da secretaria (membros, aniversários, Kids e Jovens, visitantes, pedidos)
- `atualizar.html`: link público para o membro atualizar o cadastro
- `visitante.html`: cadastro de visitantes pelo QR code
- `supabase/functions/resumo-diario`: e-mail das 7h (Edge Function do Supabase; não é publicada pela Netlify)

Banco: Supabase `kucctooazibqfzlmqsws`. Na Netlify: sem comando de build, pasta de publicação `.` (raiz).
