import chalk from "chalk";
import { execa } from "execa";

export async function getGitParentBranch(): Promise<string> {
	try {
		const currentBranch = await getCurrentGitBranch();
		const devBranch = await getGitDevBranch();

		// If we're on the trunk branch itself, compare against its remote tracking branch
		if (currentBranch === devBranch) {
			return `origin/${devBranch}`;
		}

		try {
			const graphiteParent = await getGraphiteParentBranch();
			if (graphiteParent) return graphiteParent;
		} catch {}

		if (await doesBranchHaveItsOwnRootCommit(currentBranch)) {
			return devBranch;
		}

		// Try to find the best guess parent branch
		const bestGuess = await findBestGuessParentBranch(currentBranch);
		if (bestGuess) return bestGuess;
	} catch {}
	// If everything fails, default to the development branch
	return getGitDevBranch();
}

async function doesBranchHaveItsOwnRootCommit(
	branch: string,
): Promise<boolean> {
	const devBranch = await getGitDevBranch();
	const branchRoot = await getBranchRootCommit(branch);
	const devRoot = await getBranchRootCommit(devBranch);
	return branchRoot !== devRoot;
}

async function findBestGuessParentBranch(
	currentBranch: string,
): Promise<string | undefined> {
	const devBranch = await getGitDevBranch();

	// Get local branches excluding the current one
	const branches = (await getLocalBranches()).filter(
		(branch) => branch && branch !== currentBranch,
	);

	// Find the best candidate by looking at how many of our commits are not on that branch
	// (i.e., how far HEAD has diverged from the merge-base with each candidate)
	let bestBranch = "";
	let bestCount = Infinity;
	for (const branch of branches) {
		try {
			const base = await getMergeBase(currentBranch, branch);
			if (!base) continue;

			const count = await getNumberOfCommitsBetweenBranches(base, "HEAD");

			// Use the branch whose merge-base is closest to HEAD (fewest commits ahead)
			// On ties, prefer the dev branch (e.g. main) over stale local branches
			if (
				!Number.isNaN(count) &&
				(count < bestCount ||
					(count === bestCount && branch === devBranch))
			) {
				bestBranch = branch;
				bestCount = count;
			}
		} catch {}
	}

	return bestBranch;
}

/**
 * Get the number of commits between two branches.
 */
async function getNumberOfCommitsBetweenBranches(
	branch1: string,
	branch2: string,
): Promise<number> {
	const { stdout } = await execa(
		"git",
		["rev-list", "--count", `${branch1}..${branch2}`],
		{
			reject: false,
		},
	);
	return parseInt(stdout.trim(), 10);
}

/**
 * Get the merge base of two branches, i.e. the common ancestor of two branches.
 */
async function getMergeBase(branch1: string, branch2: string): Promise<string> {
	const { stdout } = await execa("git", ["merge-base", branch1, branch2], {
		reject: false,
	});
	return stdout.trim();
}

async function getGitDevBranch(): Promise<string> {
	const candidates = ["develop", "development", "dev", "main"];
	for (const branch of candidates) {
		try {
			const { stdout } = await execa("git", ["branch", "--list", branch], {
				reject: false,
			});
			if (stdout.trim()) return branch;
		} catch {}
	}
	return "master";
}

async function getCurrentGitBranch(): Promise<string> {
	const { stdout } = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
	return stdout.trim();
}

/**
 * Get the root commit of a branch.
 *
 * A root commit is the very first commit in a branch's history—one that has no parent commits.
 * In git, this is the initial commit from which all other commits in that branch descend.
 */
async function getBranchRootCommit(branch: string): Promise<string> {
	const { stdout } = await execa(
		"git",
		["rev-list", "--max-parents=0", branch],
		{ reject: false },
	);
	return stdout.trim();
}

async function getGraphiteParentBranch(): Promise<string> {
	const { stdout } = await execa("gt", ["parent"], {
		reject: false,
	});
	return stdout.trim();
}

