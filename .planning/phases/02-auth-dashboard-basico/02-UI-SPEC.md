---
phase: 2
slug: auth-dashboard-basico
status: approved
shadcn_initialized: true
preset: base-nova / baseColor neutral / cssVariables true / iconLibrary lucide
created: 2026-05-01
---

# Phase 2 — UI Design Contract
# Auth + Dashboard básico

> Contrato visual e de interação para a Fase 2. Gerado pelo gsd-ui-researcher. Verificado pelo gsd-ui-checker.
> Toda a copy desta fase está em pt-BR. Vocabulário proibido (LGPD): "diagnóstico", "tratamento", "cura".

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui v4.6.0 |
| Preset | style: `base-nova`, baseColor: `neutral`, cssVariables: true |
| Component library | `@base-ui/react` ^1.4.1 (primitivo do shadcn) |
| Icon library | `lucide-react` ^1.14.0 |
| Font | Geist Sans (variable `--font-geist-sans`) / Geist Mono (variable `--font-geist-mono`) |
| Mode | Light only (dark mode tokens presentes em globals.css mas não ativado nesta fase; Fase 9 habilita toggle) |

Fonte: `components.json` + `apps/web/package.json` + `apps/web/app/layout.tsx` — verificados no codebase.

---

## Componentes shadcn a Instalar

Instalar via `pnpm dlx shadcn add` dentro de `apps/web/`. Hoje apenas `button` e `utils` existem.

```bash
pnpm dlx shadcn add sidebar card table input label textarea select dialog dropdown-menu avatar badge form separator skeleton toast
```

| Componente | Onde é usado |
|------------|-------------|
| `sidebar` | `DashboardLayout` — sidebar fixa + Sheet mobile (D-09) |
| `card` | `/dashboard` — cards de resumo (D-11) |
| `table` | `/clientes` — tabela de clientes (D-12) |
| `input` | Formulários de auth + cliente |
| `label` | Todos os formulários |
| `textarea` | Campo `notes` no formulário de cliente (D-14) |
| `select` | Campo `gender` no formulário de cliente (D-14) |
| `dialog` | Modal de confirmação de exclusão de cliente (D-12 ações) |
| `dropdown-menu` | Dropdown "Sair" no header (D-10) |
| `avatar` | Avatar com inicial do terapeuta no header (D-10) |
| `badge` | Badge "Trial: X dias restantes" no header (D-10) |
| `form` | Integração shadcn Form + react-hook-form + Zod |
| `separator` | Separadores visuais na sidebar |
| `skeleton` | Loading states em tabela e cards |
| `toast` | Feedback de sucesso/erro em mutações de cliente |

Fonte: `02-RESEARCH.md` Standard Stack — shadcn/ui.

---

## Spacing Scale

Escala base-8. Todos os valores são múltiplos de 4px. shadcn/ui usa Tailwind spacing por default — manter sem override.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap entre ícone e texto em nav links, badges inline |
| sm | 8px | Padding interno de badges, gap entre avatar e nome |
| md | 16px | Padding de cards, inputs, células de tabela, itens de form |
| lg | 24px | Padding de seções (card body, form sections) |
| xl | 32px | Gap entre blocos maiores (cards de resumo entre si) |
| 2xl | 48px | Padding do layout auth (vertical breathing room) |
| 3xl | 64px | Padding de página em desktop (page-level) |

Exceções: touch targets mínimos de 44px em mobile (botões de ação na tabela em viewport < 768px).

Fonte: shadcn/ui defaults + WCAG 2.1 mínimo de touch target.

---

## Typography

Font: Geist Sans (sans-serif). Tailwind `font-sans` via `--font-sans: var(--font-geist-sans)`.

| Role | Size | Weight | Line Height | Onde é usado |
|------|------|--------|-------------|-------------|
| Body | 14px (`text-sm`) | 400 (regular) | 1.5 | Células de tabela, copy de suporte, labels de form, copy de rodapé LGPD |
| Label | 14px (`text-sm`) | 500 (medium) | 1.4 | Labels de campo de formulário, colunas de tabela, nav links da sidebar |
| Heading | 20px (`text-xl`) | 600 (semibold) | 1.3 | Títulos de seção (ex: "Clientes", "Nova Leitura"), títulos de card |
| Display | 28px (`text-2xl`) | 600 (semibold) | 1.2 | Título de página nas auth pages ("/signup", "/login"), título principal do dashboard |

