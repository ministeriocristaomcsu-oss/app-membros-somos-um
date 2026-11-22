-- Agenda da igreja: cultos fixos da semana + eventos com data.
-- Rodar uma vez no SQL Editor do Supabase (projeto kucctooazibqfzlmqsws).
create table if not exists public.agenda (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('fixo', 'evento')),
  titulo text not null,
  data date,                         -- evento: dia do evento
  data_fim date,                     -- evento de vários dias (opcional)
  dia_semana int check (dia_semana between 0 and 6), -- fixo: 0=domingo
  semana_do_mes int check (semana_do_mes between 1 and 5), -- fixo: só na Nª semana (ex.: 3º sábado); null = toda semana
  hora text not null default '',
  local text not null default '',
  descricao text not null default '',
  culto boolean not null default false, -- fixo marcado como culto some no dia em que a escala já tem um culto
  publico boolean not null default true, -- false = só a equipe vê no app
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por text not null default '',
  check ((tipo = 'evento' and data is not null) or (tipo = 'fixo' and dia_semana is not null))
);
create index if not exists agenda_data_idx on public.agenda (data);
alter table public.agenda enable row level security;
drop policy if exists "acesso autorizado agenda" on public.agenda;
create policy "acesso autorizado agenda" on public.agenda
  for all to authenticated
  using ((select usuario_autorizado())) with check ((select usuario_autorizado()));

-- Leitura pública (página agenda.html, sem login): só o que é público.
-- Da escala de cultos pega só data, hora e nome (nunca os nomes dos escalados).
create or replace function public.agenda_publica()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'itens', coalesce((select json_agg(json_build_object('id', id, 'tipo', tipo, 'titulo', titulo, 'data', data, 'data_fim', data_fim,
        'dia_semana', dia_semana, 'semana_do_mes', semana_do_mes, 'hora', hora, 'local', local, 'descricao', descricao, 'culto', culto)
        order by data, dia_semana, hora)
      from agenda where ativo and publico and (tipo = 'fixo' or coalesce(data_fim, data) >= current_date - 1)), '[]'::json),
    'cultos', coalesce((select json_agg(json_build_object('data', c.data->>'date', 'hora', c.data->>'hora', 'nome', c.data->>'nome') order by c.data->>'date')
      from cultos c where (c.data->>'date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (c.data->>'date')::date between current_date - 1 and current_date + 120), '[]'::json)
  );
$$;
revoke all on function public.agenda_publica() from public;
grant execute on function public.agenda_publica() to anon, authenticated;

-- Agenda fixa inicial (agenda oficial de 22/08/2026; a equipe ajusta no app)
insert into public.agenda (tipo, titulo, dia_semana, semana_do_mes, hora, culto, criado_por)
select * from (values
  ('fixo', 'Culto de Louvor & Adoração', 0, null::int, '19:00', true, 'agenda inicial'),
  ('fixo', 'Culto de Oração & Palavra', 2, null::int, '20:00', true, 'agenda inicial'),
  ('fixo', 'Aula de Jiu-Jitsu (adultos)', 4, null::int, '20:00', false, 'agenda inicial'),
  ('fixo', 'Aula de Jiu-Jitsu (crianças acima de 4 anos)', 4, null::int, '21:00', false, 'agenda inicial'),
  ('fixo', 'Celebra Jovem (jovens e adolescentes)', 6, 3, '19:00', true, 'agenda inicial')
) v(tipo, titulo, dia_semana, semana_do_mes, hora, culto, criado_por)
where not exists (select 1 from public.agenda where tipo = 'fixo');
