-- Link público de cadastro Kids (cadastro-kids.html): os pais cadastram os filhos.
-- O pedido entra em "Pedidos" no app e só vira cadastro quando a liderança aplica.
alter table public.atualizacoes_cadastrais
  add column if not exists tipo text not null default 'adulto',
  add column if not exists pai_nome text not null default '',
  add column if not exists mae_nome text not null default '',
  add column if not exists responsavel_nome text not null default '';

alter table public.atualizacoes_cadastrais drop constraint if exists atualizacoes_tipo_check;
alter table public.atualizacoes_cadastrais add constraint atualizacoes_tipo_check check (tipo in ('adulto', 'kids'));
alter table public.atualizacoes_cadastrais drop constraint if exists atualizacoes_kids_nomes_check;
alter table public.atualizacoes_cadastrais add constraint atualizacoes_kids_nomes_check
  check (length(pai_nome) <= 120 and length(mae_nome) <= 120 and length(responsavel_nome) <= 120);