async function getLocalBranches(): Promise<string[]> {
	const { stdout } = await execa(
		"git",
		["for-each-ref", "--format=%(refname:short)", "refs/heads/"],
		{
			reject: false,
		},
	);
	return stdout.trim().split("\n");
}

export async function getBranchChangedFiles(
	options: { baseBranch?: string; pattern?: string } = {},
): Promise<string[]> {
	const baseBranch = options.baseBranch || (await getGitParentBranch());
	const pattern = options.pattern;

	const changedSinceBase = await getChangedFilesAgainstBase(baseBranch);
	const stagedChanges = await getStagedFiles();
	const unstagedChanges = await getUnstagedFiles();

	// Combine all outputs and filter for modified/added files
	const allChanges = [changedSinceBase, stagedChanges, unstagedChanges]
		.join("\n")
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => {
			const parts = line.split("\t");
			const status = parts[0];
			const filename = parts[parts.length - 1];
			return { status, filename };
		})
		.filter(({ status }) => {
			// Filter out deleted files (status 'D')
			return status !== "D";
		})
		.map(({ filename }) => filename);

	// Remove duplicates
	const uniqueFiles = [...new Set(allChanges)];

	// Apply pattern filter if provided
	if (pattern) {
		const regex = new RegExp(pattern);
		return uniqueFiles.filter((file) => regex.test(file));
	}

	return uniqueFiles;
}

export async function getChangedJsTsFiles(
	baseBranch?: string,
): Promise<string[]> {
	return getBranchChangedFiles({
		pattern: "\\.(js|jsx|ts|tsx|svelte|mjs)$",
		baseBranch,
	});
}

export async function getChangedTestFiles(
	baseBranch?: string,
): Promise<string[]> {
	return getBranchChangedFiles({
		pattern: "\\.(test|spec|vitest)\\.(js|jsx|ts|tsx|mjs|cjs)$",
		baseBranch,
	});
}

export async function showChangedFilesPreview(): Promise<void> {
	const changedFiles = await getBranchChangedFiles();

	console.log(chalk.blue("💅 Changed files to be validated:"));
	console.log(`\t${changedFiles.join("\n\t")}`);
}

export async function getGitWorkingFiles(): Promise<string[]> {
	const { stdout } = await execa("git", ["status", "--porcelain"], {
		reject: false,
	});
	return stdout
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => line.substring(3)); // Remove the status prefix
}

export async function commitLintAndFormat(): Promise<void> {
	const modifiedFiles = await getGitWorkingFiles();
	if (modifiedFiles.length === 0) {
		console.log("No modified files to commit.");
		return;
	}

	await execa("git", ["add", ...modifiedFiles]);
	await execa("git", ["commit", "-m", "lint & format"]);
	console.log(chalk.green("✅ Commited 'lint & format'"));
}

async function getChangedFilesAgainstBase(baseBranch: string): Promise<string> {
	const { stdout } = await execa(
		"git",
		["diff", "--name-status", `${baseBranch}...HEAD`],
		{ reject: false },
	);
	return stdout;
}

async function getStagedFiles(): Promise<string> {
	const { stdout } = await execa("git", ["diff", "--name-status", "--cached"], {
		reject: false,
	});
	return stdout;
}

async function getUnstagedFiles(): Promise<string> {
	// The original code only shows unstaged changes relative to HEAD, which fails in a fresh repo with no commits.
	// We replace it with a command that lists all untracked and modified (but unstaged) files, even if no commits exist yet.

	//   const { stdout } = await execa("git", ["diff", "--name-status"], {
	//     reject: false,
	//   });

	const { stdout: diffStdout } = await execa(
		"git",
		["diff", "--name-status"],
		{ reject: false },
	);
	const { stdout: untrackedStdout } = await execa(
		"git",
		["ls-files", "--others", "--exclude-standard"],
		{ reject: false },
	);
	const untrackedLines = untrackedStdout
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => `??\t${line}`)
		.join("\n");

	return [diffStdout, untrackedLines].filter((chunk) => chunk.trim()).join("\n");
}
