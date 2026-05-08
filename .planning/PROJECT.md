# Aurel Iris

## O que é isto

Aurel Iris é um SaaS de leitura iridológica assistida por IA para terapeutas
integrativos, com pipeline em duas camadas: visão computacional dedicada
extrai *features* objetivas da íris a partir de fotos capturadas via PWA mobile
ou upload desktop, e um LLM (Claude Sonnet 4.6) interpreta essas features
ancorado em uma base de conhecimento iridológica indexada por RAG. O usuário do
produto é o terapeuta — pacientes/clientes finais não têm conta.

## Valor central

Cada cliente atendido produz um JSON de features genuinamente diferente, e por
isso cada relatório é genuinamente diferente. **Se a única coisa que funcionar
for esta — pipeline de visão produz JSON ancorado, LLM gera relatório
hipotético citando esse JSON — o produto entrega valor.** Tudo o mais (PWA
polida, billing, onboarding) é tração; isto é o coração.

## Métrica de sucesso do MVP

**Estágio 1 (gate primário):** durante 4 semanas consecutivas, o fundador
realiza ≥3 leituras/semana em clientes reais, entrega o relatório gerado pelo
Aurel Iris (com edições do terapeuta) ao cliente como parte oficial da
anamnese, e ao fim das 4 semanas responde afirmativamente a: *"Eu pagaria
R$ 189/mês por essa ferramenta se não fosse meu produto?"* Dogfooding em
ambiente de anamnese real, com entrega oficial e teste de disposição a pagar,
é a única prova honesta de que a leitura é útil no fluxo terapêutico.

**Estágio 2 (após Estágio 1 validado):** beta fechado com 10–20 terapeutas
selecionados (ver SPEC §7 Fase 8) — esta é meta de validação externa, **não
substitui o gate de dogfooding** e só é desbloqueada quando as 4 semanas
do Estágio 1 estiverem cumpridas com resposta afirmativa ao teste de
disposição a pagar.

## Requisitos

### Validados

<!-- Lançado e confirmado valioso. -->

(Nenhum ainda — entregar para validar)

### Ativos

<!-- Escopo atual. Construindo em direção a estes. -->

Ver `.planning/REQUIREMENTS.md` para a lista canônica numerada (v1) com mapeamento por fase.

Resumo das categorias v1:
- **SETUP** — infraestrutura, contas, schema do banco
- **AUTH** — Supabase Auth (email + magic link)
- **CLIENT** — CRUD de clientes do terapeuta
- **CAPTURE** — captura mobile PWA com validação on-device
- **UPLOAD** — upload desktop com mesma estrutura de armazenamento
- **VISION** — pipeline Modal (`detect → segment → compose → normalize → enhance → features`)
- **RAG** — ingestão one-shot + recuperação contextual via pgvector
- **LLM** — análise Claude Sonnet 4.6 com streaming e provenance ancorado
- **BILLING** — Stripe BR (BRL + PIX), três tiers, trial de 14 dias
- **LGPD** — termo de consentimento, criptografia, logs, direito de exclusão
- **ONBOARD** — onboarding em 3 passos, e-mail transacional Resend

### Fora de escopo

<!-- Limites explícitos. Inclui justificativa para evitar re-adição. -->

Origem: SPEC §9 "Decisões em aberto pra v2".

- **Análise temporal evolutiva** (comparar leituras do mesmo cliente ao longo do tempo) — escopo de v2; complexidade não justificada no MVP que valida a leitura unitária.
- **Multi-mapa simultâneo** (Jensen + Hidalgo + Jausas comparativos) — UX e implementação maiores que retorno; v1 fixa em mapa Jensen como default.
- **White-label para escolas de iridologia** — diferenciação comercial pós-PMF.
- **Banco anônimo de casos para CNN própria** — efeito de rede de longo prazo (SPEC §4.4); MVP usa heurísticas + modelos pré-treinados.
- **Modo formação** (estudantes consomem casos com quizzes) — segmento adjacente, distrai do PMF do terapeuta.
- **Integração FHIR / prontuário eletrônico** — fora do perfil do usuário-alvo (terapeuta integrativo independente).
- **API pública para embed em sites próprios** — depende de PMF e de SLA de inferência maduro.
- **Diagnóstico clínico** — proibido por posicionamento e por LGPD; ver "Restrições" abaixo.

## Contexto

- **Categoria de produto:** SaaS B2B vertical para terapeutas integrativos.
  Posicionamento explícito: *ferramenta de apoio à anamnese*, jamais
  diagnóstico — decisão de produto e blindagem jurídica simultaneamente.
