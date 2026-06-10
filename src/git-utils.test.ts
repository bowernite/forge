import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execa } from "execa";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getBranchChangedFiles } from "./git-utils.ts";

/**
 * These tests build throwaway git repos with a real `origin` remote so we can
 * reproduce the "stale local dev branch" staleness bug: a local `main` that
 * lags `origin/main`, with a feature branch cut from the newer `origin/main`.
 */

let scratchDirs: string[] = [];
let originalCwd: string;
let originalPath: string | undefined;

function git(cwd: string, args: string[]) {
	return execa("git", args, {
		cwd,
		reject: true,
		env: {
			GIT_AUTHOR_NAME: "Test",
			GIT_AUTHOR_EMAIL: "test@test.com",
			GIT_COMMITTER_NAME: "Test",
			GIT_COMMITTER_EMAIL: "test@test.com",
		},
	});
}

function mkScratch(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	scratchDirs.push(dir);
	return dir;
}

function write(dir: string, name: string, contents: string) {
	writeFileSync(join(dir, name), contents);
}

beforeEach(() => {
	originalCwd = process.cwd();
	originalPath = process.env.PATH;
	scratchDirs = [];

	// Make graphite (`gt`) resolution deterministically fail so tests exercise
	// the git-based parent detection rather than whatever graphite state the host
	// machine happens to have. We shadow `gt` with a stub that always exits 1.
	const stubBin = mkScratch("forge-stubbin-");
	const gtStub = join(stubBin, "gt");
	writeFileSync(gtStub, "#!/bin/sh\nexit 1\n");
	chmodSync(gtStub, 0o755);
	process.env.PATH = `${stubBin}:${originalPath ?? ""}`;
});

afterEach(() => {
	process.chdir(originalCwd);
	process.env.PATH = originalPath;
	for (const dir of scratchDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
});

/**
 * Builds:
 *   - a bare "origin" repo with `main` having an initial commit + N upstream commits
 *   - a clone whose local `main` is reset back to BEFORE those upstream commits (stale)
 *   - a feature branch cut from the latest `origin/main`, with one user change
 *
 * Returns the clone dir. The only file the user actually changed is "feature.txt".
 */
async function buildStaleLocalMainRepo(
	upstreamCommits: number,
): Promise<string> {
	const origin = mkScratch("forge-origin-");
	await git(origin, ["init", "--bare", "-b", "main"]);

	const seed = mkScratch("forge-seed-");
	await git(seed, ["init", "-b", "main"]);
	write(seed, "base.txt", "base\n");
	await git(seed, ["add", "."]);
	await git(seed, ["commit", "-m", "initial"]);
	await git(seed, ["remote", "add", "origin", origin]);
	await git(seed, ["push", "origin", "main"]);

	// This is the commit the local clone's `main` will be stuck at.
	const { stdout: staleBase } = await git(seed, ["rev-parse", "HEAD"]);

	// Advance origin/main with upstream commits the user never touched.
	for (let i = 0; i < upstreamCommits; i++) {
		write(seed, `upstream-${i}.txt`, `upstream ${i}\n`);
		await git(seed, ["add", "."]);
		await git(seed, ["commit", "-m", `upstream ${i}`]);
	}
	await git(seed, ["push", "origin", "main"]);

	// Fresh clone, then make local `main` lag behind origin/main.
	const clone = mkScratch("forge-clone-");
	await git(clone, ["clone", origin, "."]);
	// Reset local main back to the stale base, while origin/main stays ahead.
	await git(clone, ["reset", "--hard", staleBase]);

	// Cut a feature branch from the *latest* origin/main (the realistic worktree case).
	await git(clone, ["checkout", "-b", "feature", "origin/main"]);
	write(clone, "feature.txt", "my real change\n");
	await git(clone, ["add", "."]);
	await git(clone, ["commit", "-m", "my real change"]);

	return clone;
}

/**
 * Builds a clone whose local `main` is fully up to date with `origin/main`,
 * with a feature branch carrying a single user change.
 */
async function buildUpToDateRepo(): Promise<string> {
	const origin = mkScratch("forge-origin-");
	await git(origin, ["init", "--bare", "-b", "main"]);

	const seed = mkScratch("forge-seed-");
	await git(seed, ["init", "-b", "main"]);
	write(seed, "base.txt", "base\n");
	await git(seed, ["add", "."]);
	await git(seed, ["commit", "-m", "initial"]);
	await git(seed, ["remote", "add", "origin", origin]);
	await git(seed, ["push", "origin", "main"]);

	const clone = mkScratch("forge-clone-");
	await git(clone, ["clone", origin, "."]);
	await git(clone, ["checkout", "-b", "feature"]);
	write(clone, "feature.txt", "my real change\n");
	await git(clone, ["add", "."]);
	await git(clone, ["commit", "-m", "my real change"]);

	return clone;
}

describe("getBranchChangedFiles staleness", () => {
	test("does not include upstream commits when local dev branch lags its remote", async () => {
		const clone = await buildStaleLocalMainRepo(5);
		process.chdir(clone);

		const changed = await getBranchChangedFiles();

		expect(changed).toEqual(["feature.txt"]);
		// Explicitly: none of the upstream files should leak into the diff.
		expect(changed.some((f) => f.startsWith("upstream-"))).toBe(false);
	});

	test("up-to-date local dev branch yields only the user's changes", async () => {
		const clone = await buildUpToDateRepo();
		process.chdir(clone);

		const changed = await getBranchChangedFiles();

		expect(changed).toEqual(["feature.txt"]);
	});

	test("explicit base branch is respected", async () => {
		const clone = await buildStaleLocalMainRepo(5);
		process.chdir(clone);

		// Caller explicitly asks to diff against origin/main.
		const changed = await getBranchChangedFiles({ baseBranch: "origin/main" });

		expect(changed).toEqual(["feature.txt"]);
	});

	test("keeps the newer LOCAL base when local dev branch is ahead of its remote", async () => {
		const clone = await buildUpToDateRepo();

		// Advance LOCAL main ahead of origin/main with a commit that is NOT on the
		// feature branch. If we wrongly regressed to the older origin/main base,
		// this unrelated commit would leak into the feature diff.
		await git(clone, ["checkout", "main"]);
		write(clone, "local-ahead.txt", "unpushed work\n");
		await git(clone, ["add", "."]);
		await git(clone, ["commit", "-m", "unpushed local main commit"]);

		// Re-create the feature branch off the *newer* local main.
		await git(clone, ["checkout", "-b", "feature2"]);
		write(clone, "feature2.txt", "my real change\n");
		await git(clone, ["add", "."]);
		await git(clone, ["commit", "-m", "my real change 2"]);

		process.chdir(clone);

		const changed = await getBranchChangedFiles({ baseBranch: "main" });

		// Only the feature's own change — the unpushed local-main commit is the
		// shared base, so it must not appear, and we must not regress to
		// origin/main (which would surface local-ahead.txt).
		expect(changed).toEqual(["feature2.txt"]);
		expect(changed).not.toContain("local-ahead.txt");
	});
});
