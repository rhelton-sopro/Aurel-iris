# Mercado Pago BR — Parcelamento sem juros (MSI), PIX, taxas e prazos de liberação

> Documento de referência para a integração de pagamentos do Iris Codex (SaaS, pacotes pré-pagos).
> Pesquisa: **2026-06-20**. Mercado-alvo: **Brasil**. Conta MP: **NOVA (recém-criada)**.
> Fontes oficiais (mercadopago.com.br + Developers) + secundárias confiáveis para taxas reais 2026.
> ⚠️ As taxas exatas variam por **plano comercial** e **faturamento** da conta — os números abaixo são o
> **plano padrão público** (faixa "Na Hora / até R$3 mil/mês"). Confirme sempre no painel
> **Seu negócio → Taxas e prazos** com a conta logada.

---

## 0. TL;DR para o nosso caso (PIX c/ desconto + cartão sem juros 1x/2x/3x por pacote)

- **Sim, "sem juros" é configuração de CONTA** (vendedor absorve o custo): `Seu negócio → Custos/Taxas e parcelamentos → Checkout → Parcelas → Oferecer → "Oferecer parcelado vendedor"`, e escolher **em até quantas parcelas** oferecer sem juros. ✅ Confirmado.
- **Sim, o teto de parcelas é por-preference**: o campo `payment_methods.installments` na preference do Checkout Pro define o **máximo de parcelas** oferecidas naquela compra. ✅ Confirmado.
- **Como casar 2x num pacote e 3x noutro:** ligue o "parcelado vendedor" na conta no maior nº que você usa (3x). Depois, **por preference**, mande `installments: 2` no pacote médio e `installments: 3` no grande, e `installments: 1` nos demais. O sem-juros vem da conta; o teto vem da preference.
- **Custo de absorver (plano padrão, "na hora"):** 1x ≈ **4,98%**; 2x ≈ **9,90%**; 3x ≈ **11,28%** — paga-se a taxa do **nº de parcelas que o cliente escolher**. (Cai bastante em planos de volume e em prazos maiores.)
- **PIX:** taxa baixa/fixa por %, **liberação na hora (D+0)**; precisa ter **chave PIX cadastrada** na conta MP (a própria conta MP já é destino).
- **Risco de conta nova:** ticket alto + parcelado + sem histórico = perfil clássico de **reserva/hold** (até ~90 dias em casos de revisão). Mitigável, não eliminável.

---

## 1. Parcelas sem juros — "parcelado vendedor" (o vendedor absorve)

### 1.1 O que é
No Mercado Pago existem dois modos de parcelamento no cartão:
- **Parcelado comprador (com juros):** o cliente paga o acréscimo; é o **default** da conta (12x com juros).
- **Parcelado vendedor (sem juros / MSI):** **você absorve** a taxa de financiamento; o cliente vê o preço cheio dividido **sem acréscimo**. É isso que queremos.

> "No modelo sem acréscimos, é o **vendedor quem assume as taxas** de financiamento para que o cliente pague o mesmo preço à vista."
> — calculadoradetaxas.com.br / blog MP (2026)

### 1.2 Passo a passo para ligar na conta (Checkout / Checkout Pro)
Caminho atual (a UI já variou de nome; ambos os rótulos aparecem em 2026):

1. Logar na conta Mercado Pago.
2. Menu **Seu negócio** → **Taxas e parcelamentos** (em algumas contas aparece como **Custos**).
3. No topo, selecionar a aba **Checkout** (é a que rege Checkout Pro / link / preference; "Point" é a maquininha).
4. Selecionar **Parcelas** → **Oferecer** (ou **Configurar parcelamento** → **Configurar parcelado vendedor**).
5. **Ativar** o botão **"Oferecer parcelado vendedor"**.
6. Escolher **em até quantas parcelas** você oferece **sem juros** (ex.: 3).
7. Salvar.

> "Acesse **Seu negócio → Taxas e parcelamentos**, aba **Checkout**, selecione **Parcelas → Oferecer**, ative **Oferecer parcelado vendedor** e escolha o nº máximo de parcelas." — ajuda MP `parcelamenteo-sem-juros_454`

