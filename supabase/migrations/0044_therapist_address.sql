-- 0044: endereço do terapeuta.
-- Motivo (Fase 8): com NF-e ligada no Asaas, emitir a nota exige endereço
-- completo do tomador; sem ele o Asaas recusa a cobrança de cartão. O
-- antifraude de cartão também pondera o endereço. Reaproveita city/state
-- (legado Stripe, sem uso) e adiciona o que falta. Tudo nullable — a
-- completude é garantida no app (gate therapist-profile + form ViaCEP),
-- mesmo padrão de phone/cpf.
alter table public.profiles
  add column if not exists cep                 text,
  add column if not exists address             text,
  add column if not exists address_number      text,
  add column if not exists address_complement  text,
  add column if not exists district            text;

comment on column public.profiles.cep is 'CEP (8 dígitos, sem máscara) — endereço do terapeuta p/ NF-e e antifraude Asaas';
comment on column public.profiles.address is 'Logradouro (rua/av) — ViaCEP autofill';
comment on column public.profiles.address_number is 'Número (obrigatório no cadastro)';
comment on column public.profiles.address_complement is 'Complemento (opcional)';
comment on column public.profiles.district is 'Bairro — ViaCEP autofill';
-- profiles.city e profiles.state (UF) já existem e passam a guardar
-- cidade/UF do endereço (preenchidos pelo ViaCEP).
