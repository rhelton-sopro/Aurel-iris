# Sinais Iridológicos Canônicos — Aurel Iris (Phase 6 D-T4)

**Founder approval date:** 2026-05-05
**Vocabulary version:** 0.1.0
**Status:** locked — additions require founder approval + bump version + re-audit.

This file is the source of truth for the `metadata.sinais_referenciados` array.
Tagger (Claude Code session) MUST select from this list verbatim. Sinais
não-canônicos vão em `metadata.tags_livres`, NUNCA inventar entrada nova aqui.

## Lacunas e criptas
- `lacuna_aberta`
- `lacuna_fechada`
- `cripta`

## Pontas e raios
- `ponta_lanca`
- `raios_solaris`

## Anéis e arcos
- `anel_tensao`
- `anel_psorico`
- `anel_nervoso`
- `anel_linfatico`
- `arco_senil`
- `arco_de_pelo`

## Manchas
- `mancha_pigmentar`
- `mancha_psorica`
- `mancha_uremica`

## Vasos e colarete
- `vascularizacao_anormal`
- `colarete_irregular`
- `colarete_dilatado`

## Defeitos pupilares
- `defeito_pupilar`
- `achatamento_pupilar`

## Heterocromias
- `heterocromia_central`
- `heterocromia_setorial`

## Versionamento

Bumps de versão exigem (a) founder approval registrado em SUMMARY do plan que adicionou ou removeu sinal, (b) atualização do `vocabularies.version` em `vision-service/scripts/data/vocabularies.json` espelhando este número, (c) re-tagging dos chunks afetados (D-I2 drop-and-recreate por livro).
