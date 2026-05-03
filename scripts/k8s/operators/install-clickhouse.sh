#!/bin/bash
set -euo pipefail

echo "Installing ClickHouse Operator..."
kubectl apply --server-side -f \
  https://raw.githubusercontent.com/Altinity/clickhouse-operator/master/deploy/operator/clickhouse-operator-install-bundle.yaml

echo "Waiting for ClickHouse operator to be ready..."
kubectl wait deployment -n kube-system clickhouse-operator --for=condition=Available --timeout=120s 2>/dev/null || \
  echo "ClickHouse Operator deployed. Verify manually: kubectl get pods -n kube-system -l app=clickhouse-operator"

echo "ClickHouse Operator installed."