Máximo 4 tamanhos, 3 pesos. Sem override de tipografia nesta fase — identidade visual completa fica para Fase 9.

Fonte: shadcn/ui base-nova defaults + `apps/web/app/layout.tsx`.

---

## Color

Paleta neutral achromática derivada diretamente dos CSS Variables em `globals.css` (base-nova, baseColor neutral). Nenhuma cor customizada nesta fase — identidade Aurel Iris (Fase 9).

| Role | CSS Variable | Valor OKLCH (light) | Uso |
|------|-------------|----------------------|-----|
| Dominant (60%) | `--background` | `oklch(1 0 0)` — branco | Background de página, surface padrão |
| Secondary (30%) | `--card` / `--sidebar` | `oklch(1 0 0)` / `oklch(0.985 0 0)` — branco levemente acinzentado | Cards de resumo, sidebar, áreas de navegação, form sections |
| Accent (10%) | `--primary` | `oklch(0.205 0 0)` — quase preto | **Reservado exclusivamente para:** botão primário (CTA principal), sidebar nav item ativo (indicador de rota atual), avatar background |
| Destructive | `--destructive` | `oklch(0.577 0.245 27.325)` — vermelho | Botão de exclusão de cliente, confirmação de delete no Dialog |
| Muted | `--muted-foreground` | `oklch(0.556 0 0)` — cinza médio | Copy de suporte, placeholders, rodapé LGPD, "última leitura" vazia |

Accent reservado para: botão primário, indicador de nav ativo na sidebar, avatar background. Não usar accent em elementos secundários, bordas, ou textos informativos.

Fonte: `apps/web/app/globals.css` — verificado no codebase.

---

## Layout Architecture

### Auth Layout (`app/(auth)/layout.tsx`)

```
┌────────────────────────────────────────────┐
│  [Espaço vertical 48px]                    │
│  ┌──────────────────────────────────────┐  │
│  │  Logo / Nome: "Aurel Iris"           │  │
│  │  Subtítulo LGPD (ver Copywriting)    │  │
│  ├──────────────────────────────────────┤  │
│  │  [form card centralizado max-w-sm]   │  │
│  └──────────────────────────────────────┘  │
│  [Espaço vertical 32px]                    │
│  Footer: copy LGPD obrigatória             │
└────────────────────────────────────────────┘
```

- Fundo: `bg-background` (branco)
- Card: `max-w-sm w-full mx-auto` com `border rounded-lg p-6` (usa shadcn `Card`)
- Footer fixo no bottom com copy LGPD (ver Copywriting Contract)

### Dashboard Layout (`app/(dashboard)/layout.tsx`)

Desktop (>= 768px):
```
┌──────────┬────────────────────────────────────┐
│          │  Header (h-14, border-b)            │
│ Sidebar  │  [nome + avatar + badge + dropdown] │
│  (w-64)  ├────────────────────────────────────┤
│  fixed   │                                     │
│  left    │  <main> page content                │
│          │  padding: 24px                      │
│          │                                     │
└──────────┴────────────────────────────────────┘
```

Mobile (< 768px):
```
┌────────────────────────────────────────────┐
│  Header (h-14)                             │
│  [Hamburger] [Logo] [Avatar + Dropdown]    │
├────────────────────────────────────────────┤
│                                            │
│  <main> page content                       │
│  padding: 16px                             │
│                                            │
└────────────────────────────────────────────┘
[Sidebar como Sheet drawer (shadcn Sheet)]
```

Fonte: D-09 (CONTEXT.md) — sidebar fixa desktop, Sheet mobile.

---

## Component Contracts

### AppSidebar (`components/dashboard/app-sidebar.tsx`)

- Largura fixa: `w-64` (256px) em desktop
- Background: `bg-sidebar` (`oklch(0.985 0 0)`)
- Nav links: Dashboard / Clientes / Leituras
- Link ativo: `bg-sidebar-accent text-sidebar-accent-foreground` + indicador visual (borda esquerda `2px solid primary` ou background `bg-sidebar-accent`)
- Ícones: lucide-react — `LayoutDashboard` (Dashboard), `Users` (Clientes), `Eye` (Leituras)
- Separador: shadcn `Separator` entre seções se necessário
- Mobile: não renderiza como sidebar — rendereizado como conteúdo do `Sheet` disparado pelo hamburger

