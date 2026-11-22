-- Tesouraria (antigo "Caixa Somos Um"): lançamentos e contas fixas.
-- Só quem está marcado como tesoureiro em usuarios_autorizados vê ou mexe.
-- Rodar uma vez no SQL Editor do Supabase (projeto kucctooazibqfzlmqsws).

alter table public.usuarios_autorizados add column if not exists tesoureiro boolean not null default false;
-- O Anderson é o tesoureiro (pode liberar outros em Ajustes → Acessos)
update public.usuarios_autorizados set tesoureiro = true where email = 'polako.danesi@gmail.com';

create or replace function public.usuario_tesoureiro()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios_autorizados where email = lower(auth.jwt() ->> 'email') and tesoureiro)
$$;
revoke all on function public.usuario_tesoureiro() from public, anon;
grant execute on function public.usuario_tesoureiro() to authenticated;

create table if not exists public.tesouraria_contas_fixas (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  categoria text not null,
  tipo text not null default 'saida' check (tipo in ('entrada', 'saida')),
  valor numeric(12,2) not null check (valor >= 0),
  dia_vencimento int not null default 1 check (dia_vencimento between 1 and 31),
  forma_pagamento text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.tesouraria_lancamentos (
  id text primary key default gen_random_uuid()::text,
  data date not null,
  descricao text not null,
  categoria text not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  fixa boolean not null default false,
  valor numeric(12,2) not null check (valor > 0),
  forma_pagamento text,
  conta_fixa_id text references public.tesouraria_contas_fixas(id) on delete set null,
  membro_id uuid references public.membros(id) on delete set null, -- dízimo/oferta de um membro
  criado_em timestamptz not null default now(),
  criado_por text not null default ''
);
create index if not exists tesouraria_lancamentos_data_idx on public.tesouraria_lancamentos (data);
create index if not exists tesouraria_lancamentos_membro_idx on public.tesouraria_lancamentos (membro_id);

alter table public.tesouraria_contas_fixas enable row level security;
alter table public.tesouraria_lancamentos enable row level security;
drop policy if exists "tesoureiros contas fixas" on public.tesouraria_contas_fixas;
create policy "tesoureiros contas fixas" on public.tesouraria_contas_fixas
  for all to authenticated using ((select public.usuario_tesoureiro())) with check ((select public.usuario_tesoureiro()));
drop policy if exists "tesoureiros lancamentos" on public.tesouraria_lancamentos;
create policy "tesoureiros lancamentos" on public.tesouraria_lancamentos
  for all to authenticated using ((select public.usuario_tesoureiro())) with check ((select public.usuario_tesoureiro()));
revoke all on public.tesouraria_contas_fixas, public.tesouraria_lancamentos from anon;
