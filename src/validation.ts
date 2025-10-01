import chalk from "chalk";
import { execa } from "execa";
import { getChalkColor } from "./chalk-utils.js";
import type { ValidationCommand, ValidationConfig } from "./config.js";
import {
	commitLintAndFormat,
	getBranchChangedFiles,
	getChangedFrontendFiles,
	getChangedJsTsFiles,
	getGitWorkingFiles,
	showChangedFilesPreview,
} from "./git-utils.js";

export interface ValidationOptions {
	full?: boolean;
	quick?: boolean;
	autoCommit?: boolean;
	config: ValidationConfig;
}

export async function runValidation(
	options: ValidationOptions,
): Promise<boolean> {
	const { quick = false, autoCommit = false, config } = options;

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
			await execa(config.installCommand, { stdio: "inherit", shell: true });
		} catch (error) {
			console.error("Failed to install dependencies:", error);
			return false;
		} finally {
			console.log("");
		}
	}
	await showChangedFilesPreview();

	const changedFrontendFiles = await getChangedFrontendFiles();
	const changedJsFiles = await getChangedJsTsFiles();

	const commands = config.commands
		.filter((cmd) => !quick || cmd.slow !== false)
		.map((cmd) => ({
			name: cmd.name,
			command: cmd.command
				.replace("{files}", changedFrontendFiles.join(" "))
				.replace("{files_js}", changedJsFiles.join(" ")),
		}));

	const success = await runConcurrentValidation(commands);
	console.log("\n========================================\n");

	const newWorkingFiles = await getGitWorkingFiles();
	const changedFiles = newWorkingFiles.filter(
		(file) => !initialWorkingFiles.includes(file),
	);
	const filesWereChanged = !!changedFiles.length;
	if (filesWereChanged) {
		console.log();
		console.log("The following files have been modified:");
		for (const file of changedFiles) {
			console.log(`\t${file}`);
		}
	}

	if (success) {
		console.log(`${chalk.green("✅ All good, homey")}`);

		if (filesWereChanged) {
			if (autoCommit) {
				await commitLintAndFormat();
			} else {
				console.log(
					chalk.gray(
						"ℹ  Run with --auto-commit to automatically commit changes.",
					),
				);
			}
		}
	} else {
		console.log(`${chalk.red("❌ Something's afoot...")}`);
	}

	return success;
}

import Spinnies from "spinnies";

function getDefaultColors(): Array<(text: string) => string> {
	return [
		chalk.bgBlue,
		chalk.bgGreen,
		chalk.bgYellow,
		chalk.bgMagenta,
		chalk.bgCyan,
		chalk.bgRed,
		chalk.bgWhite,
		chalk.bgGray,
	];
}

async function runConcurrentValidation(
	commands: ValidationCommand[],
): Promise<boolean> {
	console.log(chalk.blue("\n🚀 Running validation commands...\n"));

	const spinnies = new Spinnies();
	commands.forEach((cmd) => {
		spinnies.add(cmd.name, {
			text: `🚀 ${cmd.name}: in progress...`,
			spinnerColor: "blue",
		});
	});

	const defaultColors = getDefaultColors();
	// Find the max label width (including brackets)
	const maxLabelLength = Math.max(
		...commands.map((cmd) => `[${cmd.name}]`.length),
	);

	function getPaddedLabelParts(cmdName: string): {
		colored: string;
		padding: string;
	} {
		const label = `[${cmdName}]`;
		const padding = " ".repeat(maxLabelLength - label.length);
		return { colored: label, padding };
	}

	const promises = commands.map((cmd, index) => {
		const labelColor =
			getChalkColor(cmd.color) || defaultColors[index % defaultColors.length];

		// Split command into parts for execa
		const [command, ...args] = cmd.command.split(" ");
		return execa(command, args, {
			stdio: "pipe", // Capture output instead of inheriting
			shell: true,
		})
			.then((result) => {
				// Process stdout and stderr with colored labels
				if (result.stdout) {
					const lines = result.stdout.split("\n");
					lines.forEach((line: string) => {
						if (line.trim()) {
							const { colored, padding } = getPaddedLabelParts(cmd.name);
							process.stdout.write(
								`${labelColor(colored) + padding} ${line}\n`,
							);
						}
					});
				}
				if (result.stderr) {
					const lines = result.stderr.split("\n");
					lines.forEach((line: string) => {
						if (line.trim()) {
							const { colored, padding } = getPaddedLabelParts(cmd.name);
							process.stdout.write(
								`${labelColor(colored) + padding} ${line}\n`,
							);
						}
					});
				}

				spinnies.succeed(cmd.name, { text: `✅ ${cmd.name} succeeded` });
				return { name: cmd.name, success: true };
			})
			.catch((error) => {
				// Handle error output with colored labels
				if (error.stdout) {
					const lines = error.stdout.split("\n");
					lines.forEach((line: string) => {
						if (line.trim()) {
							const { colored, padding } = getPaddedLabelParts(cmd.name);
							process.stdout.write(
								`${labelColor(colored) + padding} ${line}\n`,
							);
						}
					});
				}
				if (error.stderr) {
					const lines = error.stderr.split("\n");
					lines.forEach((line: string) => {
						if (line.trim()) {
							const { colored, padding } = getPaddedLabelParts(cmd.name);
							process.stdout.write(
								`${labelColor(colored) + padding} ${line}\n`,
							);
						}
					});
				}

				const errorMessage =
					error instanceof Error ? error.message : String(error);
				spinnies.fail(cmd.name, {
					text: `❌ ${cmd.name} failed: ${errorMessage}`,
				});
				return { name: cmd.name, success: false, error };
			});
	});

	const results = await Promise.all(promises);

	const failed = results.filter((r) => !r.success);

	const allSucceeded = failed.length === 0;
	return allSucceeded;
}
