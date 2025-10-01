import chalk from "chalk";
import { Command } from "commander";
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
		// Validate command
		program
			.command("validate")
			.description("Run validation on changed files")
			.option("--full", "Run full validation including build and audit")
			.option("--quick", "Skip build and audit steps")
			.option(
				"--auto-commit",
				"Automatically commit changes after successful validation",
			)
			.action(async (options) => {
				if (!config.validation) throw new Error("No validation configured");
				try {
					const success = await runValidation({
						full: options.full,
						quick: options.quick,
						autoCommit: options.autoCommit,
						config: config.validation,
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
		program
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

	return program;
}

export function createProjectCLI(projectName: string, config: Config): Command {
	return createCLI({ name: projectName, config });
}
