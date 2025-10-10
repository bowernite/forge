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
		result = result.replace(key, value);
	}
	return result;
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

	const files = filterAndRelativizeFiles(changedFiles.frontendAbsolute, workingDir);
	const filesJs = filterAndRelativizeFiles(changedFiles.jstsAbsolute, workingDir);
	const filesTests = filterAndRelativizeFiles(changedFiles.testsAbsolute, workingDir);

	const placeholders = {
		"{files}": files.join(" "),
		"{files_js}": filesJs.join(" "),
		"{files_tests}": filesTests.join(" "),
	};

	const resolvedCommand = resolvePlaceholders(cmd.command, placeholders);

	return {
		name: cmd.name,
		command: resolvedCommand,
		cwd: workingDir,
		color: cmd.color,
		files,
		filesJs,
		filesTests,
	};
}