### DashboardHeader (`components/dashboard/dashboard-header.tsx`)

- Altura: `h-14` (56px) com `border-b`
- Esquerda (mobile): botão hamburger `SidebarTrigger` do shadcn sidebar
- Centro/esquerda: nome da rota atual (opcional, via breadcrumb ou título simples)
- Direita: badge trial + avatar dropdown
- **Badge trial:** `<Badge variant="outline">Trial: {X} dias restantes</Badge>` — variante outline, não destructive. Quando trial < 3 dias: `variant="destructive"`.
- **Avatar:** `<Avatar>` com `<AvatarFallback>` mostrando inicial do `profiles.full_name` (ex: "R" para "Rhelton"). Background: `bg-primary`, texto: `text-primary-foreground`.
- **Dropdown:** shadcn `DropdownMenu` com único item "Sair" → dispara `supabase.auth.signOut()` + redirect para `/login`.

### SummaryCards (`components/dashboard/summary-cards.tsx`) — `/dashboard`

3 cards em grid `grid-cols-1 sm:grid-cols-3 gap-6`:

| Card | Título | Valor | Ícone |
|------|--------|-------|-------|
| Total de Clientes | "Clientes" | Contagem numérica de `clients` | `Users` |
| Leituras esta semana | "Leituras" | `0` (placeholder Fase 2) | `FileText` |
| Status da assinatura | "Assinatura" | "Trial ativo — {X} dias restantes" | `CreditCard` |

Loading state: cada card exibe `<Skeleton className="h-8 w-16" />` enquanto dados carregam.

### ClientsTable (`components/clientes/clients-table.tsx`) — `/clientes`

- Input de busca: `<Input placeholder="Buscar por nome..." />` acima da tabela, busca client-side no array carregado (filtro em `full_name.toLowerCase().includes(query)`)
- Colunas: Nome | Data de nascimento | Última leitura | Ações
- "Última leitura": célula vazia com texto `—` (muted) nesta fase
- Coluna Ações: 3 botões icon-only com `title` acessível: `Eye` (ver), `Pencil` (editar), `Trash2` (excluir)
  - Ver: `href="/clientes/{id}"`
  - Editar: `href="/clientes/{id}/editar"`
  - Excluir: abre `DeleteClientDialog`
- Loading state: 5 rows de skeleton enquanto dados carregam
- Empty state: quando lista filtrada = 0 (ver Copywriting)

### ClientForm (`components/clientes/client-form.tsx`) — `/clientes/novo` e `/clientes/[id]/editar`

Formulário com react-hook-form + Zod v4 + shadcn Form:

| Campo | Componente | Obrigatório | Validação |
|-------|-----------|-------------|-----------|
| `full_name` | `Input` | Sim | `z.string().min(1, 'Nome é obrigatório')` |
| `birth_date` | `Input type="date"` | Não | formato ISO date ou null |
| `gender` | `Select` | Não | enum: masculino/feminino/outro/não_informado |
| `notes` | `Textarea` | Não | string livre, max 2000 chars |

- Mensagens de erro: aparecem abaixo do campo, `text-sm text-destructive`
- Botão submit: label "Salvar cliente" (criar) / "Atualizar cliente" (editar)
- Botão cancelar: link/button "Cancelar" → volta para `/clientes`

### DeleteClientDialog (`components/clientes/delete-client-dialog.tsx`)

- shadcn `Dialog` disparado pelo botão Trash2 na tabela
- Título: "Excluir cliente"
- Corpo: copy de confirmação (ver Copywriting)
- Botões: "Cancelar" (variant=outline) + "Excluir" (variant=destructive)
- Após exclusão confirmada: `toast` com "Cliente excluído." + revalidação de `/clientes`

### ClientDetail (`app/(dashboard)/clientes/[id]/page.tsx`)

Estrutura da página:
1. **Cabeçalho:** Nome do cliente (heading), data de nascimento + gênero + notas (body/muted)
2. **Seção "Leituras":** Título "Leituras" + empty state (ver Copywriting) + botão "Nova Leitura" desabilitado com `title="Disponível na próxima versão"` e `disabled` prop
3. Botão "Editar cliente" (outline) no cabeçalho → `/clientes/{id}/editar`

