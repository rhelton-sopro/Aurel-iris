-- 0049 — social_posts: publicação Instagram (colunas de resultado + lock state + claim RPCs)
--
-- Motivo (Fase 12 — Publicação Instagram): estender a tabela social_posts (0045)
-- para suportar a publicação automática no Instagram via Meta Content Publishing
-- API. Adiciona:
--   * colunas de RESULTADO (ig_media_id/ig_permalink/ig_container_id) que IGPUB-06
--     grava após sucesso, mais publish_error/publish_attempts/last_attempt_at/
--     published_at para o ciclo de re-tentativa (D-03).
--   * o estado intermediário de LOCK 'publicando' e o estado terminal 'erro' no
--     CHECK do status (CHECK passa de 5 → 7 estados).
--   * um índice parcial de varredura (status, scheduled_at) para o cron sweep.
--   * 3 RPCs SECURITY DEFINER atômicas que garantem a idempotência (D-02) e a
--     cadência de re-tentativa (D-03):
--       - claim_due_social_posts  → claim em lote (cron sweep)
--       - claim_one_social_post   → claim de UM id ("publicar agora", D-08)
--       - reap_stuck_publishing   → reaper de rows presas em 'publicando' (crash recovery)
--
-- Forward-only: db push é version-tracked, NÃO content-tracked. Editar 0045
-- in-place seria no-op num projeto já migrado → daí esta migration nova.
-- Idempotente: add column if not exists + drop constraint if exists +
-- create or replace function + create index if not exists.
--
-- Divisão de trabalho: Claude autorou; founder aplica (supabase db push --linked
-- — a senha do banco não está no env local).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Colunas de resultado da publicação + ciclo de re-tentativa
-- ----------------------------------------------------------------------------
alter table social_posts
  add column if not exists ig_media_id     text,
  add column if not exists ig_permalink    text,
  add column if not exists ig_container_id text,
  add column if not exists publish_error   text,
  add column if not exists publish_attempts int not null default 0,
  add column if not exists last_attempt_at  timestamptz,
  add column if not exists published_at     timestamptz;

-- ----------------------------------------------------------------------------
-- CHECK estendido: 5 → 7 estados (+ 'publicando' lock, + 'erro' terminal)
-- O constraint pré-existente (0045) é auto-gerado inline → social_posts_status_check.
-- ----------------------------------------------------------------------------
alter table social_posts drop constraint if exists social_posts_status_check;
alter table social_posts add constraint social_posts_status_check
  check (status in ('pendente','aprovado','agendado','publicando','publicado','reprovado','erro'));

-- ----------------------------------------------------------------------------
-- Índice parcial de varredura: o cron só varre rows reivindicáveis/em-voo.
-- ----------------------------------------------------------------------------
create index if not exists social_posts_due_idx
  on social_posts(status, scheduled_at)
  where status in ('agendado','publicando');

-- ============================================================================
-- RPC claim_due_social_posts — claim em LOTE (cron sweep).
--
-- Atômico: flipa 'agendado' → 'publicando' com `for update skip locked`, então
-- dois cron runs sobrepostos NUNCA reivindicam a mesma row (T-12-01). Um post
-- 'publicado' jamais casa o WHERE status='agendado' → não re-reivindicável (D-02).
-- Cap de tentativas D-03: publish_attempts < 3.
-- ============================================================================
create or replace function public.claim_due_social_posts(p_limit int default 10)
returns setof social_posts
language plpgsql
security definer
as $$
begin
  return query
  update social_posts
     set status = 'publicando',
         last_attempt_at = now(),
         publish_attempts = publish_attempts + 1,
         updated_at = now()
   where id in (
     select id from social_posts
      where status = 'agendado'
        and scheduled_at <= now()
        and publish_attempts < 3
      order by scheduled_at
      for update skip locked
      limit p_limit)
  returning *;
end;
$$;

comment on function public.claim_due_social_posts(int) is
  'Fase 12 IGPUB-02: claim atômico em lote de posts agendados vencidos (status agendado→publicando, for update skip locked, cap publish_attempts<3). Idempotente: um publicado nunca casa o WHERE. SECURITY DEFINER.';

grant execute on function public.claim_due_social_posts(int) to service_role;

-- ============================================================================
-- RPC claim_one_social_post — claim de UM id ("publicar agora", D-08).
--
-- Força mesmo sem scheduled_at vencido; aceita 'aprovado'/'agendado'/'erro'
-- (re-enfileirar uma falha). Retorna 0 linhas se NÃO-reivindicável (já em
-- 'publicando' ou 'publicado') → o caller sabe que outro processo já pegou.
-- ============================================================================
create or replace function public.claim_one_social_post(p_id uuid)
returns setof social_posts
language plpgsql
security definer
as $$
begin
  return query
  update social_posts
     set status = 'publicando',
         last_attempt_at = now(),
         publish_attempts = publish_attempts + 1,
         updated_at = now()
   where id = p_id
     and status in ('aprovado','agendado','erro')
  returning *;
end;
$$;

comment on function public.claim_one_social_post(uuid) is
  'Fase 12 D-08 ("publicar agora"): claim atômico de UM post (status aprovado/agendado/erro → publicando). Retorna 0 linhas se já publicando/publicado (não re-reivindicável). SECURITY DEFINER.';

grant execute on function public.claim_one_social_post(uuid) to service_role;

-- ============================================================================
-- RPC reap_stuck_publishing — reaper de crash recovery.
--
-- Rows presas em 'publicando' há >15min (a função crashou entre o claim e o
-- resultado) voltam a 'agendado' para serem re-tentadas — ainda sob o cap de
-- tentativas (publish_attempts já foi incrementado no claim). T-12-02.
-- Retorna a contagem de rows recuperadas.
-- ============================================================================
create or replace function public.reap_stuck_publishing()
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  with reaped as (
    update social_posts
       set status = 'agendado',
           updated_at = now()
     where status = 'publicando'
       and last_attempt_at < now() - interval '15 minutes'
    returning 1)
  select count(*) into v_count from reaped;
  return v_count;
end;
$$;

comment on function public.reap_stuck_publishing() is
  'Fase 12 T-12-02: reaper de crash recovery. Rows presas em publicando >15min voltam a agendado (sob o cap publish_attempts<3). Retorna nº recuperadas. SECURITY DEFINER.';

grant execute on function public.reap_stuck_publishing() to service_role;
