"use client";

// ============================================================================
// Shared types for session-chat sub-components
// ============================================================================

/** Selected text the user wants to reference in their next message. */
export interface ReplyToContext {
	text: string;
}

// ============================================================================
// DCP notification types
// ============================================================================

export interface DCPPrunedItem {
	tool: string;
	description: string;
}

export interface DCPNotification {
	type: "prune" | "compress";
	tokensSaved: number;
	batchSaved: number;
	prunedCount: number;
	extractedTokens: number;
	reason?: string;
	items: DCPPrunedItem[];
	distilled?: string;
	// compress-specific
	messagesCount?: number;
	toolsCount?: number;
	topic?: string;
	summary?: string;
}

// ============================================================================
// PTY exited notification types
// ============================================================================

export interface PtyExitedNotification {
	id?: string;
	description?: string;
	exitCode?: string;
	outputLines?: string;
	lastLine?: string;
}

// ============================================================================
// Agent completed notification types
// ============================================================================

export interface AgentCompletedNotification {
	agentId?: string;
	task?: string;
	sessionId?: string;
	status?: string;
	error?: string;
	summary?: string;
}

// ============================================================================
// Parsed file/session reference types
// ============================================================================

export interface ParsedFileRef {
	path: string;
	mime: string;
	filename: string;
}

export interface ParsedSessionRef {
	id: string;
	title: string;
}
