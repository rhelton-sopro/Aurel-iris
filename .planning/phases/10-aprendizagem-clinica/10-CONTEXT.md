---
phase: 10-aprendizagem-clinica
type: planning-context
status: backlog
created: "2026-05-04"
created_by: "founder (Rhelton)"
priority: high (long-term strategic differentiator)
depends_on: [phase-9]
prerequisite_data_capture_in: phase-7
---

# Fase 10 — Sistema de Aprendizagem Clínica

> **Status:** Backlog. Documentada como referência futura. **NÃO EXECUTAR AGORA.**
> Plan-phase só deve rodar depois da Fase 9 fechar com dogfooding consolidado.

## Contexto antes de planejar

O Iris Codex vai acumular dados únicos no mundo:

- **Features iridológicas** extraídas por OpenCV/Modal de fotos reais de smartphone
- **Relatórios gerados** pelo Sonnet (Fase 7)
- **Edições humanas** do terapeuta antes da entrega ao cliente
- **Feedback implícito**: o que foi mantido, o que foi corrigido, o que foi adicionado

Com 500–1000 leituras anotadas, temos um dataset que **nenhum software de iridologia no mundo possui**: interpretação clínica real de um iridologista experiente correlacionada com features computacionais extraídas de câmera de celular, em população brasileira contemporânea.

---

## Objetivo da Fase 10

Construir um sistema de aprendizagem clínica que:

### 1. Aprende com cada edição humana do relatório

- Salva o **diff** entre relatório gerado e relatório entregue
- Identifica padrões de correção recorrentes
- **Calibra o prompt do Sonnet automaticamente** com base nesses padrões

### 2. Descobre heurísticas emergentes

- Correlações entre features (zona X, densidade Y, pigmentação Z) e achados clínicos frequentemente relatados
- Padrões que o Jensen **não documenta** mas aparecem na prática real
- Divergências sistemáticas entre mapa Jensen e dados observados

### 3. Cria um scoring clínico próprio

- Em vez de thresholds fixos do OpenCV, aprende **quais combinações de features o iridologista marca como críticas**
- Modelo leve (scikit-learn, XGBoost ou similar — **planner decide**) treinável incrementalmente sem GPU
- Score de confiança por zona baseado em **dados reais, não teoria**

### 4. Sugere automaticamente

- Pré-preenche seções do relatório com base em padrões aprendidos
- Sinaliza zonas que historicamente recebem mais atenção clínica
- Identifica combinações raras que merecem destaque especial

---

## Arquitetura sugerida — princípios

> *Deixo ao planner encontrar o melhor caminho dentro destes princípios.*

### Princípios não-negociáveis

| Princípio | O que significa na prática |
|-----------|----------------------------|
| **Simplicidade operacional** | O terapeuta NÃO deve sentir que está "treinando um modelo" — deve ser invisível |
| **Privacidade by design** | Dados anonimizados, consentimento explícito (já coberto na Fase 8 LGPD) |
| **Incremental** | Funciona com 10 leituras, melhora com 1000 |
| **Auditável** | O terapeuta pode ver "por que o sistema sugeriu X" |
| **Reversível** | Qualquer heurística aprendida pode ser descartada |

### Componentes a avaliar (planner decide o melhor)

- **Armazenamento do diff** relatório gerado vs entregue
- **Estrutura de anotação** das edições (campos estruturados ou NLP?)
- **Pipeline de extração de padrões** (estatística clássica vs ML leve)
- **Frequência de retreino** (por leitura, por semana, por N leituras?)
- **Interface para o terapeuta** ver e validar o que o sistema aprendeu
- **Proteção contra overfitting** em dataset pequeno

---

## Dado mais valioso a capturar — implementar JÁ na Fase 7

> ⚠ **Pré-requisito crítico.** Sem esses dados desde o início, a Fase 10 não tem o que aprender. **Cada leitura sem esse registro é uma anotação perdida para sempre.**

A Fase 7 (Análise LLM) deve persistir, para cada leitura entregue:

| Campo | Tipo | Notas |
|-------|------|-------|
| `reading_id` | uuid | FK para `readings` |
| `relatório_gerado` | text | Texto completo do output do Sonnet 4.6 (antes de qualquer edição humana) |
| `relatório_entregue` | text | Texto após edição humana, no momento de entregar ao cliente |
| `timestamp_gerado` | timestamptz | Quando o Sonnet emitiu |
| `timestamp_entregue` | timestamptz | Quando o terapeuta clicou "entregar" |
| `zonas_editadas` | jsonb / array | Lista das zonas onde houve alteração (e.g., `["fígado", "rim direito"]`) |
| `tipo_edição` | enum / array | `adicionado` / `removido` / `corrigido` / `reescrito` |

**Schema sugerido (provisional):** nova tabela `report_edits` ou colunas adicionais em `readings`. Plan-phase da Fase 7 decide.

---

## Meta de longo prazo

Com dados suficientes, o Iris Codex pode publicar **o primeiro sistema de iridologia baseado em evidências computacionais de câmera de celular em população brasileira** — divergindo do Jensen onde os dados mostram padrões diferentes da teoria clássica.

Isso transforma o produto de:

> "software de iridologia"

em:

> **"sistema proprietário de análise iridológica"** — intransponível para qualquer concorrente sem anos de dados e um iridologista experiente no loop.

---

## Quando planejar

- **Gate:** Fase 9 (Polish + dogfooding + beta) **fechada com Estágio 1 consolidado** (fundador usou semanalmente em ≥3 clientes reais por 3 semanas consecutivas) e idealmente Estágio 2 também (5 terapeutas internos completaram 1 leitura cada).
- **Comando:** `/gsd-plan-phase 10` (quando o gate acima estiver verde).
- **Pré-checagem antes de planejar:** verificar que o schema de captura de dados da Fase 7 (`relatório_gerado`, `relatório_entregue`, `zonas_editadas`, `tipo_edição`) está populado em ≥50 leituras reais. Se não estiver, abrir um plan corretivo na Fase 7 ANTES de iniciar a Fase 10.

---

## Notas para o futuro planner

- O scope da Fase 10 é **deliberadamente vago neste documento**. O planner precisará fazer um discuss-phase profundo com o fundador para refinar — especialmente sobre frequência de retreino, interface de auditoria, e a fronteira entre "heurística sugerida" e "regra automática".
- Avaliar tooling: `dvc` para versionar datasets, `mlflow` para tracking de experimentos, `evidently` para drift detection — ou alternativas mais leves dependendo do volume de dados.
- Considerar se a Fase 10 deve ser uma **única fase grande** ou subdividida em **10.1 (data capture infrastructure pós-Fase-7), 10.2 (heurísticas emergentes via estatística clássica), 10.3 (scoring clínico ML)** etc.
- Investigar se existe corpus público de leituras iridológicas anotadas que possa servir de cold-start (provavelmente não — daí o valor único do dataset proprietário).

---

*Documento criado 2026-05-04 a partir de input direto do fundador. Não-acionável até gate de Fase 9 fechar.*
