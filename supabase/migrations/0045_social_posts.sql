-- 0045: social_posts — fila de aprovação de conteúdo de marketing (Instagram).
--
-- Motivo: o /admin/painel era um mockup estático (HTML). Esta migration dá
-- lastro real à FILA DE APROVAÇÃO (v1): o founder vê os posts que o time
-- (Hathor/Bob/Ptah) montou, e aprova/reprova/edita/agenda/comenta — tudo
-- persistido. Auto-geração do time e publish no Instagram são fases futuras.
--
-- Acesso: só o founder (admin gated). Mutations rodam via service-role
-- (bypassa RLS); a policy abaixo é defense-in-depth, mesmo padrão de 0010.
-- Idempotente: create if not exists + drop policy if exists + seed guardado.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists social_posts (
  id            uuid primary key default gen_random_uuid(),
  -- formato do post no Instagram
  format        text not null default 'carrossel'
                  check (format in ('carrossel','reel','post')),
  -- estágio na fila de aprovação
  status        text not null default 'pendente'
                  check (status in ('pendente','aprovado','agendado','publicado','reprovado')),
  pilar         text,                              -- pilar estratégico ("Conduzir a devolutiva")
  tags          text[]  not null default '{}',     -- rótulos secundários ("Autoridade")
  caption       text    not null default '',       -- legenda do post
  why           text,                              -- "por que este post" (racional da Nefertiti)
  generated_by  text[]  not null default '{}',     -- agentes que montaram ("Hathor","Bob","Ptah")
  -- mídia: objeto jsonb. carrossel → {"kind":"carrossel","slides":["/path.png",...]}
  --                      reel      → {"kind":"reel","video":"/x.mp4","poster":"/p.png","duration":"28s"}
  media         jsonb   not null default '{}'::jsonb,
  suggested_slot text,                             -- sugestão de horário (rótulo humano, ex: "ter 12/06 · 19h")
  scheduled_at  timestamptz,                       -- horário agendado (quando status='agendado'/'publicado')
  comment       text,                              -- nota do founder na aprovação/edição
  sort_order    int     not null default 0,        -- ordenação manual no feed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists social_posts_status_idx     on social_posts(status);
create index if not exists social_posts_sort_order_idx  on social_posts(sort_order, created_at desc);

-- ============================================================================
-- RLS — gate hardcoded por email do founder (mesmo padrão de 0009/0010).
-- Defense-in-depth: o app já gateia /admin e as mutations usam service-role.
-- ============================================================================
alter table social_posts enable row level security;

drop policy if exists "founder_full_access" on social_posts;
create policy "founder_full_access"
  on social_posts
  for all
  to authenticated
  using (
    (select email from auth.users where id = auth.uid()) = 'rhelton@gmail.com'
  )
  with check (
    (select email from auth.users where id = auth.uid()) = 'rhelton@gmail.com'
  );

comment on table social_posts is
  'Fila de aprovação de conteúdo de marketing (Instagram). v1: founder aprova posts montados pelo time. Migration 0045.';

-- ============================================================================
-- SEED — 3 posts de exemplo (placeholder), pra demonstrar o workflow.
-- Serão substituídos pelos 3 carrosséis reais (Ptah) na sequência.
-- Guardado: só insere se a tabela estiver vazia (re-run safe).
-- Premissa travada: o cliente NÃO lê o relatório — se reconhece na sessão.
-- ============================================================================
insert into social_posts (format, status, pilar, tags, caption, why, generated_by, media, suggested_slot, sort_order)
select * from (values
  (
    'carrossel', 'pendente', 'Conduzir a devolutiva', array['Autoridade'],
    E'O relatório fica pronto em minutos. A transformação, não.\n\nO que muda o seu cliente não está no PDF — está na sessão em que ele se vê pela primeira vez. Essa travessia é sua.\n\nNos próximos cards, os seis momentos de uma devolutiva que não se esquece.',
    'O terapeuta de topo de funil ainda acha que o produto é o relatório. Este carrossel reposiciona o valor na devolutiva — a sessão que ele cobra — e planta o desejo pela ferramenta sem vender de frente.',
    array['Hathor','Bob','Ptah'],
    '{"kind":"carrossel","slides":["/admin/painel/img/slide12-B-medium.png","/admin/painel/img/cliente-emocionado.png","/admin/painel/img/cliente-visto.png","/admin/painel/img/consultorio.png","/admin/painel/img/relatorio-print.png","/admin/painel/img/macro-iris.png"]}'::jsonb,
    'ter 12/06 · 19h', 0
  ),
  (
    'reel', 'pendente', 'O método', array['Ofício'],
    E'Depois da frase que acerta, não preencha.\n\nA pausa é instrumento. É no silêncio que a guarda cai — e o cliente finalmente ouve a si mesmo.\n\nO que você faz no segundo seguinte à pergunta certa?',
    'Conteúdo de ofício (técnica de condução) constrói autoridade com o terapeuta sem vender nada — o tipo de post que faz seguir e salvar, alimentando o topo do funil.',
    array['Hathor','Bob','Ptah'],
    '{"kind":"reel","video":"/admin/painel/iris-reel-nat.mp4","poster":"/admin/painel/img/cliente-visto.png","duration":"28s"}'::jsonb,
    'qui 14/06 · 12h', 1
  ),
  (
    'carrossel', 'aprovado', 'Único de verdade', array['Anti-genérico'],
    E'Troque a pessoa, e o texto não muda? Então não é leitura — é horóscopo.\n\nCada íris é única. Por isso cada relatório também é: nasce daquela pessoa, e não caberia em nenhuma outra.\n\nÉ exatamente isso que o seu cliente sente quando se reconhece na sessão.',
    'Diferencia o Iris Codex dos catálogos de marcação genéricos. "É exatamente isso" é a palavra-assinatura da marca — reconhecimento, nunca venda.',
    array['Hathor','Bob','Ptah'],
    '{"kind":"carrossel","slides":["/admin/painel/img/macro-iris.png","/admin/painel/img/cliente-visto.png","/admin/painel/img/slide12-B-medium.png","/admin/painel/img/relatorio-tablet.png"]}'::jsonb,
    'sáb 15/06 · 10h', 2
  )
) as seed
where not exists (select 1 from social_posts);
