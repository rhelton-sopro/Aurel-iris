-- 0048 — app_settings: configuração global do app (chave-valor jsonb).
--
-- Motivação (2026-06-21): "Versão do cliente" do relatório. O terapeuta entrega
-- ao cliente uma versão CONDENSADA (subconjunto de seções) do relatório completo.
-- QUAIS seções entram é decidido GLOBALMENTE pelo founder, via /admin, sem deploy.
-- Esta tabela guarda essa seleção (chave 'client_report_sections' → array de
-- heading-numbers internos, ex.: ["0","9","14","15"]). Genérica de propósito:
-- futuras flags globais reusam a mesma tabela.
--
-- Segurança: RLS LIGADO e SEM POLICIES → invisível para clientes autenticados
-- (terapeutas). Leitura e escrita acontecem APENAS via service-role
-- (lib/admin/client-report-config.ts), que bypassa RLS. O dado não é sensível
-- (lista de números de seção), mas mantemos fechado por higiene.

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

comment on table public.app_settings is
  'Config global chave-valor (jsonb). Acesso só via service-role. Ex.: client_report_sections.';
