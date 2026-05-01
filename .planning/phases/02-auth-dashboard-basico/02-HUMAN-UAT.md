---
status: partial
phase: 02-auth-dashboard-basico
source: [02-VERIFICATION.md]
started: 2026-05-01T12:28:07.159Z
updated: 2026-05-01T12:28:07.159Z
---

## Current Test

[aguardando testes humanos]

## Tests

### 1. Fluxo magic link end-to-end
expected: Terapeuta acessa /signup, preenche e-mail + nome, clica "Enviar link de acesso", recebe e-mail com link (via Resend SMTP ou SMTP built-in Supabase), clica no link, é redirecionado para /dashboard autenticado
result: [pending]

### 2. Trigger on_auth_user_created no banco remoto
expected: Após signup com magic link, `select * from public.profiles where id = auth.uid()` retorna 1 row com subscription_status='trial' e trial_ends_at ~14 dias no futuro
result: [pending]

### 3. Middleware redirecionando rotas protegidas
expected: Acessar /dashboard sem sessão redireciona para /login; acessar /login com sessão ativa redireciona para /dashboard
result: [pending]

### 4. CRUD completo de clientes com persistência real
expected: Criar cliente → aparece em /clientes; editar → dados atualizados; clicar Trash2 → dialog abre → confirmar → cliente removido da lista
result: [pending]

### 5. Dashboard exibindo dados reais do perfil logado
expected: Header mostra nome real do terapeuta (profiles.full_name) + badge "Trial: X dias"; cards mostram contagem real de clientes
result: [pending]

### 6. Isolamento RLS entre dois terapeutas
expected: Cliente criado pelo terapeuta A não aparece para terapeuta B (verificável via SQL no Supabase Dashboard ou criando duas contas de teste)
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