### Leituras Placeholder (`app/(dashboard)/leituras/page.tsx`)

- Página simples com texto centralizado: "Leituras — em breve" + ícone `Eye` grande (muted)
- Copy: "A captura e análise de íris estará disponível em breve." (ver Copywriting)

---

## Form States

Todos os formulários desta fase devem implementar os 4 estados a seguir:

| Estado | Visual |
|--------|--------|
| Idle | Campos normais, botão submit habilitado |
| Loading/Submitting | Botão submit com `disabled` + spinner (lucide `Loader2` com `animate-spin`) + label "Salvando..." |
| Error (field) | Borda vermelha no campo (`ring-destructive`), mensagem abaixo do campo (`text-sm text-destructive`) |
| Error (form-level) | Alert vermelho no topo do form: `bg-destructive/10 border-destructive text-sm px-4 py-2 rounded` |
| Success | `toast` com mensagem de sucesso; redirect quando aplicável |

### Auth Form States Específicos

| Formulário | Estado após submit bem-sucedido |
|------------|--------------------------------|
| `/signup` | Não redireciona — exibe confirmation state (ver abaixo) |
| `/login` | Não redireciona — exibe confirmation state (ver abaixo) |

**Confirmation State (após envio do magic link):**
- O formulário é substituído por um card com:
  - Ícone `MailCheck` (lucide) centralizado, `text-primary`, tamanho 48px
  - Título: "Verifique seu e-mail" (heading)
  - Copy (ver Copywriting Contract)
- Não exibir o formulário novamente (evitar double-submit)

---

## Interaction Contracts

### Magic Link Flow

1. Usuário preenche e-mail (+ nome em /signup) → clica CTA
2. Server Action executa `signInWithOtp`
3. UI transiciona para Confirmation State (sem reload de página)
4. Usuário clica no link no e-mail → `/api/auth/callback` → redirect para `/dashboard`
5. Se callback falhar: redirect para `/login?error=auth_callback_failed` → toast "Link inválido ou expirado. Solicite um novo."

### Client Search (client-side)

- Input de busca: sem debounce (array já carregado, MVP tem dezenas de clientes)
- Filtro: `clients.filter(c => c.full_name.toLowerCase().includes(query.toLowerCase()))`
- Sem resultado: empty state (ver Copywriting)
- Busca é case-insensitive, sem normalização de acentos nesta fase

### Delete Client Flow

1. Usuário clica `Trash2` na linha da tabela
2. `DeleteClientDialog` abre (shadcn Dialog)
3. Usuário confirma clicando "Excluir" (destructive)
4. Dialog fecha, botão em estado loading
5. Server Action `deleteClientAction` executa
6. Toast "Cliente excluído." exibido; tabela re-renderiza sem o cliente

### Logout Flow

1. Usuário abre dropdown do avatar
2. Clica "Sair"
3. `supabase.auth.signOut()` executa (client-side)
4. Redirect para `/login`

### Navigation Guard

- Rotas protegidas: `/dashboard`, `/clientes`, `/leituras`
- Sem sessão → redirect para `/login` (middleware.ts)
- Logado tentando acessar `/login` ou `/signup` → redirect para `/dashboard` (middleware.ts)

---

## Copywriting Contract

> Toda a copy está em pt-BR. Vocabulário proibido: "diagnóstico", "tratamento", "cura".

### Auth Pages

| Elemento | Copy |
|---------|------|
| Título `/signup` | "Criar conta" |
| Subtítulo `/signup` | "Aurel Iris — apoio à anamnese terapêutica" |
| Label campo e-mail | "E-mail" |
| Label campo nome | "Nome completo" |
| CTA principal `/signup` | "Enviar link de acesso" |
| Título `/login` | "Entrar" |
| Subtítulo `/login` | "Acesse sua conta Aurel Iris" |
| CTA principal `/login` | "Enviar link de acesso" |
| Link de `/signup` para `/login` | "Já tem conta? Entrar" |
| Link de `/login` para `/signup` | "Primeira vez? Criar conta" |

### Confirmation State (após magic link enviado)

| Elemento | Copy |
|---------|------|
| Título | "Verifique seu e-mail" |
| Body | "Enviamos um link de acesso para **{email}**. Clique no link para entrar. O link é válido por 24 horas." |
| Nota de suporte | "Não recebeu? Verifique a pasta de spam ou tente novamente." |