Observações da UI (fonte Yampi, parceiro):
- O **default da conta é 12x com juros**; você **não muda o teto absoluto** do que o MP permite, só define **"em até quantas vezes você oferece SEM juros"**.
- O cliente paga sempre o mesmo preço; **você recebe o valor menos a taxa de recebimento + a taxa de parcelamento**.

### 1.3 Custo de absorver — quanto % por nº de parcelas
- A taxa cobrada corresponde ao **nº de parcelas que o COMPRADOR escolher na hora**, não ao teto que você ofereceu.
  > "Se você oferece em até 6x e o cliente paga em 3x, você paga a **taxa de 3 parcelas**." — ajuda MP / Yampi
- Custo total que você assume ≈ **taxa de recebimento (crédito) + taxa de parcelamento**, e cresce com o nº de parcelas.

**Tabela — plano padrão público "Na Hora / até R$3 mil/mês" (crédito, vendedor absorve):**

| Parcelas | Taxa efetiva (plano padrão, "na hora") |
|---|---|
| 1x (à vista) | ~4,98% |
| 2x | ~9,90% |
| 3x | ~11,28% |
| 4x | ~12,64% |
| 5x | ~13,97% |
| 6x | ~15,27% |
| 12x | ~22,59% |

> Fonte: calculadoradetaxas.com.br/mercado-pago (plano padrão exibido, 2026).
> ⚠️ Esses % são do **plano padrão sem negociação**. Em **planos de volume** (PJ, faturamento ≥ R$10–20 mil/mês) e em **prazos maiores** as taxas caem muito: 2x pode ir de **9,90% → ~3,99%** e 12x de **22,59% → ~8,99%** no melhor plano. Logo, o custo real do nosso 2x/3x depende do plano que a conta tiver.

**Impacto no nosso ticket (estimativa, plano padrão, pior caso):**
- Pacote médio R$745 em **2x sem juros** → custo ~9,90% ≈ **R$74** de taxa (líquido ~R$671).
- Pacote grande R$1191 em **3x sem juros** → custo ~11,28% ≈ **R$134** de taxa (líquido ~R$1057).
- Em plano de volume isso cai para ~3,99%/~6% → R$30 e ~R$71, respectivamente. **Vale negociar plano antes de ligar 3x.**

---

## 2. Interação com a preference (Checkout Pro / API)

### 2.1 O que a preference controla
Na criação da preference, o objeto `payment_methods` aceita:

```json
"payment_methods": {
  "excluded_payment_methods": [ { "id": "master" } ],
  "excluded_payment_types":   [ { "id": "ticket" } ],
  "installments": 3
}
```

- **`installments`** → **número MÁXIMO de parcelas oferecidas NESTA preference**. ✅ Confirmado na doc oficial: "the maximum number of installments that can be offered to the buyer" — limita por-preference.
- **`default_installments`** → não está documentado para Checkout Pro nessa página (a doc só cita `installments`). Não contar com ele; usar `installments` como teto.
- **`excluded_payment_types`** → para forçar só cartão/PIX, dá pra excluir `ticket` (boleto) etc. "Cash in account"/Wallet **não** podem ser excluídos.

### 2.2 Divisão de responsabilidade (a regra de ouro)
- **A CONTA** decide **SE há juros** (parcelado vendedor ligado = sem juros até N).
- **A PREFERENCE** decide **o TETO de parcelas** daquela compra (`installments`).

→ Os dois trabalham juntos: o cliente só vê **sem juros** se (a) a conta tem parcelado-vendedor ligado **e** (b) o nº escolhido está **dentro do limite sem-juros da conta**; e só vê **até N parcelas** se `installments` ≥ N na preference.

### 2.3 Como garantir 2x-sem-juros num pacote e 3x-sem-juros noutro
1. **Conta:** ligar "parcelado vendedor" com teto sem-juros = **3** (cobre o caso máximo).
2. **Por pacote (preference):**
   - Demais pacotes (pequeno etc.): `payment_methods.installments = 1` → só à vista.
   - Pacote médio (~R$745): `payment_methods.installments = 2` → cliente vê **1x ou 2x, sem juros**.
   - Pacote grande (~R$1191): `payment_methods.installments = 3` → cliente vê **1x/2x/3x, sem juros**.
