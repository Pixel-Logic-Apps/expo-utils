#!/bin/bash
#
# Este script faz o login no Expo Application Services (EAS).
# Ele utilizará a variável de ambiente EXPO_TOKEN se estiver definida (ideal para CI/CD).
# Caso contrário, ele solicitará um login interativo.
#
echo "Tentando fazer login no EAS..."
eas login