### Dashboard

| Elemento | Copy |
|---------|------|
| Título da página `/dashboard` | "Dashboard" |
| Card "Total de clientes" | "Clientes" |
| Card "Leituras esta semana" | "Leituras esta semana" |
| Card "Status da assinatura" | "Assinatura" |
| Valor do card assinatura (trial ativo) | "Trial ativo — {X} dias restantes" |
| Valor do card assinatura (trial expirado) | "Trial encerrado — assine para continuar" |
| Badge trial (header, > 3 dias) | "Trial: {X} dias" |
| Badge trial (header, <= 3 dias) | "Trial: {X} dias" (variant destructive) |

### Clientes

| Elemento | Copy |
|---------|------|
| Título da página `/clientes` | "Clientes" |
| Botão novo cliente | "Novo cliente" |
| Placeholder input de busca | "Buscar por nome..." |
| Cabeçalho coluna "Nome" | "Nome" |
| Cabeçalho coluna "Data de nascimento" | "Nascimento" |
| Cabeçalho coluna "Última leitura" | "Última leitura" |
| Cabeçalho coluna "Ações" | "Ações" |
| Célula "Última leitura" vazia | "—" (muted) |
| **Empty state — sem clientes cadastrados** | |
| Heading | "Nenhum cliente ainda" |
| Body | "Cadastre seu primeiro cliente para começar." |
| CTA no empty state | "Novo cliente" |
| **Empty state — busca sem resultado** | |
| Heading | "Nenhum resultado para "{query}"" |
| Body | "Tente outro nome." |

### Formulário de Cliente

| Elemento | Copy |
|---------|------|
| Título `/clientes/novo` | "Novo cliente" |
| Título `/clientes/[id]/editar` | "Editar cliente" |
| Label `full_name` | "Nome completo" |
| Placeholder `full_name` | "Nome do cliente" |
| Erro `full_name` obrigatório | "Nome é obrigatório" |
| Label `birth_date` | "Data de nascimento" |
| Label `gender` | "Gênero" |
| Opções `gender` | "Masculino" / "Feminino" / "Outro" / "Não informado" |
| Placeholder `gender` (select) | "Selecione" |
| Label `notes` | "Notas" |
| Placeholder `notes` | "Observações relevantes para a anamnese..." |
| Botão submit criar | "Salvar cliente" |
| Botão submit editar | "Atualizar cliente" |
| Botão cancelar | "Cancelar" |
| Toast sucesso criar | "Cliente criado com sucesso." |
| Toast sucesso editar | "Cliente atualizado." |

### Detalhe do Cliente

| Elemento | Copy |
|---------|------|
| Título da seção de leituras | "Leituras" |
| Empty state leituras heading | "Nenhuma leitura ainda" |
| Empty state leituras body | "As leituras de íris deste cliente aparecerão aqui." |
| Botão "Nova Leitura" (desabilitado) | "Nova Leitura" (com `title="Disponível em breve"`) |
| Botão editar cliente | "Editar cliente" |

### Leituras Placeholder

| Elemento | Copy |
|---------|------|
| Título da página | "Leituras" |
| Heading | "Em breve" |
| Body | "A captura e análise de íris estará disponível em breve." |

### Ações de Tabela (icon-only — títulos acessíveis)

| Botão | `aria-label` / `title` |
|-------|------------------------|
| Eye (ver cliente) | "Ver cliente" |
| Pencil (editar cliente) | "Editar cliente" |
| Trash2 (excluir cliente) | "Excluir cliente" |

### Ações Destrutivas

| Ação | Confirmação |
|------|-------------|
| Excluir cliente | Dialog título: "Excluir cliente" / Body: "Esta ação não pode ser desfeita. Todos os dados de **{nome do cliente}** serão removidos permanentemente." / CTA: "Excluir" (destructive) / Cancelar: "Cancelar" |

### Copy LGPD Obrigatória

Aplicar em DUAS superfícies desta fase (não-negociável):

| Superfície | Copy | Posição |
|-----------|------|---------|
| `app/(auth)/layout.tsx` — footer | "Ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica." | `text-xs text-muted-foreground text-center` no rodapé da página |
| `app/(dashboard)/layout.tsx` — footer | "Ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica." | `text-xs text-muted-foreground` abaixo do conteúdo principal ou no rodapé da sidebar |

