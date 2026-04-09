/**
 * Acme System XML — utilities for handling <acme_system> tags.
 *
 * Backend plugins wrap internal content (session context, memory, orchestrator
 * state, PTY output, etc.) in <acme_system type="..." source="..."> tags.
 *
 * - stripAcmeSystemTags: removes ALL tags before markdown rendering
 * - extractSessionReport: parses session-report tags into structured data
 */

const ACME_SYSTEM_RE = /<acme_system[^>]*>[\s\S]*?<\/acme_system>/gi

export function stripAcmeSystemTags(text: string): string {
	if (!text) return ""
	return text.replace(ACME_SYSTEM_RE, "").trim()
}

// ── Session Report extraction ────────────────────────────────────────────────

export interface SessionReport {
	sessionId: string
	status: "COMPLETE" | "FAILED"
	project: string
	prompt: string
	result: string
}

const SESSION_REPORT_RE = /<acme_system[^>]*type="session-report"[^>]*>[\s\S]*?<session-report>([\s\S]*?)<\/session-report>[\s\S]*?<\/acme_system>/i

export function extractSessionReport(text: string): SessionReport | null {
	if (!text) return null
	const match = text.match(SESSION_REPORT_RE)
	if (!match) return null

	const xml = match[1]
	const get = (tag: string) => {
		const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
		return m?.[1]?.trim() || ""
	}

	return {
		sessionId: get("session-id"),
		status: get("status") === "FAILED" ? "FAILED" : "COMPLETE",
		project: get("project"),
		prompt: get("prompt"),
		result: get("result"),
	}
}

/**
 * Check if a user message text is purely a acme_system message
 * (no visible user content outside the tags).
 */
export function isAcmeSystemOnly(text: string): boolean {
	if (!text) return false
	return stripAcmeSystemTags(text).length === 0
}
