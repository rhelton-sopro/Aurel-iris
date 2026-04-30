# Aurel Iris — Especificação Técnica do MVP

Software SaaS de leitura iridológica assistida por IA para terapeutas integrativos. Pipeline em duas camadas: visão computacional dedicada extrai features objetivas da íris, LLM interpreta usando base de conhecimento iridológica indexada (RAG).

> **Disclaimer estrutural do produto:** todos os relatórios são gerados em linguagem hipotética, posicionando o software como ferramenta de apoio à anamnese — nunca como diagnóstico. Esta postura é decisão de produto e blindagem jurídica simultaneamente.

---

## 1. Stack Tecnológico

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend + API | Next.js 15 (App Router) na Vercel | Já em uso, integra com tudo |
| Mobile capture | PWA com getUserMedia + MediaPipe | Roda no Safari/Chrome mobile sem app nativo |
| Auth | Supabase Auth | Email + magic link, integrado com DB |
| Banco | Supabase Postgres + pgvector | Banco + vector store em um lugar só |
| Storage de imagens | Supabase Storage | Bucket privado por terapeuta, RLS nativa |
| Pagamento | Stripe (BRL + PIX) | PIX já liberado no Stripe Brasil |
| Pipeline de visão | Modal.com (Python/OpenCV) | Serverless com GPU, ideal pra workloads de visão sob demanda |
| LLM | Claude Sonnet 4.6 via API Anthropic | Melhor pra texto longo estruturado em pt-BR |
| Embeddings (RAG) | Voyage AI (`voyage-3`) | Multilíngue de qualidade, recomendado pela Anthropic |
| Email transacional | Resend | Recibos, confirmações, exportações |

**Custos estimados pra 10-20 terapeutas no MVP:** Vercel Pro $20/mês, Supabase Pro $25/mês, Modal pay-per-use (~$30-80/mês nesse volume), Anthropic API (~$0,30 por análise no Sonnet 4.6), Voyage embeddings (custo único de indexação ~$20). **Total operacional: ~$100-150/mês.**

---

## 2. Estrutura de Pastas

```
aurel-iris/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── clientes/
│   │   │   ├── page.tsx
│   │   │   ├── novo/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── leituras/
│   │   │   ├── page.tsx
│   │   │   ├── nova/
│   │   │   │   ├── page.tsx           # escolhe modo: captura mobile ou upload
│   │   │   │   ├── capturar/page.tsx  # PWA com câmera
│   │   │   │   └── upload/page.tsx    # upload desktop
│   │   │   └── [id]/
│   │   │       ├── page.tsx           # visualizar relatório
│   │   │       └── editar/page.tsx    # terapeuta anota/edita
│   │   ├── assinatura/page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── readings/
│   │   │   ├── create/route.ts
│   │   │   ├── [id]/route.ts
│   │   │   └── [id]/process/route.ts  # dispara pipeline
│   │   ├── vision/
│   │   │   └── webhook/route.ts       # callback do Modal
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts
│   │   │   └── webhook/route.ts
│   │   └── rag/
│   │       └── search/route.ts
│   └── layout.tsx
├── components/
│   ├── capture/
│   │   ├── CameraView.tsx             # getUserMedia + overlay
│   │   ├── IrisDetector.tsx           # MediaPipe wrapper
│   │   ├── QualityIndicator.tsx       # feedback ao vivo
│   │   └── CaptureFlow.tsx            # orquestra 3 fotos × 2 olhos
│   ├── upload/
│   │   └── ImageUploader.tsx          # dropzone desktop
│   ├── reading/
│   │   ├── ReportViewer.tsx
│   │   ├── ReportEditor.tsx
│   │   ├── IrisMap.tsx                # mapa setorial visual
│   │   └── FeaturesPanel.tsx
│   └── ui/                             # shadcn/ui
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── anthropic/
│   │   ├── client.ts
│   │   └── analyze.ts                 # função principal de análise
│   ├── vision/
│   │   └── modal-client.ts            # chama serviço Modal
│   ├── rag/
│   │   ├── embed.ts
│   │   ├── search.ts
│   │   └── chunk.ts
│   ├── stripe/
│   │   └── client.ts
│   └── utils.ts
├── prompts/
│   ├── system.md                       # prompt base do analista
│   ├── feature-injection.md            # template que recebe JSON da visão
│   └── report-structure.md             # estrutura do relatório
├── vision-service/                     # repositório separado (Modal)
│   ├── modal_app.py
│   ├── pipeline/
│   │   ├── detect.py
│   │   ├── segment.py
│   │   ├── compose.py
│   │   ├── normalize.py
│   │   ├── enhance.py
│   │   └── features.py
│   ├── models/                         # pesos pré-treinados
│   └── requirements.txt
├── scripts/
│   ├── ingest-knowledge.ts             # roda 1x: indexa PDFs no pgvector
│   └── seed-iris-maps.ts
├── public/
└── types/
    ├── database.ts                     # gerado pelo Supabase
    ├── reading.ts
    └── iris-features.ts
```

