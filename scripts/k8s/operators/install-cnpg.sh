#!/bin/bash
set -euo pipefail

echo "Installing CloudNativePG Operator..."
kubectl apply --server-side -f \
  https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/main/releases/cnpg-1.25.0.yaml

echo "Waiting for CNPG controller to be ready..."
kubectl wait deployment -n cnpg-system cnpg-controller-manager --for=condition=Available --timeout=120s

echo "CloudNativePG Operator installed."
