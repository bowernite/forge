import fs from "node:fs";
import path from "node:path";
import type { ValidationCommand } from "../config.js";
import { expandPath } from "../utils.js";
import type { ChangedFiles } from "./validation-files.js";

export interface CommandContext {
	name: string;
	command: string;
	cwd: string;
	color?: string;
	files: string[];
	filesJs: string[];
	filesTests: string[];
	skip?: boolean;
}

function filterAndRelativizeFiles(
	absoluteFiles: string[],
	workingDir: string,
): string[] {
	return absoluteFiles
		.filter((absFile) => {
			const rel = path.relative(workingDir, absFile);
			return !rel.startsWith("..") && !path.isAbsolute(rel);
		})
		.map((absFile) => path.relative(workingDir, absFile));
}

function resolvePlaceholders(
	template: string,
	placeholders: Record<string, string>,
): string {
	let result = template;
	for (const [key, value] of Object.entries(placeholders)) {
		result = result.replaceAll(key, value);
	}
	return result;
}

function hasAnyScript(workingDir: string, scripts: string[]): boolean {
	try {
		const pkgPath = path.join(workingDir, "package.json");
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
			scripts?: Record<string, string>;
		};
		const present = pkg.scripts ?? {};
		return scripts.some((name) => name in present);
	} catch {
		// No package.json or unreadable — treat as "nothing to run"
		return false;
	}
}

// Check if the command template uses any placeholders that resolved to empty
function hasEmptyRequiredPlaceholders(
	template: string,
	placeholders: Record<string, string>,
): boolean {
	for (const [key, value] of Object.entries(placeholders)) {
		if (template.includes(key) && !value.trim()) {
			return true;
		}
	}
	return false;
}

export function buildCommandContext(
	cmd: ValidationCommand,
	changedFiles: ChangedFiles,
): CommandContext {
	let workingDir = changedFiles.repoRoot;
	if (cmd.directory) {
		const expandedDirectory = expandPath(cmd.directory);
		workingDir = path.isAbsolute(expandedDirectory)
			? expandedDirectory
			: path.resolve(changedFiles.repoRoot, expandedDirectory);
	}

	const files = filterAndRelativizeFiles(changedFiles.allAbsolute, workingDir);
	const filesJs = filterAndRelativizeFiles(
		changedFiles.jstsAbsolute,
		workingDir,
	);
	const filesTests = filterAndRelativizeFiles(
		changedFiles.testsAbsolute,
		workingDir,
	);

	const placeholders = {
		"{files}": files.join(" "),
		"{files_js}": filesJs.join(" "),
		"{files_tests}": filesTests.join(" "),
	};

	const skipForEmptyPlaceholders = hasEmptyRequiredPlaceholders(
		cmd.command,
		placeholders,
	);
	const skipForMissingScripts =
		!!cmd.skipIfNoScripts?.length &&
		!hasAnyScript(workingDir, cmd.skipIfNoScripts);
	const skip = skipForEmptyPlaceholders || skipForMissingScripts;
	const resolvedCommand = resolvePlaceholders(cmd.command, placeholders);

	return {
		name: cmd.name,
		command: resolvedCommand,
		cwd: workingDir,
		color: cmd.color,
		files,
		filesJs,
		filesTests,
		skip,
	};
}
