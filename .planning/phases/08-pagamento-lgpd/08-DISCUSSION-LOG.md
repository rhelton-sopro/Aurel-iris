# Phase 8: Pagamento + LGPD - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 08-pagamento-lgpd
**Areas discussed:** Add-ons opcionais (feature boundary), LGPD-01 termo + LGPD scope corte, Trial + dunning (lifecycle)
**Areas selecionadas mas NÃO discutidas (founder dropou da lista):** Estrutura híbrida + pricing em R$
**Notas de processo:** Founder respondeu Área 1 (Add-ons) com spec comprehensive de TODA a Fase 8 em duas mensagens grandes — invalidou o "modelo híbrido assinatura+add-ons" inicialmente locked e substituiu por "pacote pré-pago de créditos". Discussão das outras áreas (LGPD, Lifecycle) absorveu naturalmente neste mesmo fluxo. Trial+dunning foi efetivamente fechado na primeira resposta (trial spec completo; dunning N/A pré-pago).

---

## Área 1 — Add-ons opcionais (feature boundary) → virou "Estrutura completa do modelo"

### Pergunta 1 — O que está incluso no plano base (assinatura mensal)?

| Option | Description | Selected |
|--------|-------------|----------|
| Leituras ilimitadas (Recomendado) | Plano base = R$X/mês, terapeuta gera quantas leituras quiser. Add-ons são features-extra (não quantidade). | |
| N leituras/mês + overage avulso | Plano base = R$X/mês inclui N leituras, acima cobra R$Y por extra via Asaas avulso. | |
| Tiered (Básico/Pro/Premium) com limites diferentes | 3 preços fixos, cada um com limite próprio. | |
| Other (founder freeform) | — | ✓ |

**User's choice:** Founder rejeitou TODAS as opções e propôs modelo completamente diferente: **Pacote pré-pago de créditos** (NÃO subscription). Spec completo incluindo trial (3 leituras OU 60d), 4 SKUs (Avulsa R$99,70 / Pequeno R$298,50 / Médio R$745,50 / Grande R$1.191), consumo FIFO, validade 12m, arrependimento 7d, founder internal_use flag, Asaas pagamento avulso, schema esboçado.

**Notas:** Founder colapsou múltiplas perguntas em uma resposta enorme. Spec literal capturada em CONTEXT.md D-01..D-09 + D-13..D-14. "Aguardo confirmação que captou todas as decisões antes de começar a implementar."

### Pergunta 2 — Avulsa R$99,70: cliente paga ANTES ou DEPOIS de gerar o relatório?

| Option | Description | Selected |
|--------|-------------|----------|
| ANTES (checkout síncrono → então gera) — Recomendado | Cliente clica 'gerar', cai em checkout Asaas, paga, webhook confirma, aí dispara Sonnet. | |
| DEPOIS (gera → preview → paga pra desbloquear) | Sonnet gera, mostra preview parcial, paga pra ler o resto. | |
| DEPOIS sem preview (gera → débito imediato pós-conclusão) | Conforme spec literal: 'débito imediato após geração'. | |
| Other (founder freeform) | — | ✓ |

**User's choice:** Founder respondeu com OUTRA expansion: introduziu **Verificação de saldo em 3 momentos** + **Reserva temporária 7 dias**. Spec literal capturada em CONTEXT.md D-10..D-11.

**Notas:** Reserva ocorre em (1) criar link remoto, (2) iniciar captura consultório, (3) gerar relatório. Avulsa "também entra como reserva temporária" — clarificado em pergunta seguinte.

### Pergunta 3 — Cliente em trial pode comprar pacote antecipado?

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, qualquer hora — Recomendado | Reduz fricção de abandono. Créditos comprados só consumidos pós-trial. | ✓ |
| Só após exaurir trial | Mais ortodoxo mas perde momentum. | |
| Avulsa sim, pacote não | Avulsa como urgência durante trial; pacote só pós-trial. | |

