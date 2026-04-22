/**
 * Model Dispatch — category-aware model selection for agent_spawn.
 *
 * When aether spawns a worker, this module can infer the task category
 * from the prompt and select the optimal model from aether's LiteLLM
 * provider instead of always inheriting the parent's model.
 *
 * Categories map to existing LiteLLM models:
 *   - review:  kimi         (balanced analysis, 262K context)
 *   - research: minimax-m27 (multimodal, 204K context)
 *   - deep:    glm-turbo    (deep reasoning, 202K context)
 *   - quick:   minimax      (fast, cheap, 196K context)
 *   - visual:  minimax-m27  (multimodal)
 *   - ultrabrain: glm-turbo (maximum capability)
 *   - writing: kimi         (good generation)
 */

export type TaskCategory =
  | "review"
  | "research"
  | "deep"
  | "quick"
  | "visual-engineering"
  | "ultrabrain"
  | "writing"
  | "default"

const CATEGORY_MODEL_MAP: Record<TaskCategory, string> = {
  "review":             "kimi",
  "research":           "minimax-m27",
  "deep":               "glm-turbo",
  "quick":              "minimax",
  "visual-engineering": "minimax-m27",
  "ultrabrain":         "glm-turbo",
  "writing":            "kimi",
  "default":            "minimax",
}

// Keyword patterns for inferring task category from prompt text
const CATEGORY_KEYWORDS: Record<TaskCategory, string[]> = {
  "review": [
    "review", "audit", "security", "vulnerability", "OWASP", "code review",
    "check for", "find bugs", "correctness", "maintainability", "testing coverage",
    "performance review", "security audit", "threat model", "STRIDE",
  ],
  "research": [
    "research", "investigate", "analyze", "explore", "search for", "find out",
    "look into", "documentation", "best practice", "how does", "what is",
    "compare", "benchmark", "survey",
  ],
  "deep": [
    "architecture", "design", "plan", "refactor", "migrate", "strategy",
    "complex", "multi-step", "system design", "trade-off", "decision",
    "evaluate approach", "architect",
  ],
  "quick": [
    "quick", "simple", "fast", "minor", "small", "trivial", "fix typo",
    "rename", "one-line", "format", "lint", "whitespace",
  ],
  "visual-engineering": [
    "screenshot", "UI", "UX", "design", "layout", "CSS", "visual", "frontend",
    "component", "page", "modal", "dialog", "responsive", "animation",
    "browser", "preview",
  ],
  "ultrabrain": [
    "critical", "production", "incident", "root cause", "debug production",
    "data migration", "breaking change", "hotfix", "rollback",
    "zero-downtime", "compliance",
  ],
  "writing": [
    "write", "generate", "document", "README", "changelog", "comment",
    "description", "email", "message", "report", "summary",
  ],
  "default": [],
}

/**
 * Infer the task category from the prompt text using keyword matching.
 * Returns the category with the highest keyword match count, or undefined
 * if no category scores above the threshold.
 */
export function inferCategoryFromPrompt(prompt: string): TaskCategory | undefined {
  const lower = prompt.toLowerCase()
  const scores = new Map<TaskCategory, number>()

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [TaskCategory, string[]][]) {
    if (category === "default") continue
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) score++
    }
    if (score > 0) scores.set(category, score)
  }

  if (scores.size === 0) return undefined

  let best: TaskCategory | undefined
  let bestScore = 0
  for (const [cat, score] of scores) {
    if (score > bestScore) {
      bestScore = score
      best = cat
    }
  }

  // Require at least 2 keyword matches for confidence
  return bestScore >= 2 ? best : undefined
}

/**
 * Resolve the model ID and provider ID for a given task category.
 * Falls back to the parent model if no category is specified.
 * Falls back to "aether"/"minimax" if no parent model either.
 */
export function resolveModelForCategory(
  category: TaskCategory | undefined,
  parentModel: { modelID: string; providerID: string } | undefined,
): { modelID: string; providerID: string } {
  if (category) {
    return { modelID: CATEGORY_MODEL_MAP[category], providerID: "aether" }
  }
  if (parentModel) {
    return parentModel
  }
  return { modelID: CATEGORY_MODEL_MAP["default"], providerID: "aether" }
}