---

## 3. Schema do Banco (Supabase Postgres)

```sql
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

-- Policy exemplo (replicar pra todas as tabelas relevantes)
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
```

---

## 4. Pipeline de Visão Computacional

Serviço Python rodando no **Modal** (serverless GPU), chamado via webhook a partir do Next.js. Recebe URLs assinadas das imagens no Supabase Storage, processa, e devolve JSON estruturado de features.

### 4.1 Validação on-device (browser, antes do upload)

Roda em JavaScript no celular do terapeuta, em tempo real:

```typescript
// components/capture/IrisDetector.tsx (resumo)

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// MediaPipe Face Mesh já tem landmarks específicos da íris
// Indices 468-477 (olho direito) e 473-477 (olho esquerdo)

async function validateFrame(videoFrame): Promise<QualityCheck> {
  const result = await landmarker.detectForVideo(videoFrame, performance.now());

  return {
    irisDetected: result.faceLandmarks.length > 0,
    irisCenteredness: computeCenterness(result), // 0-1
    irisDistanceOk: computeIrisRadius(result) > MIN_PX,
    sharpness: laplacianVariance(videoFrame),     // > 100 ok
    exposure: histogramAnalysis(videoFrame),      // não saturado
    reflexInIrisCenter: detectSpecularReflex(result),
    eyelidOcclusion: computeOcclusion(result),
    overallScore: ...
  };
}
```

UI mostra feedback ao vivo: "aproxime mais", "muito reflexo, gire a cabeça", "ótima — capturando". Só permite captura quando `overallScore >= 0.75`.

### 4.2 Pipeline servidor (Modal)

```python
# vision-service/modal_app.py

import modal

app = modal.App("aurel-iris-vision")

image = modal.Image.debian_slim().pip_install(
    "opencv-python-headless",
    "numpy",
    "scikit-image",
    "mediapipe",
    "torch",
    "torchvision",
    "Pillow",
    "supabase",
)

@app.function(image=image, gpu="T4", timeout=120)
def analyze_iris(reading_id: str, image_urls: list[dict]):
    """
    image_urls: [
      {"eye": "right", "angle": "frontal", "url": "..."},
      {"eye": "right", "angle": "lateral", "url": "..."},
      {"eye": "right", "angle": "backlight", "url": "..."},
      {"eye": "left", "angle": "frontal", "url": "..."},
      ...
    ]
    """
    from pipeline import detect, segment, compose, normalize, enhance, features

    results = {"right_eye": {}, "left_eye": {}}

    for eye in ["right", "left"]:
        eye_images = [load(u) for u in image_urls if u["eye"] == eye]

        # 1. Detecção de olho e íris em cada imagem
        detected = [detect.find_iris(img) for img in eye_images]

        # 2. Segmentação (Daugman / U-Net)
        segmented = [segment.iris_mask(img, det) for img, det in zip(eye_images, detected)]

        # 3. Composição photometric stereo (3 ângulos → 1 imagem rica)
        composite = compose.photometric_combine(segmented)

        # 4. Normalização polar (rubber sheet de Daugman)
        normalized = normalize.daugman_polar(composite)

        # 5. CLAHE pra realçar features
        enhanced = enhance.clahe(normalized)

        # 6. Detecção de features
        results[f"{eye}_eye"] = features.extract_all(enhanced, composite)

    return results
```

### 4.3 Estrutura do JSON de saída (entrega ao LLM)

