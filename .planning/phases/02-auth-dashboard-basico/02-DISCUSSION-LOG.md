# Phase 2: Auth + Dashboard básico — Discussion Log

**Date:** 2026-05-01
**Areas discussed:** Fluxo Auth, SMTP Resend, Layout do dashboard
**Area skipped (by user):** Tema visual → usar shadcn defaults, deferido para Fase 9

---

## Área 1: Fluxo Auth

| Pergunta | Opções | Selecionado |
|----------|--------|-------------|
| Signup e login ficam em páginas separadas ou fluxo unificado? | Fluxo unificado / Páginas separadas | **Páginas separadas** |
| Na página de signup, quais dados além do e-mail? | Apenas e-mail / E-mail + nome / E-mail + nome + dados profissionais | **E-mail + nome completo** |
| Como o registro em `profiles` é criado? | Supabase trigger / API route no callback | **Supabase trigger** |
| Após magic link, para onde redirecionar? | /dashboard / Primeira vez → /dashboard, retorno → última página | **/dashboard** |

**Notas:** Trigger lê `raw_user_meta_data->>'full_name'` passado no `signUp()`. Trigger deve ser idempotente (`ON CONFLICT DO NOTHING`).

---

## Área 2: SMTP Resend

| Pergunta | Opções | Selecionado |
|----------|--------|-------------|
| Quando configurar Resend como SMTP? | Fase 2 / Defer para Fase 8/9 | **Configurar na Fase 2** |
| Template do magic link: padrão ou customizado? | Padrão do Supabase / Template customizado Aurel Iris | **Template customizado** |
| Endereço de remetente? | Domínio do fundador / Subdomínio do produto | **noreply@mail.soprodaorigem.com** (freeform) |

**Notas:** `mail.soprodaorigem.com` é subdomínio na Hostinger. DNS verification no Resend não interfere no site atual (Lovable). Resend SMTP: host smtp.resend.com, porta 465.

---

## Área 3: Layout do dashboard

| Pergunta | Opções | Selecionado |
|----------|--------|-------------|
| Navegação: sidebar ou topbar? | Sidebar lateral / Topbar | **Sidebar lateral** |
| Mobile: hamburger/drawer ou bottom nav? | Hamburger → drawer / Bottom navigation | **Hamburger → drawer (shadcn Sheet)** |
| /dashboard principal: o que aparece? | Cards de resumo / Redirect para /clientes | **Cards de resumo** |
| /clientes: tabela ou card grid? | Tabela simples + busca / Card grid | **Tabela simples + busca por nome** |
| /clientes/[id]: dados + leituras ou só dados? | Dados + histórico de leituras / Só dados cadastrais | **Dados + histórico de leituras** |
| Header do dashboard: quais elementos? | Nome + avatar + logout / Só logout | **Nome + avatar + dropdown logout + badge trial** |

**Notas:** Botão "Nova Leitura" em `/clientes/[id]` presente mas linkado para Fase 3 (disabled/tooltip ou link antecipado para `/leituras/nova`).

---

## Ideias diferidas

| Ideia | Destino |
|-------|---------|
| Tema visual (cor base, dark mode, tipografia) | Fase 9 — Polish |
| Edição de perfil completo (bio, phone, city) | Fase 9 ou sprint dedicado |
| Redirect `?next=` após login | Deferido — /dashboard fixo para o MVP |
| Rate limiting no endpoint de magic link | Fase 8/9 — antes do rollout externo |
| Avatar upload | Fase 9 |
