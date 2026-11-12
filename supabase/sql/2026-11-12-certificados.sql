-- Certificados emitidos (apresentação de criança e batismo)
-- Guarda os dados do certificado mesmo quando a pessoa NÃO tem cadastro de membro
-- (ex.: filho de visitante). Quando é de alguém cadastrado, membro_id aponta para o cadastro.
-- Rodar uma vez no SQL Editor do Supabase (projeto kucctooazibqfzlmqsws).

create table if not exists public.certificados (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('apresentacao', 'batismo')),
  membro_id uuid references public.membros(id) on delete set null,
  nome text not null,
  sexo text check (sexo in ('masculino', 'feminino')),
  nascimento date,
  pai text not null default '',
  mae text not null default '',
  data date not null,
  pastor text not null default '',
  cargo text not null default '',
  ass2 text not null default '',
  cidade text not null default '',
  verso int not null default 0,
  modelo text not null default 'm1',
  observacoes text not null default '',
  criado_em timestamptz not null default now(),
  criado_por text not null default ''
);

create index if not exists certificados_data_idx on public.certificados (data desc);
create index if not exists certificados_membro_idx on public.certificados (membro_id);

alter table public.certificados enable row level security;

drop policy if exists "acesso autorizado certificados" on public.certificados;
create policy "acesso autorizado certificados" on public.certificados
  for all to authenticated
  using ((select usuario_autorizado()))
  with check ((select usuario_autorizado()));