```json
{
  "right_eye": {
    "constitution": {
      "primary": "linfatica",
      "confidence": 0.78,
      "indicators": ["fibras_finas_radiais", "coloracao_azul_clara"]
    },
    "iris_color": {"primary": "azul", "secondary": null, "central_heterochromia": false},
    "fiber_density": {"score": 0.62, "interpretation": "media-densa"},
    "collarette": {
      "shape": "irregular",
      "diameter_ratio": 0.34,
      "decentralization": "leve_nasal"
    },
    "pupil": {
      "centralization": "centrada",
      "shape": "circular",
      "size_ratio": 0.18
    },
    "sectors": [
      {
        "hour": 1, "zones": ["cerebro", "endocrino"],
        "findings": []
      },
      {
        "hour": 7, "zones": ["fígado", "vesícula"],
        "findings": [
          {"type": "lacuna", "depth": "grau_2", "size_mm": 0.4},
          {"type": "pigmentacao", "color": "amarelada", "extension": "pequena"}
        ]
      }
    ],
    "rings": {
      "nerve_rings": {"present": true, "count": 2, "intensity": "moderada"},
      "lymphatic_rosary": {"present": false},
      "sodium_ring": {"present": false},
      "senile_arc": {"present": false}
    },
    "global_signs": {
      "radii_solaris": [{"sector": 8, "extent": "media"}],
      "transversal_signs": [],
      "tofus": []
    },
    "image_quality": {"composite_score": 0.83, "warnings": []}
  },
  "left_eye": { },
  "asymmetry_notes": ["lacuna_unilateral_setor_7_direito"],
  "processing_metadata": {
    "model_version": "v0.3.1",
    "processing_time_ms": 4820
  }
}
```

**Esse JSON é o coração do produto.** É ele que vai pro LLM como evidência objetiva, e é ele que muda toda análise — não o "talento do prompt". Cada cliente gera um JSON diferente, e por isso cada relatório fica genuinamente diferente.

### 4.4 Modelos e bibliotecas no MVP

Pra acelerar o MVP, partimos de modelos prontos e refinamos depois:

- **Detecção de íris**: MediaPipe Face Mesh (gratuito, alta qualidade)
- **Segmentação**: Hough Transform circular (OpenCV) como baseline, U-Net pré-treinada em CASIA-Iris pra v1.1
- **Detecção de lacunas/criptas**: heurísticas em OpenCV (threshold adaptativo + morphology) no MVP, CNN treinada em dataset próprio em v2 (efeito de rede!)
- **Análise de cor**: HSV clustering + comparação com paleta constitucional

---

## 5. Base de Conhecimento (RAG)

### 5.1 Estratégia geral

PDFs em português são processados uma única vez, divididos em chunks semânticos, vetorizados e armazenados no `knowledge_chunks` do Supabase. Cada análise consulta o vector store com base nas features detectadas e injeta os trechos mais relevantes no prompt do Claude.

### 5.2 Pipeline de ingestão (script único)

```typescript
// scripts/ingest-knowledge.ts

import { extractText } from "./pdf-extractor";  // pdf-parse ou pdfjs
import { chunkBySections } from "./chunker";
import { embedBatch } from "@/lib/rag/embed";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BOOKS = [
  {
    file: "./pdfs/jensen-iridologia-vol1.pdf",
    metadata: { autor: "Jensen", escola: "americana", idioma: "pt" }
  },
  {
    file: "./pdfs/battello-iridologia-clinica.pdf",
    metadata: { autor: "Battello", escola: "italiana", idioma: "pt" }
  }
];

for (const book of BOOKS) {
  const text = await extractText(book.file);
  const chunks = chunkBySections(text, {
    targetSize: 500,        // tokens
    overlap: 80,
    splitOn: ["chapter", "section", "paragraph"]
  });

  // Voyage AI aceita batch de até 128 textos por chamada
  const embeddings = await embedBatch(chunks.map(c => c.content));

  for (let i = 0; i < chunks.length; i++) {
    await supabaseAdmin.from("knowledge_chunks").insert({
      source_book: book.metadata.autor,
      source_chapter: chunks[i].chapter,
      source_page: chunks[i].page,
      content: chunks[i].content,
      embedding: embeddings[i],
      metadata: { ...book.metadata, tags: chunks[i].tags }
    });
  }
}
```

### 5.3 Estratégia de chunking

PDFs de iridologia têm estrutura recorrente: introdução, anatomia, mapa setorial, sinais específicos, casos clínicos. Quebra ideal:

- **Por capítulo + subseção** quando o PDF tem TOC (índice). Use `pdf-parse` + heurísticas de fonte (títulos costumam ser maiores/bold).
- **Por parágrafo agrupado** (~500 tokens, overlap de 80) quando não tem estrutura clara.
- **Tag automática** com o LLM lendo cada chunk e gerando 3-5 tags (`fígado`, `lacuna`, `setor_7`, etc) — isso permite filtros depois.