- **Diferencial estratégico:** pipeline de duas camadas. A objetividade do JSON
  de visão (auditável, com `processing_metadata.model_version`) é o que
  defende o produto contra a crítica de "LLM viajando". Cada interpretação no
  relatório precisa citar a feature que a ancora (`[ancorado em: features.X]`).
- **Tradição de referência:** Bernard Jensen, Daniele Lo Rito, Vida Battello,
  Joseph Deck, Theodor Lindemann, escola brasileira contemporânea. Corpus RAG
  inicial mínimo viável: Jensen *Iridologia Vol. 1* (escola americana, pt) +
  Battello *Iridologia Clínica* (escola italiana, pt) + ao menos uma obra
  cobrindo explicitamente a dimensão psicoemocional/simbólica (Lo Rito ou
  Lindemann, pt). Três autores de tradições distintas (americana, italiana,
  alemã/simbólica) garantem diversidade interpretativa proporcional ao escopo
  do prompt do sistema (que cobre constituição, psicossomática, simbólico
  e cargas temporais).
- **Tom de voz nas afirmações** (Seção 11 do relatório): estilo Aurel Maat,
  ressonante com *"Tudo na vida acontece em favor do meu crescimento."* —
  profundo mas acessível, hipotético, reverente sem misticismo vago.
- **Escala MVP:** 10–20 terapeutas no beta fechado, custo operacional alvo
  ~US$ 100–150/mês (SPEC §1).
- **Tese de moat (futuro, não-MVP):** banco anonimizado de casos com
  consentimento alimenta CNNs próprias para detecção de lacunas/criptas em v2.

## Restrições

Origem: 21 constraints sintetizadas de `SPEC.md` (ver
`.planning/intel/constraints.md`). Estas são **a intenção declarada do
usuário** e estão registradas como "decididas, ainda não ratificadas por ADR"
— qualquer fase futura pode honrar ou re-decidir formalmente via ADR.

### Restrições não-negociáveis (jurídico/produto)

- **Posicionamento (LGPD + produto):** todo relatório, UI e copy de marketing
  deve usar linguagem hipotética. Vocabulário **proibido** em qualquer
  superfície do produto: "diagnóstico", "tratamento", "cura". Copy obrigatória
  no encerramento de relatório (literal, ver SPEC §6): "ferramenta de apoio à
  anamnese terapêutica integrativa, não substitui avaliação médica".
- **LGPD — categoria sensível:** foto de íris é dado biométrico + dado de
  saúde. Termo de consentimento por cliente, criptografia em repouso (Supabase)
  e em trânsito (HTTPS), bucket privado por terapeuta com RLS, direito de
  exclusão cascateado, logs de acesso a imagens. Revisão jurídica de healthtech
  (~R$ 2–4k) recomendada antes do lançamento público.
- **Ancoragem do prompt:** cada interpretação no relatório LLM **deve** citar
  a feature do JSON que a ancora; sinais não detectados no JSON não podem ser
  especulados pelo LLM.
- **Edição humana obrigatória antes da entrega:** nenhum relatório é
  entregável ao cliente sem ter passado pelo fluxo de revisão/edição do
  terapeuta. A UI deve marcar visualmente o status do relatório (`rascunho_ia`
  vs `revisado_terapeuta`), e a função de `marcar_como_entregue` só desbloqueia
  após `ai_report_edited` ter sido salvo (mesmo que igual ao raw, exige ação
  consciente do terapeuta). Esta restrição é simultaneamente blindagem
  jurídica (responsabilidade clínica recai no humano licenciado, nunca na IA)
  e qualidade de produto (terapeuta vira coautor, não consumidor passivo).

### Restrições de stack (decididas, sem ADR ratificado)

| Camada | Decisão | Origem |
|---|---|---|
| Frontend + API | Next.js 15 (App Router) na Vercel, TypeScript, Tailwind, shadcn/ui | SPEC §1, §2 |
| Auth | Supabase Auth, email + magic link, middleware de proteção | SPEC §1, §7 Fase 1 |
| Banco + vetor | Supabase Postgres + pgvector (HNSW, `vector_cosine_ops`, dim 1024) | SPEC §1, §3 |
| Storage | Supabase Storage, bucket privado por terapeuta + RLS, URLs assinadas | SPEC §1, §8 |
| Pagamento | Stripe Brasil com PIX, BRL, três tiers, trial 14 dias, webhook-driven | SPEC §1, §7 Fase 7 |
| Visão | Modal.com serverless GPU T4 (Python/OpenCV), timeout 120s, callback HMAC | SPEC §1, §4 |
| LLM | Claude Sonnet 4.6 via API Anthropic, streaming, output pt-BR | SPEC §1, §6 |
| Embeddings | Voyage AI `voyage-3` (dim 1024), batch ≤ 128 | SPEC §1, §5 |
| E-mail | Resend (transacional) | SPEC §1, §7 Fase 8 |

