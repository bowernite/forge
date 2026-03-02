import chalk from "chalk";
import { execa } from "execa";
import type { ValidationConfig } from "./config.js";
import {
	commitLintAndFormat,
	getBranchChangedFiles,
	getGitWorkingFiles,
	showChangedFilesPreview,
} from "./git-utils.js";
import { promptYesNo } from "./utils.js";
import { wrapWithFnmUse } from "./node-utils.js";
import { buildCommandContext } from "./validation/validation-command-builder.js";
import { getChangedFilesContext } from "./validation/validation-files.js";
import { runConcurrentValidation } from "./validation/validation-runner.js";

export interface ValidationOptions {
	full?: boolean;
	autoCommit?: boolean;
	config: ValidationConfig;
	commandFlags?: Record<string, boolean>;
}

export async function runValidation(
	options: ValidationOptions,
): Promise<boolean> {
	const {
		full = false,
		autoCommit = false,
		config,
		commandFlags = {},
	} = options;

	const branchChangedFiles = await getBranchChangedFiles();
	if (!branchChangedFiles.length) {
		console.log(
			chalk.yellow("⚠️  No changed files found to validate. Exiting."),
		);
		return true;
	}

	const initialWorkingFiles = await getGitWorkingFiles();

	if (config.installCommand) {
		console.log(chalk.blue("📦 Installing dependencies..."));
		try {
			await execa(wrapWithFnmUse(config.installCommand), { stdio: "inherit", shell: true });
		} catch (error) {
			console.error("Failed to install dependencies:", error);
			return false;
		} finally {
			console.log("");
		}
	}
	await showChangedFilesPreview();

	const changedFiles = await getChangedFilesContext();

	const commandContexts = config.commands
		.filter((cmd) => {
			if (full) return true;
			const commandIsSlow = cmd.slow === true;
			if (!commandIsSlow) return true;

			const commandWasSpecified = commandFlags[cmd.name] === true;
			return commandWasSpecified;
		})
		.map((cmd) => buildCommandContext(cmd, changedFiles));

	const success = await runConcurrentValidation(commandContexts);
	console.log("\n========================================\n");

	const newWorkingFiles = await getGitWorkingFiles();
	const modifiedFiles = newWorkingFiles.filter(
		(file) => !initialWorkingFiles.includes(file),
	);
	const filesWereChanged = !!modifiedFiles.length;

	if (!success) {
		console.log(`${chalk.red("❌ Something's afoot...")}`);
		return false;
	}

	console.log(`${chalk.green("✅ All good, homey")}`);

	if (filesWereChanged) {
		console.log("\nThe following files have been modified:");
		for (const file of modifiedFiles) {
			console.log(`\t${file}`);
		}

		console.log("");
		const shouldCommit = autoCommit || (await promptYesNo("Commit changes?"));
		if (shouldCommit) {
			await commitLintAndFormat();
		}

		// 10% of the time, show the auto-commit tip
		if (Math.random() < 0.1 && !autoCommit) {
			console.log(
				chalk.gray(
					"ℹ  Run with --auto-commit to automatically commit changes.",
				),
			);
		}
	}

	return true;
}