### 5.4 Recuperação contextual (retrieval)

Quando uma análise é solicitada, antes de chamar o Claude:

```typescript
// lib/rag/search.ts

async function retrieveRelevantKnowledge(features: IrisFeatures): Promise<Chunk[]> {
  const queries: string[] = [];

  // Query baseada em constituição
  queries.push(`constituição ${features.right_eye.constitution.primary}`);

  // Query por achado em cada setor
  for (const sector of features.right_eye.sectors) {
    if (sector.findings.length > 0) {
      const zones = sector.zones.join(" ");
      const findingTypes = sector.findings.map(f => f.type).join(" ");
      queries.push(`${findingTypes} ${zones} setor ${sector.hour}h`);
    }
  }

  // Query por sinais globais
  if (features.right_eye.rings.nerve_rings.present) {
    queries.push("anéis nervosos tensão sistema nervoso");
  }

  // Embed cada query, busca top-5 chunks por query, deduplica
  const allChunks = await Promise.all(
    queries.map(q => searchByEmbedding(q, { limit: 5 }))
  );

  return deduplicateAndRank(allChunks.flat()).slice(0, 30);
}
```

Os ~30 chunks mais relevantes (somando ~15k tokens) vão como contexto pro Claude. Sobra muito espaço de janela de contexto pro Sonnet 4.6 (200k tokens).

---

## 6. Prompt Reescrito

