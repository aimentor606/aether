#!/bin/bash
set -euo pipefail

echo "Installing cert-manager..."
kubectl apply --server-side -f \
  https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml

echo "Waiting for cert-manager pods to be ready..."
kubectl wait deployment -n cert-manager cert-manager --for=condition=Available --timeout=120s
kubectl wait deployment -n cert-manager cert-manager-webhook --for=condition=Available --timeout=60s
kubectl wait deployment -n cert-manager cert-manager-cainjector --for=condition=Available --timeout=60s

echo "cert-manager installed."
echo ""
echo "Next: create ClusterIssuer by setting ssl.issuerEmail in values.yaml, then install the chart."
