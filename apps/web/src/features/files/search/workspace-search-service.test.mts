import assert from "node:assert/strict";
import test from "node:test";

import {
	searchIndexedWorkspaceEntries,
	toWorkspaceSearchEntry,
	type WorkspaceSearchEntry,
} from "./workspace-search-core.ts";

function resultPaths(entries: WorkspaceSearchEntry[]): string[] {
	return entries.map((entry) => entry.path);
}

test("searchIndexedWorkspaceEntries ranks exact file path first", () => {
	const exactPath =
		"/workspace/.local/share/opencode/storage/session_diff/ses_exact.json";
	const entries = [
		toWorkspaceSearchEntry("/workspace/session_diff.json"),
		toWorkspaceSearchEntry(
			"/workspace/.local/share/opencode/storage/session_diff/older.json",
		),
		toWorkspaceSearchEntry(exactPath),
		toWorkspaceSearchEntry(
			"/workspace/.local/share/opencode/storage/session_diff",
			true,
		),
	];

	const results = searchIndexedWorkspaceEntries(entries, exactPath, {
		limit: 5,
		type: "file",
	});

	assert.equal(results[0]?.path, exactPath);
});

test("searchIndexedWorkspaceEntries filters directories when type is file", () => {
	const entries = [
		toWorkspaceSearchEntry("/workspace/src", true),
		toWorkspaceSearchEntry("/workspace/src/app.tsx"),
		toWorkspaceSearchEntry("/workspace/src/app.test.tsx"),
	];

	const results = searchIndexedWorkspaceEntries(entries, "/workspace/src", {
		limit: 10,
		type: "file",
	});

	assert.deepEqual(resultPaths(results), [
		"/workspace/src/app.test.tsx",
		"/workspace/src/app.tsx",
	]);
	assert.ok(results.every((entry) => !entry.isDir));
});

test("searchIndexedWorkspaceEntries keeps directories when type is directory", () => {
	const entries = [
		toWorkspaceSearchEntry("/workspace/src", true),
		toWorkspaceSearchEntry("/workspace/src/components", true),
		toWorkspaceSearchEntry("/workspace/src/app.tsx"),
	];

	const results = searchIndexedWorkspaceEntries(entries, "/workspace/src", {
		limit: 10,
		type: "directory",
	});

	assert.ok(results.every((entry) => entry.isDir));
	assert.deepEqual(resultPaths(results), [
		"/workspace/src",
		"/workspace/src/components",
	]);
});
