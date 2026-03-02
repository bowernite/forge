import chalk from "chalk";
import { execa } from "execa";
import Spinnies from "spinnies";
import { getChalkColor } from "../chalk-utils.js";
import { wrapWithFnmUse } from "../node-utils.js";
import type { CommandContext } from "./validation-command-builder.js";

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

export async function runConcurrentValidation(
	commands: CommandContext[],
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
	const maxLabelLength = Math.max(
		...commands.map((cmd) => `[${cmd.name}]`.length),
	);

	const promises = commands.map((cmd, index) => {
		// console.log(`Running command: ${cmd.name}`);
		// console.log(`  Command: ${cmd.command}`);
		// console.log(`  In directory: ${cmd.cwd}`);

		const labelColor =
			getChalkColor(cmd.color) || defaultColors[index % defaultColors.length];

		return execa(wrapWithFnmUse(cmd.command), {
			shell: true,
			cwd: cmd.cwd,
			all: true,
			buffer: true,
		})
			.then((result) => {
				if (result.all) {
					const lines = result.all.split("\n");
					lines.forEach((line: string) => {
						if (line.trim()) {
							const { colored, padding } = getPaddedLabelParts(cmd.name);
							process.stdout.write(
								`${labelColor(colored) + padding} ${line}\n`,
							);
						}
					});
				}

				// Adding some extra characters at the end, to paper over an issue where sometimes the last character is cut off
				spinnies.succeed(cmd.name, { text: `✅ ${cmd.name} succeeded  ` });
				return { name: cmd.name, success: true };
			})
			.catch((error) => {
				if (error.all) {
					const lines = error.all.split("\n");
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

	function getPaddedLabelParts(cmdName: string): {
		colored: string;
		padding: string;
	} {
		const label = `[${cmdName}]`;
		const padding = " ".repeat(maxLabelLength - label.length);
		return { colored: label, padding };
	}
}
