-- Presença nos cultos e células (2026-11-22)
-- atividades: cada culto ou célula, com um código fixo para o QR code
-- presencas: quem veio em cada atividade e dia (pelo QR ou pela chamada da secretaria)
-- ausencias_contatos: quando alguém da liderança já falou com quem sumiu
-- O público (QR) não lê nenhuma tabela: só usa as funções presenca_* abaixo.

create table if not exists public.atividades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'culto' check (tipo in ('culto', 'celula', 'outro')),
  dia_semana smallint check (dia_semana between 0 and 6), -- 0 = domingo; vazio = qualquer dia
  horario text not null default '',
  lider text not null default '',
  local text not null default '',
  codigo text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.presencas (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades (id) on delete cascade,
  data date not null,
  membro_id uuid references public.membros (id) on delete cascade,
  nome_informado text not null default '',
  telefone_informado text not null default '',
  origem text not null default 'chamada' check (origem in ('qrcode', 'chamada')),
  registrado_por text not null default '',
  criado_em timestamptz not null default now(),
  check (membro_id is not null or nome_informado <> '')
);
create unique index if not exists presencas_unica on public.presencas (atividade_id, data, membro_id) where membro_id is not null;
create index if not exists presencas_membro on public.presencas (membro_id, data desc);
create index if not exists presencas_data on public.presencas (data desc, atividade_id);

create table if not exists public.ausencias_contatos (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros (id) on delete cascade,
  feito_em timestamptz not null default now(),
  canal text not null default 'whatsapp' check (canal in ('whatsapp', 'pessoalmente', 'pulado')),
  feito_por text not null default '',
  nota text not null default ''
);
create index if not exists ausencias_contatos_membro on public.ausencias_contatos (membro_id, feito_em desc);

alter table public.atividades enable row level security;
alter table public.presencas enable row level security;
alter table public.ausencias_contatos enable row level security;
drop policy if exists "acesso autorizado atividades" on public.atividades;
create policy "acesso autorizado atividades" on public.atividades for all to authenticated
  using ((select public.usuario_autorizado())) with check ((select public.usuario_autorizado()));
drop policy if exists "acesso autorizado presencas" on public.presencas;
create policy "acesso autorizado presencas" on public.presencas for all to authenticated
  using ((select public.usuario_autorizado())) with check ((select public.usuario_autorizado()));
drop policy if exists "acesso autorizado ausencias" on public.ausencias_contatos;
create policy "acesso autorizado ausencias" on public.ausencias_contatos for all to authenticated
  using ((select public.usuario_autorizado())) with check ((select public.usuario_autorizado()));

-- Resumos (respeitam o RLS de quem consulta)
create or replace view public.ultima_presenca with (security_invoker = true) as
  select membro_id, max(data) as ultima, min(data) as primeira, count(*)::int as vezes
  from public.presencas where membro_id is not null group by membro_id;
create or replace view public.presencas_resumo with (security_invoker = true) as
  select atividade_id, data, count(*)::int as total,
         count(*) filter (where origem = 'qrcode')::int as pelo_qr,
         count(*) filter (where membro_id is null)::int as sem_cadastro
  from public.presencas group by atividade_id, data;

-- Agenda oficial (dá para mudar no app)
insert into public.atividades (nome, tipo, dia_semana, horario)
select * from (values
  ('Culto de Louvor & Adoração', 'culto', 0::smallint, '19:00'),
  ('Culto de Oração & Palavra', 'culto', 2::smallint, '20:00'),
  ('Celebra Jovem', 'culto', 6::smallint, '19:00')
) v(nome, tipo, dia_semana, horario)
where not exists (select 1 from public.atividades);

-- Texto do WhatsApp para quem sumiu
alter table public.config_mensagens drop constraint if exists config_mensagens_tipo_check;
alter table public.config_mensagens add constraint config_mensagens_tipo_check check (tipo = any (array[
  'aniversario', 'casamento', 'visitante_d0', 'visitante_d3', 'visitante_d7', 'visitante_d15', 'visitante_d30', 'ausente']));
insert into public.config_mensagens (tipo, texto) values ('ausente',
  E'Oi, {nome}! Sentimos a sua falta nos últimos cultos. 🙏\n\nEstá tudo bem com você e com a sua família? Estamos orando por vocês. Se precisar de alguma coisa, conte com a gente. Queremos muito te ver de novo!')
on conflict (tipo) do nothing;