**User's choice:** "Sim, qualquer hora — Recomendado"

### Pergunta 4 — CNPJ do founder pra NF automática Asaas?

| Option | Description | Selected |
|--------|-------------|----------|
| Já tenho CNPJ ativo (MEI ou LTDA) | Asaas + NF emite normalmente desde dia 1. | ✓ |
| Vou abrir antes do launch | Tarefa externa, bloqueia LIVE mas não dev. | |
| Não sei — precisa investigar | Asaas aceita PF pra cobrança mas NF exige CNPJ. | |

**User's choice:** "Já tenho CNPJ ativo (MEI ou LTDA)"

### Pergunta 5 — Avulsa R$99,70 vira o quê após pagamento confirmado?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 leitura, SEM validade 12m, COM reserva 7d | Avulsa não expira mas usa mesmo mecanismo de reserva. | |
| 1 leitura, COM validade 12m + reserva 7d | Avulsa segue mesma regra de pacote: vence em 12m. Mais consistente schema-wise. | ✓ |
| Outro | — | |

**User's choice:** "Crédito de 1 leitura, COM validade 12m + reserva 7d"

### Pergunta 6 — Anti-evasão de trial multi-conta?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedup por CPF + telefone no signup (Recomendado) | Validação básica + Receita Federal API. | |
| Dedup só por e-mail (mais fraco) | Evasão trivial via gmail+1. | |
| Monitorar manualmente no MVP | Sem dedup, observa cadência. | |
| Reservar pra V1.1 | Adia decisão. | |
| Other (founder freeform) | — | ✓ |

**User's choice:** Founder respondeu freeform com versão refinada: "CPF + telefone obrigatório, validação básica de formato (regex CPF + DDD). Validação fiscal via API Receita pode ficar pra V1.1. Trial só ativa se CPF E telefone únicos. Se duplicado: bloqueia novo signup, mostra 'já existe cadastro com esse CPF, faça login'."

**Notas:** Capturada em CONTEXT.md D-12.

---

## Área 2 — LGPD-01 termo + LGPD scope corte

### Pergunta 7 — LGPD escopo na Fase 8: como tratar os 6 LGPD-01..06?

| Option | Description | Selected |
|--------|-------------|----------|
| Mínimo agora + nova fase pra escopo completo (Recomendado) | Fase 8 inclui só LGPD-05 + LGPD-06. Resto pra Fase 8.2. | |
| Pagamento só — LGPD vira fase nova totalmente | Fase 8 fica scoped a pagamento. LGPD vira Fase 12. | |
| Tudo agora em Fase 8 (LGPD-01..06 + pagamento) | Mantém boundary original. | |
| Other (founder freeform) | — | ✓ |

**User's choice:** Founder propôs **OPÇÃO MISTA** — Fase 8 inclui Pagamento + LGPD-01 + LGPD-02 + LGPD-05 + LGPD-06 + LGPD-03 BÁSICO + LGPD-04 BÁSICO. Fase 8.1+ = LGPD-03 completo + LGPD-04 completo. Justificativa explícita: "LGPD-01 é bloqueador absoluto. Foto de íris é dado biométrico (categoria sensível LGPD). Sem termo formal de consentimento, qualquer uso real com cliente final do terapeuta é violação direta."

**Notas:** Capturada em CONTEXT.md D-15..D-16.

### Pergunta 8 — LGPD-01 ferramenta de assinatura?

| Option | Description | Selected |
|--------|-------------|----------|
| Solução nativa Iris Codex (Recomendado) | PDF gerado por nós + aceitar com IP+timestamp+CPF + hash SHA256. | ✓ |
| DocuSeal (open source) | Free tier. Valor probatório médio. Adiciona dependência. | |
| Clicksign (BR-native, ICP-Brasil) | Valor probatório alto. ~R$2-5 por assinatura. | |

**User's choice:** "Solução nativa Iris Codex (Recomendado)"

