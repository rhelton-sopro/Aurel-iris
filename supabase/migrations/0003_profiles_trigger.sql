-- Cria profiles automaticamente no signup de auth.users.
-- Design choices:
--   - security definer: executa com privilégios do owner, não do caller (T-02-05)
--   - set search_path = '': previne SQL injection via search_path
--   - ON CONFLICT DO NOTHING: idempotente; protege contra double-fire
--   - coalesce para full_name: profiles.full_name é NOT NULL

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, subscription_status, trial_ends_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Terapeuta'),
    'trial',
    now() + interval '14 days'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Drop trigger se já existir (idempotência na migration)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