-- ---------- Funções do QR code (público) ----------
-- Dia do culto no horário de Brasília; até as 3h da manhã ainda conta como o dia anterior
create or replace function public.presenca_hoje() returns date language sql stable set search_path = '' as $$
  select ((now() at time zone 'America/Sao_Paulo') - interval '3 hours')::date
$$;

create or replace function public.presenca_atividade(p_codigo text)
returns table (nome text, tipo text, dia_semana smallint, horario text, hoje_ok boolean)
language sql stable security definer set search_path = '' as $$
  select a.nome, a.tipo, a.dia_semana, a.horario,
         a.dia_semana is null or extract(dow from public.presenca_hoje()) = a.dia_semana
  from public.atividades a where a.codigo = p_codigo and a.ativa
$$;

-- Quem pode marcar presença com este WhatsApp: a pessoa, quem tem o mesmo número
-- e os filhos menores (ou sem telefone próprio). Devolve só o primeiro nome.
create or replace function public.presenca_familia(p_codigo text, p_telefone text)
returns table (id uuid, nome text, titular boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare v_tel text := right(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 8);
begin
  if length(v_tel) < 8 or not exists (select 1 from public.atividades a where a.codigo = p_codigo and a.ativa) then return; end if;
  return query
  with titulares as (
    select m.id from public.membros m
    where m.situacao = 'ativo' and right(regexp_replace(coalesce(m.telefone, ''), '\D', '', 'g'), 8) = v_tel
  )
  select m.id, split_part(trim(m.nome), ' ', 1), m.id in (select t.id from titulares t)
  from public.membros m
  where m.situacao = 'ativo' and (
    m.id in (select t.id from titulares t)
    or ((m.pai_id in (select t.id from titulares t) or m.mae_id in (select t.id from titulares t)
         or right(regexp_replace(coalesce(m.responsavel_telefone, ''), '\D', '', 'g'), 8) = v_tel)
        and (m.nascimento > current_date - interval '18 years' or coalesce(m.telefone, '') = ''))
  )
  order by 3 desc, m.nascimento nulls first;
end $$;

create or replace function public.presenca_registrar(p_codigo text, p_telefone text, p_ids uuid[], p_nome text default '')
returns json language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  a public.atividades;
  v_dia date := public.presenca_hoje();
  v_nomes text[];
  v_tel text := left(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 15);
begin
  select * into a from public.atividades x where x.codigo = p_codigo and x.ativa;
  if a.id is null then return json_build_object('ok', false, 'motivo', 'codigo'); end if;
  if a.dia_semana is not null and extract(dow from v_dia) <> a.dia_semana then
    return json_build_object('ok', false, 'motivo', 'dia');
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 0 then
    insert into public.presencas (atividade_id, data, membro_id, telefone_informado, origem)
      select a.id, v_dia, f.id, v_tel, 'qrcode' from public.presenca_familia(p_codigo, p_telefone) f where f.id = any (p_ids)
      on conflict do nothing;
    select array_agg(f.nome) into v_nomes from public.presenca_familia(p_codigo, p_telefone) f where f.id = any (p_ids);
    if v_nomes is null then return json_build_object('ok', false, 'motivo', 'pessoa'); end if;
    return json_build_object('ok', true, 'atividade', a.nome, 'nomes', v_nomes);
  end if;
  -- Sem cadastro: guarda o nome para a secretaria ligar ao membro depois
  if length(trim(coalesce(p_nome, ''))) < 3 or length(v_tel) < 10 then return json_build_object('ok', false, 'motivo', 'nome'); end if;
  if not exists (select 1 from public.presencas p where p.atividade_id = a.id and p.data = v_dia and p.membro_id is null and p.telefone_informado = v_tel) then
    insert into public.presencas (atividade_id, data, nome_informado, telefone_informado, origem)
      values (a.id, v_dia, left(trim(p_nome), 80), v_tel, 'qrcode');
  end if;
  return json_build_object('ok', true, 'atividade', a.nome, 'nomes', array[split_part(trim(p_nome), ' ', 1)], 'sem_cadastro', true);
end $$;

revoke all on function public.presenca_hoje() from public;
revoke all on function public.presenca_atividade(text) from public;
revoke all on function public.presenca_familia(text, text) from public;
revoke all on function public.presenca_registrar(text, text, uuid[], text) from public;
grant execute on function public.presenca_hoje() to anon, authenticated;
grant execute on function public.presenca_atividade(text) to anon, authenticated;
grant execute on function public.presenca_familia(text, text) to anon, authenticated;
grant execute on function public.presenca_registrar(text, text, uuid[], text) to anon, authenticated;
