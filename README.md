# App de membros — Ministério Cristão Somos Um

Site estático (HTML puro, sem build) publicado na Netlify: https://crm-ministerio-somos-um.netlify.app

- `index.html`: app da secretaria (membros, aniversários, Kids e Jovens, visitantes, pedidos)
- `atualizar.html`: link público para o membro atualizar o cadastro
- `visitante.html`: cadastro de visitantes pelo QR code
- `certificado.html`: certificado de apresentação de criança (3 modelos, imprimir ou salvar em PDF); logos em `img/`
- `supabase/functions/resumo-diario`: e-mail das 7h (Edge Function do Supabase; não é publicada pela Netlify)

Banco: Supabase `kucctooazibqfzlmqsws`. Na Netlify: sem comando de build, pasta de publicação `.` (raiz).

Publicação: cada envio na branch main publica sozinho na Netlify (repositório público desde 13/11/2026; não há dados de membros nem senhas no código).
