CHART_DIR := helm/aether
RELEASE   := aether
NAMESPACE := aether

.PHONY: install-operators install install-dev upgrade uninstall template lint test status backup secrets

# Install all required operators into the cluster
install-operators:
	@echo "Installing K8S operators..."
	@bash operators/install-cert-manager.sh
	@bash operators/install-cnpg.sh
	@bash operators/install-strimzi.sh
	@bash operators/install-clickhouse.sh
	@echo "Kong Ingress Controller installs via Helm chart dependency."

# Install chart with production values
install: lint
	helm install $(RELEASE) $(CHART_DIR) \
		--namespace $(NAMESPACE) --create-namespace \
		-f $(CHART_DIR)/values.yaml \
		-f $(CHART_DIR)/values-production.yaml \
		--timeout 10m --wait

# Install with dev defaults (no production overrides)
install-dev: lint
	helm install $(RELEASE) $(CHART_DIR) \
		--namespace $(NAMESPACE) --create-namespace \
		--timeout 10m --wait

# Upgrade an existing release
upgrade:
	helm upgrade $(RELEASE) $(CHART_DIR) \
		--namespace $(NAMESPACE) \
		-f $(CHART_DIR)/values.yaml \
		$([ -f $(CHART_DIR)/values-production.yaml ] && echo "-f $(CHART_DIR)/values-production.yaml") \
		--timeout 5m --wait

# Uninstall the release
uninstall:
	helm uninstall $(RELEASE) --namespace $(NAMESPACE)

# Render templates locally (dry-run)
template:
	helm template $(RELEASE) $(CHART_DIR) \
		--namespace $(NAMESPACE) \
		-f $(CHART_DIR)/values.yaml \
		> /tmp/aether-rendered.yaml
	@echo "Rendered to /tmp/aether-rendered.yaml"

# Lint the chart
lint:
	helm dependency update $(CHART_DIR)
	helm lint $(CHART_DIR)

# Run helm-unittest chart tests
test:
	helm unittest $(CHART_DIR)

# Show cluster status
status:
	@echo "=== Helm Release ==="
	helm status $(RELEASE) --namespace $(NAMESPACE) 2>/dev/null || echo "Not installed"
	@echo ""
	@echo "=== Pods ==="
	kubectl get pods -n $(NAMESPACE) -o wide
	@echo ""
	@echo "=== Services ==="
	kubectl get svc -n $(NAMESPACE)
	@echo ""
	@echo "=== Ingress ==="
	kubectl get ingress -n $(NAMESPACE)

# Trigger a manual CNPG backup
backup:
	kubectl exec -n $(NAMESPACE) deploy/cnpg-controller-manager -- \
		cnpg backup $(RELEASE)-pg --namespace $(NAMESPACE) 2>/dev/null || \
		echo "Use: kubectl apply -f - <<EOF\napiVersion: postgresql.cnpg.io/v1\nkind: Backup\nmetadata:\n  name: manual-backup\nspec:\n  cluster:\n    name: $(RELEASE)-pg\nEOF"

# Show auto-generated secrets (after first install)
secrets:
	@echo "=== Generated Secrets ==="
	kubectl get secret $(RELEASE)-secrets -n $(NAMESPACE) -o jsonpath='{.data}' | jq 'keys'