Detalhamento completo (schemas, contratos de API, NFRs) em
`.planning/intel/constraints.md`. Todas com `locked: false` no synthesizer
porque nenhum ADR foi ingerido — futuras fases podem promover seletivamente
para ADR.

### Restrições operacionais e de envelope

- **Custo operacional:** alvo ~US$ 100–150/mês a 10–20 terapeutas (Vercel Pro
  $20, Supabase Pro $25, Modal $30–80, Anthropic ~$0,30/análise, Voyage ~$20
  one-time).
- **Runtime alvo:** Web Next.js 15 na Vercel + PWA mobile (iOS Safari + Chrome
  Android) para captura. Nenhum app nativo no MVP.
- **Idioma do produto:** pt-BR para UI, relatórios, prompts e documentação de
  planejamento.

## Decisões-chave

<!-- Decisões que restringem trabalho futuro. Adicionar ao longo do ciclo. -->

| Decisão | Justificativa | Resultado |
|---------|---------------|-----------|
| Stack inteira herdada do SPEC (Next.js / Supabase / Modal / Sonnet 4.6 / Voyage / Stripe / Resend) | Decisão deliberada do fundador no SPEC; integração entre camadas já validada mentalmente | — Pendente (sem ADR; honrar até prova em contrário) |
| Pipeline de duas camadas (visão dedicada + LLM com RAG), em vez de prompt-only | JSON objetivo e auditável é o moat de defensibilidade contra "LLM viajando" | — Pendente (a provar em Fase 5–7) |
| Ancoragem obrigatória de toda interpretação a uma feature do JSON | Postura jurídica + qualidade da leitura | ✓ Implementado em Fase 7 (`runAudit` anchor rate ≥95% + `markReadingDelivered` rejeita `low_anchor_rate`); SC3 — verificação contra relatórios reais — pendente em founder UAT |
| Linguagem hipotética + vocabulário proibido em todas as superfícies | LGPD (dado sensível biométrico/saúde) + posicionamento como apoio à anamnese | ✓ Implementado em Fase 7 (`FORBIDDEN_VOCAB_RE` word-boundary D-A2 + system prompt SPEC §6); auditar 10 relatórios reais em founder UAT |
| Edição humana obrigatória antes da entrega ao cliente | Blindagem jurídica (responsabilidade clínica recai no humano) + qualidade de produto (terapeuta vira coautor) | ✓ Implementado em Fase 7 (`/leituras/[id]/editar` Server Actions com guards: `ENCERRAMENTO_LITERAL` overwrite, empty-content block, terminal-state `is_delivered` lock) |
| Métrica de sucesso primária = uso semanal real pelo próprio fundador (4 semanas, ≥3/sem, com entrega oficial e teste de disposição a pagar) antes de beta externo | Dogfooding em anamnese real é o único teste honesto de utilidade clínica | — Pendente (gate de saída da Fase 9) |
| Mapa Jensen como default no MVP; Jausas/Hidalgo deferidos para v2 | Multi-mapa simultâneo aumenta escopo de UI sem retorno proporcional no MVP | ✓ Boa (descopo limpo) |
| RAG seed mínimo viável: Jensen + Battello + Lo Rito (ou Lindemann) | Cobertura proporcional ao escopo do prompt (físico + psicoemocional + simbólico); apenas Jensen+Battello cobre o eixo físico mas deixa o eixo psicoemocional/simbólico raspando o tacho rápido; expansão pós-beta | — Pendente; se Lo Rito/Lindemann em pt-BR não estiverem digitalizados no momento da Fase 5, registrar como dívida técnica explícita a ser quitada antes do gate de Estágio 1 |
| Heurísticas OpenCV + MediaPipe no MVP, U-Net/CNN próprias em v1.1+ | Acelera MVP; o moat de CNNs próprias depende de banco de casos consentido (efeito de rede) | — Pendente |
| Trial de 14 dias automático com middleware de bloqueio | Padrão SaaS; reduz fricção de aquisição mantendo custo controlado | — Pendente |

---
*Última atualização: 2026-04-30 após bootstrap inicial a partir de doc-ingest do SPEC.md, com refinamentos pós-revisão (métrica de sucesso falsificável, edição humana obrigatória, RAG seed ampliado).*