3. ⚠️ **Atenção ao limite sem-juros da conta vs. teto da preference:** se a conta só estiver ligada para sem-juros até 2x, mas a preference mandar `installments: 3`, o **3x pode aparecer COM juros** (cai no parcelado comprador). Para 3x sem juros, a conta precisa estar configurada para **≥ 3 sem juros**. Mantenha conta = 3 sem juros e controle o teto pela preference.
4. Como o custo é cobrado pelo nº que o cliente **escolher**, oferecer 3x não custa nada se o cliente pagar 1x — só paga a taxa de parcelamento quando ele parcela.

---

## 3. Taxas reais BR (2026) — tabela comparável

Plano padrão público (sem negociação). Taxas caem com **volume** e com **prazo de recebimento maior**.

| Método | Taxa (plano padrão) | Liberação | Observação |
|---|---|---|---|
| **PIX** | **0,49%** (QR/Point ≥ R$15k/mês) · até **0,99%** em link/checkout · pode ser **0%** em planos | **Na hora (D+0)** | sem valor fixo; % sobre a venda |
| **Débito** | **~1,99%** (fixa) | **Na hora (D+0)** | |
| **Crédito 1x — na hora (D+0)** | **~4,98%** | D+0 | mais caro pq antecipa |
| **Crédito 1x — 14 dias (D+14)** | menor que D+0 (≈ 4,xx%) | D+14 | % cai com prazo |
| **Crédito 1x — 30 dias (D+30)** | **~3,79–4,5%** (faixa) / **0,74%** em plano promo de volume | D+30 | mais barato |
| **Crédito parcelado 2x** | **~9,90%** (padrão) → **~3,99%** (melhor plano) | conforme prazo | vendedor absorve |
| **Crédito parcelado 3x** | **~11,28%** (padrão) | conforme prazo | |
| **Crédito parcelado 6x** | **~15,27%** (padrão) | conforme prazo | |
| **Crédito parcelado 12x** | **~22,59%** (padrão) → **~8,99%** (melhor plano) | conforme prazo | |
| **Boleto** | **~R$3,49 fixo/emissão** | D+1 após pago | |

> Fontes: calculadoradetaxas.com.br/mercado-pago; marreiradigital.com.br/calculadora-mercadopago; blog MP "quanto custa receber via PIX e QR"; ajuda MP. Datas: páginas de 2026.
> Regra geral MP: **quanto maior o prazo de recebimento, menor a taxa**; **quanto maior o faturamento, menor a taxa** (taxa progressiva).

---

## 4. Prazos de liberação do dinheiro (D+) e antecipação

| Forma | Prazo padrão | Pode escolher |
|---|---|---|
| **PIX** | **Na hora / D+0** (segundos) | — |
| **Débito** | **Na hora / D+0** | — |
| **Crédito à vista (1x)** | Configurável: **na hora (D+0)**, **14 dias (D+14)** ou **30 dias (D+30)** | sim — prazo maior = taxa menor |
| **Crédito parcelado** | parcelas liberadas conforme o prazo escolhido (na hora/14/30) — no "na hora" o **valor cheio** cai de uma vez | sim |
| **Boleto** | ~**D+1** após o pagamento do boleto | — |

- O prazo é **escolhido pelo vendedor** em **Seu negócio → Taxas e prazos**; é um trade-off: **antecipar = pagar mais**.
- **Antecipação de recebíveis:** dá para adiantar recebíveis pendentes a qualquer momento ("Dinheiro na hora"/antecipação), pagando uma taxa de antecipação. Útil se a conta começou em D+30 e precisa do caixa antes.

> Fontes: blog MP "prazo de liberação do dinheiro"; "antecipação de recebíveis"; ajuda MP prazos. 2026.

---

## 5. PIX no Mercado Pago