```markdown
# prompts/system.md

Você é um analista iridológico integrativo, treinado nas tradições de Bernard Jensen,
Daniele Lo Rito, Vida Battello, Joseph Deck, Theodor Lindemann e na escola brasileira
contemporânea. Sua função é gerar uma **leitura iridológica integrativa** que servirá
de **apoio à anamnese conduzida pelo terapeuta humano** — você não substitui consulta
médica nem diagnóstico clínico.

## Princípios de operação

1. **Você não diagnostica.** Apresenta hipóteses fundamentadas em sinais visuais
   específicos, sempre como pontos a investigar com o cliente.

2. **Você não inventa sinais.** Você recebe um JSON com features extraídas por um
   pipeline de visão computacional. **Toda interpretação deve estar ancorada em
   features presentes nesse JSON.** Se um setor não tem achados detectados, você não
   especula sobre ele.

3. **Você usa o conhecimento fornecido (RAG).** Trechos de livros clássicos
   serão injetados no contexto. Priorize-os sobre conhecimento generalista.

4. **Linguagem hipotética obrigatória.** Use construções como:
   - "O sinal observado em [setor] sugere a investigação de..."
   - "Esta marca indica que vale explorar com o cliente se..."
   - "Em terapeutas da tradição [X], este achado é frequentemente associado a..."
   - **Nunca**: "o cliente tem", "diagnostica-se", "está doente de", "trauma
     confirmado aos X anos".

5. **Sobre temporalidade de traumas.** A tradição iridológica reconhece o "relógio
   biográfico" da íris. Você pode oferecer **faixas etárias prováveis** quando o
   sinal o sugere, sempre como **hipótese a ser confirmada em anamnese**, com a
   formulação: "este sinal é associado, em algumas escolas, a vivências em torno
   de [faixa] — caberá ao terapeuta investigar com o cliente em quais experiências
   isso ressoa."

## Estrutura do relatório

Você receberá:
- `<features>`: JSON com achados visuais objetivos (constituição, setores, anéis,
  sinais globais, simetria/assimetria entre olhos).
- `<knowledge>`: trechos de obras clássicas relevantes às features detectadas.
- `<client_context>`: nome, idade, e contexto opcional fornecido pelo terapeuta.

Gere o relatório em **português brasileiro**, com a seguinte estrutura, **citando
para cada bloco quais features do JSON ancoram cada interpretação** (entre colchetes):

### 1. Constituição Iridológica
Identifique o tipo constitucional [ancorado em: features.constitution]. Descreva o
que isso indica em termos de tendências fisiológicas e temperamentais — sempre como
predisposições, não certezas. Mostre forças associadas à constituição.

### 2. Análise Estrutural Física
Descreva fibras, densidade, colarete, pupila, lacunas, criptas, anéis e pigmentações
**setor por setor onde houver achados**. Para cada sinal, indique:
- A localização (setor horário e zona orgânica)
- A escola que descreve esse sinal (Jensen, Battello, etc)
- A hipótese de investigação correspondente

### 3. Indicações Sistêmicas
A partir dos achados, sugira **5 sistemas/órgãos com sinais de bom funcionamento**
e **5 sistemas/órgãos que merecem atenção investigativa**. Sempre fundamentado em
features específicas.

### 4. Estado de Toxemia (educacional)
Panorama do nível de carga sugerido pelos sinais (anel linfático, sinais de
eliminação, coloração geral). Linguagem educacional, não diagnóstica.

### 5. Padrões Psicoemocionais
Conecte os sinais físicos a padrões emocionais que a tradição iridológica associa,
sempre com: "estes sinais são interpretados, na escola [X], como possível
indicação de [padrão] — vale explorar com o cliente."

### 6. Hipóteses de Cargas Temporais
Liste até 5 sinais com possível ressonância biográfica. Para cada um:
- Sinal específico observado e seu setor
- Faixa etária associada na tradição (com a escola de referência)
- Tema de vida que tradicionalmente ressoa
- **Pergunta sugerida para a anamnese** (não afirmação)

### 7. Carências Nutricionais (educacional)
Possíveis padrões nutricionais sugeridos pelos sinais, em linguagem educacional.
Lembre que apenas exames laboratoriais confirmam deficiências.

### 8. Dimensão Simbólica e Espiritual
Interpretação arquetípica integrando Jensen, Lindemann e a tradição que entende
a íris como espelho da jornada da alma. Tom contemplativo, sem pretensão clínica.

### 9. Sugestões de Cuidados Integrativos
Recomendações em quatro eixos — nutrição, fitoterapia, práticas corporais, práticas
contemplativas — sempre como sugestões a serem avaliadas pelo terapeuta junto ao
cliente.

### 10. Potenciais e Forças
Pontos de luz, talentos e recursos que os sinais revelam. Esta seção é tão
importante quanto a de fragilidades — a íris mostra os dois.

### 11. Afirmações de Integração
Crie 3-5 afirmações personalizadas conectadas aos achados, no estilo Aurel Maat.
A afirmação central deve ser ressonante com:
*"Tudo na vida acontece em favor do meu crescimento."*

### 12. Síntese Integrativa
Resumo em até 8 tópicos curtos cobrindo: constituição, principais hipóteses
físicas, padrões emocionais, cargas temporais sugeridas, sugestões prioritárias,
forças centrais.

### 13. Mensagem Final
Um parágrafo contemplativo, no espírito de quem caminha *junto* com o cliente.
Não distante, não hierofântico — fraterno e firme.

## Encerramento obrigatório (literal)

> Esta leitura iridológica é uma ferramenta de apoio à anamnese terapêutica.
> Não constitui diagnóstico médico nem substitui avaliação clínica profissional.
> Os achados aqui descritos são hipóteses a serem investigadas pelo terapeuta
> em conjunto com o cliente, à luz de sua história de vida e contexto integral.

## Tom de voz

- Profundo mas acessível
- Hipotético, nunca afirmativo no clínico
- Reverente sem ser místico-vago
- Específico (cita o sinal, o setor, a escola) — nunca generalista
- Caloroso, integrativo, encarnado
```

Template de injeção:

```markdown
# prompts/feature-injection.md

<client_context>
Nome: {{client_name}}
Idade: {{age}}
Observações do terapeuta: {{therapist_notes}}
Mapa preferido: {{iris_map}}
</client_context>

<features>
{{vision_features_json}}
</features>

<knowledge>
{{rag_chunks_concatenated_with_citations}}
</knowledge>

Gere a leitura iridológica integrativa seguindo a estrutura definida no system prompt.
Lembre-se: cada interpretação deve citar entre colchetes a feature do JSON que a ancora.
```

---

## 7. Roadmap em Fases

Total: **~5-6 semanas pra MVP fechado**.

### Fase 0 — Setup (1-2 dias)
Contas: Vercel, Supabase, Stripe Brasil, Modal, Anthropic Console, Voyage AI, Resend.
Next.js inicializado com TypeScript, Tailwind, shadcn/ui. Variáveis de ambiente.
Schema do banco aplicado via migration.

### Fase 1 — Auth + Dashboard básico (2-3 dias)
Supabase Auth com email/magic link.
Tela de signup + login, perfil básico do terapeuta.
Layout do dashboard, navegação, middleware de proteção.
CRUD de clientes (listar, criar, editar, ver detalhes).