Fonte: LGPD constraint não-negociável de `PROJECT.md`, `REQUIREMENTS.md` LGPD-05/LGPD-06, `02-RESEARCH.md` Constraint LGPD.

### Error States

| Contexto | Copy |
|---------|------|
| Callback auth falhou (`?error=auth_callback_failed`) | Toast/alert: "Link inválido ou expirado. Solicite um novo link de acesso." |
| Erro genérico de formulário (network/server) | "Ocorreu um erro. Tente novamente." |
| E-mail não encontrado no login | (Supabase retorna erro) "Não encontramos uma conta com este e-mail. Deseja criar uma conta?" com link para `/signup` |
| Formulário de cliente — erro de servidor | "Erro ao salvar. Tente novamente." |
| Delete falhou | Toast destrutivo: "Não foi possível excluir o cliente. Tente novamente." |

---

## Accessibility Contract

- Todos os botões icon-only devem ter `aria-label` ou `title` descritivo em pt-BR
- Inputs de formulário: `id` + `htmlFor` em todos os labels (via shadcn FormLabel)
- Dialog: foco retorna ao trigger ao fechar (shadcn Dialog já implementa)
- Sidebar Sheet mobile: foco trapping e `aria-modal` (shadcn Sheet já implementa)
- Contraste mínimo: usar apenas cores dos CSS Variables — a paleta neutral do base-nova cumpre WCAG AA (verificado pelo shadcn)
- Loading states: `aria-busy="true"` no botão de submit durante submissão
- Avatar: `aria-label="{full_name} — menu da conta"` no trigger do DropdownMenu

---

## Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| < 640px (mobile) | Sidebar como Sheet drawer; padding 16px; cards em coluna única |
| 640px–1024px (tablet) | Sidebar Sheet ou colapsada; cards 2-col |
| > 1024px (desktop) | Sidebar fixa 256px; cards 3-col; tabela com todas as colunas |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn oficial (ui.shadcn.com) | sidebar, card, table, input, label, textarea, select, dialog, dropdown-menu, avatar, badge, form, separator, skeleton, toast | Não requerido — registry oficial |
| Terceiros | Nenhum | Não aplicável |

`components.json` registries: `{}` (vazio) — confirmado no codebase. Nenhum registro terceiro declarado.

Fonte: `apps/web/components.json` — verificado.

---

## Pre-Population Summary

| Campo | Fonte |
|-------|-------|
| Design system (shadcn, base-nova, neutral, lucide) | `components.json` — codebase |
| Font (Geist Sans) | `apps/web/app/layout.tsx` — codebase |
| CSS Variables (cores, radius) | `apps/web/app/globals.css` — codebase |
| Light-only mode | `02-CONTEXT.md` — Claude's Discretion (tema real Fase 9) |
| Sidebar lateral fixa, Sheet mobile | `02-CONTEXT.md` D-09 |
| Header: nome + avatar + badge + dropdown | `02-CONTEXT.md` D-10 |
| Cards de resumo no /dashboard | `02-CONTEXT.md` D-11 |
| Tabela /clientes com busca client-side | `02-CONTEXT.md` D-12 |
| Detalhe cliente + leituras vazias | `02-CONTEXT.md` D-13 |
| Campos do formulário de cliente | `02-CONTEXT.md` D-14 |
| Copy LGPD obrigatória (2 superfícies) | `REQUIREMENTS.md` LGPD-05/06 + `02-RESEARCH.md` |
| Vocabulário proibido | `REQUIREMENTS.md` Fora de Escopo + `02-RESEARCH.md` |
| Loading skeletons | `02-CONTEXT.md` — Claude's Discretion |
| Estados de erro UX | `02-CONTEXT.md` — Claude's Discretion |
| Busca client-side (sem debounce) | `02-RESEARCH.md` A2 (MVP com dezenas de clientes) |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS (FLAG não-bloqueante: "Cancelar" como dismiss secundário)
- [x] Dimension 2 Visuals: PASS (FLAG resolvido: títulos icon-only adicionados ao Copywriting Contract)
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-05-01

---

*Phase: 02-auth-dashboard-basico*
*UI-SPEC criado: 2026-05-01*
*Próximo: gsd-ui-checker verifica este contrato*
