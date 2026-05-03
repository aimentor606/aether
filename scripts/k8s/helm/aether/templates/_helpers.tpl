{{/*
Expand the name of the chart.
*/}}
{{- define "aether.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "aether.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart label values.
*/}}
{{- define "aether.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to every resource.
*/}}
{{- define "aether.labels" -}}
helm.sh/chart: {{ include "aether.chart" . }}
{{ include "aether.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels for matching pods.
*/}}
{{- define "aether.selectorLabels" -}}
app.kubernetes.io/name: {{ include "aether.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Namespace helper — uses global.namespace if set, else Release.Namespace.
*/}}
{{- define "aether.namespace" -}}
{{- .Values.global.namespace | default .Release.Namespace }}
{{- end }}

{{/*
API fullname.
*/}}
{{- define "aether.api.fullname" -}}
{{- printf "%s-api" (include "aether.fullname" .) }}
{{- end }}

{{/*
LiteLLM fullname.
*/}}
{{- define "aether.litellm.fullname" -}}
{{- printf "%s-litellm" (include "aether.fullname" .) }}
{{- end }}

{{/*
Redis fullname.
*/}}
{{- define "aether.redis.fullname" -}}
{{- printf "%s-redis" (include "aether.fullname" .) }}
{{- end }}

{{/*
Kafka fullname.
*/}}
{{- define "aether.kafka.fullname" -}}
{{- printf "%s-kafka" (include "aether.fullname" .) }}
{{- end }}

{{/*
ClickHouse fullname.
*/}}
{{- define "aether.clickhouse.fullname" -}}
{{- printf "%s-clickhouse" (include "aether.fullname" .) }}
{{- end }}

{{/*
OpenMeter fullname.
*/}}
{{- define "aether.openmeter.fullname" -}}
{{- printf "%s-openmeter" (include "aether.fullname" .) }}
{{- end }}

{{/*
CNPG cluster name.
*/}}
{{- define "aether.cnpg.fullname" -}}
{{- printf "%s-pg" (include "aether.fullname" .) }}
{{- end }}

{{/*
Secret name for application secrets.
*/}}
{{- define "aether.secretName" -}}
{{- printf "%s-secrets" (include "aether.fullname" .) }}
{{- end }}

{{/*
ConfigMap name for application config.
*/}}
{{- define "aether.configName" -}}
{{- printf "%s-config" (include "aether.fullname" .) }}
{{- end }}

{{/*
Public origin URL.
*/}}
{{- define "aether.publicOrigin" -}}
{{- printf "https://%s" .Values.global.domain }}
{{- end }}
