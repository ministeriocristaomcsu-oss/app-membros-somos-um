-- Escalas da Diaconia dentro do app de membros.
-- As tabelas cultos, voluntarios, avisos e envios já existem (app antigo das Escalas).
-- Hoje só 2 e-mails fixos entram nelas. Esta regra a mais deixa entrar quem tem acesso ao app
-- (Ajustes → Acessos). A regra antiga continua, então o app antigo das Escalas segue funcionando.
-- Rodar uma vez no SQL Editor do Supabase (projeto kucctooazibqfzlmqsws).

do $$
declare t text;
begin
  foreach t in array array['cultos', 'voluntarios', 'avisos', 'envios'] loop
    execute format('drop policy if exists "acesso do app de membros" on public.%I', t);
    execute format('create policy "acesso do app de membros" on public.%I for all to authenticated
      using ((select public.usuario_autorizado())) with check ((select public.usuario_autorizado()))', t);
  end loop;
end $$;