### Pergunta 9 — TOS terapeuta (uso do produto): como aceita?

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox no signup (Recomendado) | Reusa legal/term-v1.md AI-drafted. | ✓ |
| PDF assinado via ferramenta acima | Mais forte mas adiciona fricção signup. | |
| Aceite em 2 momentos (checkbox + PDF antes 1º pagamento) | Híbrido. | |

**User's choice:** "Checkbox no signup (Recomendado)"

### Pergunta 10 — Termo cliente do terapeuta (foto íris = biométrico): quando assina?

| Option | Description | Selected |
|--------|-------------|----------|
| Antes de criar link remoto OR iniciar captura no consultório (Recomendado) | Bloqueia fluxo no ponto onde foto seria gerada. Alinha com reserva. | ✓ |
| Antes de gerar relatório (mas captura já ocorreu) | Foto biométrica capturada sem termo formal por período curto. | |
| Antes da PRIMEIRA leitura; depois vale pra todas | Cliente assina uma vez. Reduz fricção em leituras subsequentes. | |

**User's choice:** "Antes de criar link remoto OR iniciar captura no consultório (Recomendado)"

---

## Área 3 — Trial + dunning (lifecycle)

**Status:** Efetivamente FECHADA durante a resposta comprehensive da Pergunta 1. Decisões locked em CONTEXT.md D-06..D-09 (trial) e D-05 (sem dunning porque pré-pago). Nenhuma pergunta individual feita após.

---

## Confirmação final

| Option | Description | Selected |
|--------|-------------|----------|
| Sim — escreve CONTEXT.md | Fecha discuss-phase. Próximo `/gsd-plan-phase 8`. | ✓ |
| Falta algo — me explica | Continua discutindo. | |
| Quero ajustar uma decisão anterior | Refina. | |

**User's choice:** "Sim — escreve CONTEXT.md"

---

## Claude's Discretion

Founder explicitly delegou ao planner os seguintes detalhes técnicos (capturados em CONTEXT.md `<decisions>` § Claude's Discretion):
- Implementação técnica do webhook Asaas (Zod schema, idempotência, retries)
- Detalhe da migration order, índices, FKs cascateadas
- UI specifics de "Processos em andamento" (table vs cards, filtros)
- LGPD-04 básico: quais eventos exatamente logar
- LGPD-03 básico: template do email de "pedir deleção" + SLA de resposta
- Templates dos 3 emails de aviso de expiração (30d, 7d, day-of)

## Deferred Ideas

Capturadas em CONTEXT.md `<deferred>`:
- Add-ons opcionais (PDF brandado, white-label, multi-terapeuta, exportação massa) — fase futura
- Subscription mensal recorrente — V1.1+
- LGPD-03 completo (export/delete self-service) — Fase 8.1+
- LGPD-04 completo (dashboard auditoria configurável) — Fase 8.1+
- Validação fiscal CPF via API Receita Federal — V1.1+
- Extensão manual de créditos expirados — caso-a-caso suporte (não-coded V1)
- Notification de trial faltando pouco — não-coded V1
- Multi-terapeuta / Escola (white-label leve) — quando primeira escola aparecer

## Escopo invalidado nesta sessão

- "Modelo híbrido (assinatura + add-ons)" registrado em memory `project_fase_8_payment_provider_asaas` foi REVERTIDO — modelo correto é pacote pré-pago. Memory será atualizada no commit desta sessão.
- ROADMAP.md Fase 8 Success Criterion 1 mencionava "três tiers (Starter R$ 89, Profissional R$ 189, Escola R$ 490)" — OBSOLETO; substituído pelos 4 SKUs (Avulsa + Pequeno + Médio + Grande) acima.
- REQUIREMENTS.md BILLING-01 menciona "Stripe Checkout BR" — também OBSOLETO; substituído por Asaas pagamento avulso. REQUIREMENTS update ficará pra plan-phase ou fase futura de cleanup.
