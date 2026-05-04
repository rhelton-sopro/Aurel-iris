# Consentimento — Fixtures de íris (Aurel Iris vision-service)

**Última atualização:** 2026-05-04
**Escopo:** fotos de íris armazenadas em `tests/fixtures/iris/` para testes
automatizados do pipeline de visão (Fase 5).

## Self-consent (founder)

O founder do projeto, atuando simultaneamente como sujeito e responsável
técnico, declara consentimento expresso para o uso das próprias imagens
de íris exclusivamente para fins de teste do pipeline `analyze_iris`,
calibração de parâmetros (Hough, CLAHE, k-means LAB) e validação de
regressão. Imagens identificadas com prefixo `founder_` ou nomeadas de
acordo com a convenção `<eye>_<angle>_<id>.jpg` sem outro identificador
pertencem a este consentimento próprio.

## Sujeitos terceiros

Quaisquer fotos com origem em sujeitos terceiros exigem termo escrito
específico, não-comitado neste repositório. O termo deve estar arquivado
em local seguro pelo founder, com:
- Nome completo, data, e escopo de uso ("testes automatizados de
  pipeline de visão computacional do projeto Aurel Iris").
- Direito de revogação a qualquer momento, com remoção das imagens em
  até 30 dias.
- Indicação de que o repositório é privado até a revisão jurídica
  healthtech (Fase 9) e que qualquer abertura futura passará por
  revisão expressa.

## Repositório privado

Este repositório permanece privado até a revisão jurídica healthtech
prevista para a Fase 9. Antes de qualquer mudança de visibilidade,
este documento deve ser revisado.

## Direito de exclusão

Para remover uma fixture do conjunto: deletar o arquivo em
`tests/fixtures/iris/`, atualizar `expected.json`, e abrir um commit
de remoção referenciando este CONSENT.md.