- **Taxa:** **0,49%** (QR/Point, faturamento ≥ R$15k/mês) ou **0,99%** em link/checkout; planos podem zerar (**0%**). Não há tarifa fixa em reais — é % sobre a venda. (≠ Asaas, que é fixo R$1,99/transação.)
- **Liberação:** **na hora (D+0)**, em segundos.
- **Chave PIX:** a conta MP **recebe PIX direto na própria conta**; é preciso ter **chave PIX cadastrada/associada** à conta MP para usar todas as formas (a conta MP funciona como destino). No fluxo de Checkout/preference com PIX, o MP gera o **QR Code dinâmico** automaticamente — não exige você colar chave na preference.
- **Expiração do QR/cobrança:** o PIX gerado por preference/cobrança tem **prazo de expiração** (configurável via `date_of_expiration` / janela de pagamento). Após expirar, o cliente precisa gerar nova cobrança. QR **estático** (valor fixo, reuso) não expira; QR **dinâmico** (o nosso caso, valor por compra) expira na janela definida.
- **Desconto no PIX (nosso caso):** o desconto é **lógica nossa** (preço menor quando o método é PIX) — não é um toggle do MP; nós montamos a preference/valor com o desconto aplicado, igual já fazemos com o Asaas.

> Fontes: MP "aceitar PIX"; blog MP "quanto custa receber via PIX e QR"; "evitar cobrança taxa PIX". 2026.

---

## 6. Risco de conta NOVA (reservas / holds / retenção)

### 6.1 O risco é real e o nosso perfil é sensível
- O MP **retém saldo** ("dinheiro retido") para cobrir possíveis disputas/contestações; contas **novas / sem reputação** ficam retidas por **períodos maiores**.
- **Bloqueio/revisão pode durar até ~90 dias** em casos de análise (período em que o MP teoricamente cobriria contestações).
- **Gatilhos clássicos de revisão/hold** — e o nosso caso bate em vários:
  - Conta **recém-criada, sem histórico** de processamento. ✅ (nosso caso)
  - **Ticket alto** (R$745 / R$1191) logo de cara. ✅
  - **Parcelado** em conta nova (perfil de risco de chargeback). ✅
  - **Pico súbito** de volume / valor muito acima da média.
  - **Chargebacks/contestações** ou denúncias de comprador.
  - Dados de cadastro inconsistentes / atividade atípica para o segmento.
- Há **farta jurisprudência** (Jusbrasil/Reclame Aqui) de retenção considerada abusiva — mas litigar é caro e lento; o objetivo é **não cair em hold**.

### 6.2 Boas práticas para evitar/minimizar hold
1. **Aquecer a conta:** começar com **volume e ticket baixos** e subir gradualmente, em vez de já emitir R$1191 parcelado no 1º dia.
2. **KYC completo:** cadastro 100% preenchido (CNPJ ativo se for PJ, endereço, dados batendo com a atividade declarada). Conta verificada retém menos.
3. **Escolher prazo de recebimento mais longo no começo** (D+14/D+30): além de taxa menor, dá ao MP a janela de disputa que ele "quer", reduzindo a percepção de risco.
4. **Descrição clara do produto** no checkout (SaaS/serviço de software) e **suporte/contato visível** → menos contestação "não reconheço a compra".
5. **Termo + recibo claros** ao cliente (e-mail de confirmação) para reduzir chargeback.
6. **Não misturar** com Mercado Livre/atividades não relacionadas na mesma conta.
7. **Manter saldo/recebíveis** para cobrir eventual reserva sem quebrar o caixa.
8. **Plano B de gateway** (Asaas) para cartão/PIX caso o MP entre em revisão — não depender de um só provedor em conta nova.

> Fontes: ajuda MP "o que é o dinheiro retido"; Reclame Aqui; Jusbrasil; pareceres advocatícios (Giacaglia, Favaretto, Pontes Marinho, Rosenbaum). 2026.

---

## 7. Comparação rápida com Asaas (trade-off)

