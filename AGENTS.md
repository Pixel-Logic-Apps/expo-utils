# AGENTS.md - Instrucoes para checksum MD5 do Remote Config

Este documento descreve como implementar (em um app Expo que consome o `expo-utils`)
um checksum MD5 de alguns campos do Remote Config e enviar para o Firebase Analytics,
sem usar bibliotecas externas para hash.

## Objetivo

Gerar um hash **MD5** a partir de um subconjunto do Remote Config
(`adunits`, `is_ads_enabled`, `min_version`) e enviar um evento para o
Firebase Analytics no **startup** do app. O hash serve apenas para
verificar que os dados recebidos pelo app estao corretos, sem expor
os valores em texto.

## Regras obrigatorias

- Nao usar biblioteca externa de hash.
- Implementar MD5 em TypeScript puro (arquivo utilitario local).
- Nao enviar os `adunits` em texto; apenas:
  - hash (`cfg_hash`)
  - contagem de adunits (`ad_count`)
  - `is_ads_enabled`
  - `min_version`
  - `app_version`
- Disparo **somente no startup** (sem listener de mudanca do Remote Config),
  a menos que o usuario peça o contrario.
- Evitar envios em `__DEV__`.

## Onde aplicar

Esse fluxo deve ser implementado no **app host** (o projeto Expo que usa
`expo-utils`), nao dentro do pacote `expo-utils`, a menos que o usuario
peça explicitamente para alterar o pacote.

## Passo a passo (no app host)

1. Criar utilitario MD5 em TS puro
   - Exemplo de arquivo: `src/utils/md5.ts`
   - Exportar `md5(input: string): string` (hex lowercase).
   - Implementacao com funcoes bitwise (add32, rol, ff, gg, hh, ii, etc.).

2. Criar util de integridade do Remote Config
   - Exemplo: `src/utils/config-integrity.ts`
   - Funcoes sugeridas:
     - `stableStringify(value)` para JSON deterministico (ordena chaves).
     - `pickIntegrityFields(remoteConfigs)` -> `{ adunits, is_ads_enabled, min_version }`.
     - `reportConfigIntegrity(remoteConfigs, appConfig)`:
       - Se `__DEV__`, retorna.
       - `const payload = pickIntegrityFields(...)`
       - `const checksum = md5(stableStringify(payload))`
       - Enviar evento Analytics:
         - `eventName`: `cfg_integrity`
         - params: `cfg_hash`, `ad_count`, `is_ads_enabled`, `min_version`, `app_version`

3. Chamar no startup (ex.: `src/app/_layout.tsx`)
   - Apos `Utils.prepare(...)`, chamar:
     - `reportConfigIntegrity(global.remoteConfigs, appConfig);`
   - Nao adicionar listener de mudanca do Remote Config,
     salvo pedido explicito do usuario.

## Observacoes

- O MD5 nao e seguro para criptografia; aqui e apenas checksum.
- O objetivo e **verificar consistencia**, nao proteger segredos.
- Se o usuario solicitar SHA-256 ou outro hash, ajustar a implementacao
  (ainda sem libs externas).
