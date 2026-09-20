#!/bin/bash
# Roda cada arquivo de teste em PROCESSO PRÓPRIO: o mock.module do bun é global e vaza entre
# arquivos, e os módulos testados guardam estado de sessão (fases memoizadas, teto de envios).
# Uso: ./tests/run.sh   (na raiz do expo-utils)
cd "$(dirname "$0")/.." || exit 1
status=0
for file in tests/*.test.ts; do
    echo "── $file"
    bun test "$file" 2>&1 | grep -v "^bun test v" | sed '/^$/d' || true
    bun test "$file" >/dev/null 2>&1 || status=1
done
[ $status -eq 0 ] && echo "TODOS OS TESTES PASSARAM" || echo "HOUVE FALHA"
exit $status