| Critério | **Mercado Pago** | **Asaas** |
|---|---|---|
| **PIX** | 0,49–0,99% (variável), **D+0** | **R$1,99 fixo**/transação |
| **Cartão 1x** | ~4,98% (D+0) a ~3,79% (D+30) | **2,99% + R$0,49** |
| **Parcelado sem juros** | **Sim**, vendedor absorve (config conta + teto por preference), custo cresce por parcela | Sim, mas modelo/custo diferente |
| **NF-e** | não nativa no fluxo (integração à parte) | **NF-e nativa** |
| **Liberação** | D+0/D+14/D+30 escolhível; antecipação | recebíveis próprios |
| **Risco hold conta nova** | **Mais alto** (ML/MP é agressivo com conta nova + ticket alto parcelado) | menor histórico de holds severos |
| **Cobertura de cartão** | rede grande, boa aprovação | depende do teto da conta (nosso problema atual #1285903) |

**Leitura de trade-off para o Iris Codex:**
- O **forte do MP** é o **parcelamento sem juros nativo** e a aprovação de cartão (resolve o teto travado do Asaas).
- O **forte do Asaas** é **PIX barato/fixo + NF-e nativa**, e menos exposição a hold em conta nova.
- **Estratégia de menor risco:** rodar **os dois** — **Asaas para PIX (com desconto) + NF-e**, **MP para cartão parcelado** — e aquecer a conta MP antes de mandar tickets altos parcelados. (Coerente com a nota de memória `project_infinitepay_vs_asaas_evaluation`.)

---

## URLs-fonte (por seção, 2026-06)

**§1 Parcelado vendedor / config:**
- https://www.mercadopago.com.br/ajuda/parcelamenteo-sem-juros_454
- https://www.mercadopago.com.br/blog/oferecer-pagamentos-12x-sem-acrescimos-mercado-pago
- https://help.yampi.com.br/pt-BR/articles/7170108-como-configurar-os-juros-e-parcelamento-no-mercado-pago
- https://www.mercadopago.com.br/ajuda/custos-de-parcelamento-do-point_2662

**§2 Preference / API (installments):**
- https://www.mercadopago.com.br/developers/en/docs/checkout-pro/additional-settings/payment-methods
- https://www.mercadopago.cl/developers/en/docs/checkout-pro/additional-settings/preferences/payment-methods
- https://www.mercadopago.com.co/developers/en/reference/preferences/_checkout_preferences/post

**§3 Taxas 2026:**
- https://www.calculadoradetaxas.com.br/mercado-pago
- https://marreiradigital.com.br/calculadora-mercadopago/
- https://esteeolugar.com.br/artigos/taxa-pix-mercado-pago/

**§4 Prazos / antecipação:**
- https://www.mercadopago.com.br/blog/prazo-liberacao-dinheiro
- https://www.mercadopago.com.br/blog/quanto-tempo-demora-cair-pagamento-mercado-pago
- https://www.mercadopago.com.br/blog/antecipacao-de-recebiveis-mercado-pago

**§5 PIX:**
- https://www.mercadopago.com.br/ferramentas-para-vender/aceitar-pix
- https://www.mercadopago.com.br/blog/quanto-custa-receber-pagamentos-via-pix-e-codigo-qr
- https://www.mercadopago.com.br/blog/evitar-cobranca-taxa-pix

**§6 Risco de conta nova / holds:**
- https://www.mercadopago.com.br/ajuda/o-que-e-o-dinheiro-retido_19204
- https://www.reclameaqui.com.br/mercado-pago/ (relatos de retenção)
- https://giacaglia.com.br/valores-bloqueados-no-mercado-pago-entenda-seus-direitos-e-como-exigir-a-liberacao/
- https://favarettoadv.com.br/conta-suspensa-no-mercado-livre-e-dinheiro-retido-no-mercado-pago-como-resolver-legalmente/

> ⚠️ Páginas oficiais do MP bloqueiam fetch automatizado (HTTP 403). Os valores exatos de taxa foram
> extraídos de calculadoras/parceiros (2026) e **devem ser confirmados no painel da conta logada**
> antes de codar valores fixos. O comportamento de config (parcelado vendedor + `installments` por
> preference) está confirmado na ajuda oficial e na doc Developers.
