import chalk from "chalk";
import { Command } from "commander";
import { execa } from "execa";
import path from "node:path";
import type { Config, ServiceConfig } from "./config.js";
import { startServices } from "./startup.js";
import { runValidation } from "./validation.js";

function renderServicesHelp(services: ServiceConfig): string {
	const keys = Object.keys(services);
	const keyWidth = Math.max(...keys.map((k) => k.length));
	const lines: string[] = [chalk.bold("Services:")];
	for (const key of keys) {
		const svc = services[key];
		const portSuffix = svc.port ? chalk.dim(` :${svc.port}`) : "";
		const headline = svc.description
			? `${chalk.cyan(key.padEnd(keyWidth))}  ${svc.description}${portSuffix}`
			: `${chalk.cyan(key.padEnd(keyWidth))}${portSuffix}`;
		lines.push(`  ${headline}`);
		if (svc.whenToUse) {
			const indent = " ".repeat(keyWidth + 4);
			lines.push(`${indent}${chalk.dim("When:")} ${svc.whenToUse}`);
		}
	}
	return lines.join("\n");
}

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
		const servicesHelp = renderServicesHelp(config.services);
		const startCommand = program
			.command("start [services...]")
			.description(
				"Start one or more services (omit to start all)",
			)
			.action(async (services: string[], _options) => {
				if (!config.services) throw new Error("No services configured");
				try {
					await startServices({ services, serviceConfig: config.services });
				} catch (error) {
					console.error(
						chalk.red("Error:"),
						error instanceof Error ? error.message : String(error),
					);
					process.exit(1);
				}
			});

		startCommand.addHelpText("after", `\n${servicesHelp}`);
		program.addHelpText("after", `\n${servicesHelp}`);
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

	// Pull command
	program
		.command("pull")
		.description("Pull latest changes for the forge repo")
		.action(async (_options) => {
			try {
				const binPath = path.resolve(process.execPath);
				const binDir = path.dirname(binPath);
				const forgeRoot = path.dirname(binDir);

				console.log(chalk.blue(`Pulling latest changes in ${forgeRoot}...`));
				await execa("git", ["pull"], {
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
