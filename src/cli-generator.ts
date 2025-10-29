import chalk from "chalk";
import { Command } from "commander";
import { execa } from "execa";
import path from "node:path";
import type { Config } from "./config.js";
import { startServices } from "./startup.js";
import { runValidation } from "./validation.js";

export interface ProjectConfig {
	name: string;
	config: Config;
}

export function createCLI(projectConfig: ProjectConfig): Command {
	const { name, config } = projectConfig;

	const program = new Command();
	program.name(name);

	if (config.validation) {
		const validateCommand = program
			.command("validate")
			.description("Validate the project")
			.option("--full", "Run all validation commands (not just the quick ones)")
			.option(
				"--auto-commit",
				"Automatically commit changes after successful validation",
			);

		for (const cmd of config.validation.commands) {
			const flagName = `--${cmd.name.toLowerCase()}`;
			validateCommand.option(flagName, `Run ${cmd.name} validation`);
		}

		validateCommand.action(async (options) => {
			if (!config.validation) throw new Error("No validation configured");
			try {
				const commandFlags: Record<string, boolean> = {};
				for (const cmd of config.validation.commands) {
					const optionKey = cmd.name.toLowerCase();
					commandFlags[cmd.name] = options[optionKey] === true;
				}

				const success = await runValidation({
					full: options.full,
					autoCommit: options.autoCommit,
					config: config.validation,
					commandFlags,
				});
				process.exit(success ? 0 : 1);
			} catch (error) {
				console.error(
					chalk.red("Error:"),
					error instanceof Error ? error.message : String(error),
				);
				process.exit(1);
			}
		});
	}

	// Start command
	if (config.services) {
		const serviceNames = Object.keys(config.services);
		const serviceList = serviceNames.map((name) => `  - ${name}`).join("\n");
		const startCommand = program
			.command("start [service]")
			.description("Start services")
			.argument(
				"[service]",
				"Service name to start (or all services if not specified)",
				"",
			)
			.action(async (service, _options) => {
				if (!config.services) throw new Error("No services configured");
				try {
					await startServices({ service, serviceConfig: config.services });
				} catch (error) {
					console.error(
						chalk.red("Error:"),
						error instanceof Error ? error.message : String(error),
					);
					process.exit(1);
				}
			});

		startCommand.addHelpText(
			"after",
			`\nAvailable services:\n${serviceList}`,
		);
	}

	// Config command
	program
		.command("config")
		.description("Show current configuration")
		.action(async (_options) => {
			try {
				console.log(JSON.stringify(config, null, 2));
			} catch (error) {
				console.error(
					chalk.red("Error:"),
					error instanceof Error ? error.message : String(error),
				);
				process.exit(1);
			}
		});

	// Rebuild command
	program
		.command("rebuild")
		.description("Rebuild this CLI binary")
		.action(async (_options) => {
			try {
				const binPath = path.resolve(process.execPath);
				const binDir = path.dirname(binPath);
				const forgeRoot = path.dirname(binDir);
				const buildScript = path.join(forgeRoot, "scripts", "build.sh");

				await execa(buildScript, ["build", name], {
					cwd: forgeRoot,
					stdio: "inherit",
				});
			} catch (error) {
				console.error(
					chalk.red("Error:"),
					error instanceof Error ? error.message : String(error),
				);
				process.exit(1);
			}
		});

	return program;
}

export function createProjectCLI(projectName: string, config: Config): Command {
	return createCLI({ name: projectName, config });
}
