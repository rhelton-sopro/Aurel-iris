-- supabase/migrations/0001_initial_schema.sql
-- Aurel Iris — schema inicial completo (SPEC §3, com adição mínima documentada).
-- Cobre: pgvector, 6 tabelas (profiles, clients, readings, reading_images,
-- knowledge_chunks, subscriptions), índices mandatórios (incluindo HNSW),
-- RLS habilitada em 6 tabelas (5 do SPEC §3 verbatim + knowledge_chunks por
-- necessidade lógica das policies SPEC; ver D-12) e policies-base por D-12 do CONTEXT.

-- Habilita pgvector
create extension if not exists vector;

-- Perfis de terapeuta (estende auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  professional_id text,                  -- registro profissional opcional
  bio text,
  phone text,
  city text,
  state text,
  subscription_status text default 'trial', -- trial | active | cancelled | past_due
  trial_ends_at timestamptz default (now() + interval '14 days'),
  stripe_customer_id text,
  created_at timestamptz default now()
);

-- Clientes do terapeuta (pacientes não têm conta)
create table clients (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid references profiles(id) on delete cascade not null,
  full_name text not null,
  birth_date date,
  gender text,
  notes text,
  consent_signed_at timestamptz,         -- consentimento LGPD assinado
  consent_document_url text,
  created_at timestamptz default now()
);

create index on clients(therapist_id);

-- Leituras (cada sessão de análise)
create table readings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  therapist_id uuid references profiles(id) on delete cascade not null,
  status text default 'pending',         -- pending | processing | ready | failed | edited
  capture_method text,                   -- mobile_camera | desktop_upload
  iris_map text default 'jensen',        -- jensen | jausas | hidalgo
  vision_features jsonb,                 -- output do Modal
  ai_report_raw text,                    -- resposta crua do Claude
  ai_report_edited text,                 -- versão editada pelo terapeuta
  therapist_notes text,                  -- anotações privadas
  is_delivered boolean default false,    -- entregou pro cliente?
  created_at timestamptz default now(),
  processed_at timestamptz,
  delivered_at timestamptz
);

create index on readings(therapist_id);
create index on readings(client_id);
create index on readings(status);

-- Imagens de cada leitura (3 por olho × 2 olhos = até 6)
create table reading_images (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid references readings(id) on delete cascade not null,
  eye text not null,                     -- left | right
  angle text not null,                   -- frontal | lateral | backlight
  storage_path text not null,            -- path no bucket privado
  quality_score float,                   -- 0-1 do validador on-device
  width int,
  height int,
  created_at timestamptz default now()
);

create index on reading_images(reading_id);

-- Base de conhecimento iridológica (RAG)
create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_book text not null,             -- "Jensen - Iridology Vol 1"
  source_chapter text,
  source_page int,
  content text not null,
  embedding vector(1024),                -- voyage-3 = 1024 dim
  metadata jsonb,                        -- {tema, tradicao, escola, idioma}
  created_at timestamptz default now()
);

create index on knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

-- Assinaturas Stripe
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid references profiles(id) on delete cascade not null,
  stripe_subscription_id text unique not null,
  status text not null,
  plan text not null,                    -- starter | professional | school
  current_period_end timestamptz,
  created_at timestamptz default now()
);

-- RLS (Row Level Security): cada terapeuta só vê os próprios dados
alter table profiles enable row level security;
alter table clients enable row level security;
alter table readings enable row level security;
alter table reading_images enable row level security;
alter table subscriptions enable row level security;
-- NOTA: Esta linha não está no SPEC §3 verbatim. Adicionada por necessidade lógica:
-- a policy "Knowledge chunks são públicos pra usuários autenticados" do SPEC §3
-- fica inerte se RLS não estiver enabled na tabela. Ver CONTEXT.md D-12.
alter table knowledge_chunks enable row level security;

-- Policies SPEC §3 verbatim
create policy "Terapeutas só veem seus próprios clientes"
  on clients for all
  using (auth.uid() = therapist_id);

create policy "Terapeutas só veem suas próprias leituras"
  on readings for all
  using (auth.uid() = therapist_id);

-- Knowledge chunks são lidos por todos os terapeutas autenticados
create policy "Knowledge chunks são públicos pra usuários autenticados"
  on knowledge_chunks for select
  using (auth.role() = 'authenticated');

-- Policies adicionais por D-12 (CONTEXT.md):
-- profiles, reading_images, subscriptions também precisam policies.

create policy "Terapeutas só veem o próprio profile"
  on profiles for all
  using (auth.uid() = id);

create policy "Terapeutas só veem imagens de suas próprias leituras"
  on reading_images for all
  using (
    exists (
      select 1 from readings
      where readings.id = reading_images.reading_id
        and readings.therapist_id = auth.uid()
    )
  );

create policy "Terapeutas só veem as próprias assinaturas"
  on subscriptions for all
  using (auth.uid() = therapist_id);