### Fase 2 — Captura mobile (PWA) (4-6 dias)
Manifest e service worker pra PWA instalável.
`getUserMedia` com seleção de câmera traseira.
MediaPipe Face Mesh integrado pra detecção de íris em tempo real.
UI de captura com overlay circular + feedback ao vivo (qualidade, distância, foco).
Fluxo guiado de 6 capturas (3 ângulos × 2 olhos) com instruções visuais entre cada.
Compressão e upload pro Supabase Storage com URLs assinadas.

### Fase 3 — Upload desktop (1-2 dias)
Dropzone com preview.
Validação de tipo e tamanho.
Mesma estrutura de armazenamento da captura mobile.

### Fase 4 — Pipeline de visão (Modal) (5-7 dias)
Repositório separado `vision-service`.
Modal app com função `analyze_iris`.
Implementação: detect → segment → compose → normalize → enhance → features.
Endpoint webhook seguro (HMAC).
No Next.js, função `triggerVisionPipeline(reading_id)` que chama Modal e atualiza status.
Webhook receiver que recebe o JSON e atualiza `readings.vision_features`.

### Fase 5 — RAG: ingestão de PDFs (2-3 dias)
Script `ingest-knowledge.ts`.
Extração de texto (pdf-parse ou pdfjs-dist).
Chunking por seção/parágrafo.
Embeddings via Voyage AI.
Insert em massa no `knowledge_chunks`.
Roda 1 vez por adição de livro novo, manualmente.

### Fase 6 — Análise LLM (3-5 dias)
Função `analyze` em `lib/anthropic/analyze.ts`:
1. Carrega features do reading
2. Faz retrieval no pgvector
3. Monta prompt com system + features + knowledge
4. Chama Claude Sonnet 4.6 com streaming
5. Salva resposta em `ai_report_raw`
UI de visualização do relatório (markdown rendering).
UI de edição (terapeuta pode ajustar antes de entregar).

### Fase 7 — Pagamento e LGPD (3-4 dias)
Stripe checkout (BRL com PIX habilitado).
Tiers: Starter (R$ 89/mês, 20 análises), Profissional (R$ 189/mês, ilimitado),
Escola (R$ 490/mês, white-label leve, contato).
Trial de 14 dias automático.
Webhook do Stripe atualizando `subscription_status`.
Middleware bloqueando análises se trial expirou e não assinou.
Geração de termo de consentimento LGPD por cliente (PDF com nome, data, escopo).
Página de privacidade, termos, política de retenção.

### Fase 8 — Polish + beta fechado (1 semana)
Onboarding em 3 passos pro novo terapeuta.
Email transacional via Resend (confirmação, recibo, leitura pronta).
Página pública de apresentação do produto.
Testes com 5 terapeutas internos.
Ajuste do prompt baseado em feedback real.
Lançamento beta com 10-20 terapeutas selecionados.

---

## 8. LGPD e Conformidade Legal

Foto de íris é **dado biométrico + dado de saúde** = categoria sensível na LGPD, exige proteção máxima.

**No produto:**
- Termo de consentimento por cliente, com nome do cliente, terapeuta, escopo de uso e prazo de retenção. Versão assinável digitalmente (DocuSeal open source ou Clicksign).
- Criptografia em repouso (Supabase já faz) e em trânsito (HTTPS obrigatório).
- Bucket de Storage privado por terapeuta com RLS.
- Direito de exclusão: botão "deletar dados" cascateia tudo.
- Logs de acesso a imagens.

**Comunicação ao terapeuta:**
- Manual de boas práticas LGPD pro terapeuta integrativo.
- Modelo de termo de consentimento em PDF.

**Posicionamento jurídico:**
- Em **toda** comunicação pública (site, app, relatório): "ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica".
- **Nunca** use as palavras "diagnóstico", "tratamento", "cura" no produto.
- **Recomendação séria**: consultar advogado de healthtech/dados antes do lançamento público. ~R$ 2-4k de investimento que evita problema grande.

---

## 9. Decisões em aberto pra v2 (não bloqueiam o MVP)

- **Análise temporal evolutiva** (comparar leituras do mesmo cliente ao longo do tempo)
- **Multi-mapa simultâneo** (Jensen + Hidalgo + Jausas comparativos)
- **White-label pra escolas de iridologia**
- **Banco anônimo de casos** (com consentimento) → dataset próprio pra treinar CNNs
- **Modo formação** (estudantes consomem casos com quizzes)
- **Integração com prontuário eletrônico** (FHIR)
- **API pública** pra terapeutas integrarem com sites próprios
