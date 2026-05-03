#!/bin/bash
set -euo pipefail

echo "Installing Strimzi Kafka Operator..."
kubectl create namespace kafka --dry-run=client -o yaml | kubectl apply -f -
kubectl apply --server-side -f \
  https://strimzi.io/install/latest?namespace=kafka

echo "Waiting for Strimzi operator to be ready..."
kubectl wait deployment -n kafka strimzi-cluster-operator --for=condition=Available --timeout=120s

echo "Strimzi Kafka Operator installed."
