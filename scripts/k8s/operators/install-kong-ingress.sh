#!/bin/bash
set -euo pipefail

echo "Kong Ingress Controller is installed via Helm chart dependency (kong/ingress)."
echo "No separate operator installation needed."
echo ""
echo "To customize Kong settings, override kong values in values.yaml or --set flags."
echo "See: https://docs.konghq.com/kubernetes-ingress-controller/latest/reference/configuration/
"
