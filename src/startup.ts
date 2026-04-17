import chalk from "chalk";
import concurrently from "concurrently";
import { execa } from "execa";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Service, ServiceConfig } from "./config.js";
import {
	type ServiceLogStream,
	createServiceLogStream,
} from "./log-stream.js";
import { generateRunNodeCommand } from "./node-utils.js";
import { cleanUpOrphanedServices } from "./port-utils.js";
import { expandPath, wait } from "./utils.js";

// Walk up from `dir` to find the nearest pnpm workspace root (directory containing
// pnpm-workspace.yaml, falling back to pnpm-lock.yaml). Used to dedupe installs so
// concurrent `pnpm install`s in sibling apps don't race on the shared store.
function findWorkspaceRoot(dir: string): string {
	let current = path.resolve(dir);
	while (true) {
		if (
			existsSync(path.join(current, "pnpm-workspace.yaml")) ||
			existsSync(path.join(current, "pnpm-lock.yaml"))
		) {
			return current;
		}
		const parent = path.dirname(current);
		if (parent === current) return path.resolve(dir);
		current = parent;
	}
}

const PORT_CLEANUP_DELAY = 1000;

export interface StartupOptions {
	services?: string[];
	serviceConfig: ServiceConfig;
}

export async function startServices(options: StartupOptions): Promise<void> {
	const { services, serviceConfig } = options;

	const servicesToStart = services && services.length > 0
		? services.map((name) => {
				const svc = serviceConfig[name];
				if (!svc) {
					throw new Error(
						`Unknown service "${name}". Available: ${Object.keys(serviceConfig).join(", ")}`,
					);
				}
				return svc;
			})
		: Object.values(serviceConfig);

	await cleanUpOrphanedServices(servicesToStart);
	await wait(PORT_CLEANUP_DELAY);

	// Run installs serially before launching dev servers in parallel. pnpm in a
	// shared workspace can't tolerate concurrent installs (ENOENT on unlink in
	// node_modules/.pnpm), so dedupe by (workspace root, install command).
	const installSeen = new Set<string>();
	for (const svc of servicesToStart) {
		if (!svc.installCommand) continue;
		const dir = expandPath(svc.directory);
		const wsRoot = findWorkspaceRoot(dir);
		const key = `${wsRoot}\0${svc.installCommand}`;
		if (installSeen.has(key)) continue;
		installSeen.add(key);
		console.log(
			chalk.blue(`\n📦 Installing for ${svc.name} `) +
				chalk.dim(`(${svc.installCommand} in ${wsRoot})`),
		);
		const installShellCmd = generateRunNodeCommand({
			directory: svc.directory,
			stringCommand: svc.installCommand,
		});
		try {
			await execa(installShellCmd, { shell: true, stdio: "inherit" });
		} catch (err) {
			throw new Error(
				`Install failed for ${svc.name} (${svc.installCommand}): ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	console.log(chalk.blue("\n🚀 Starting services...\n"));

	const serviceCommands = servicesToStart.map((service) => ({
		name: service.name.toUpperCase(),
		command: buildServiceCommand(service),
		displayCommand: service.startCommand,
		directory: expandPath(service.directory),
	}));

	const allSameDir =
		serviceCommands.length > 0 &&
		serviceCommands.every(
			(cmd) => cmd.directory === serviceCommands[0].directory,
		);

	if (allSameDir) {
		console.log(chalk.dim(`  in ${serviceCommands[0].directory}\n`));
		for (const cmd of serviceCommands) {
			console.log(`  ${chalk.bold(cmd.name)} ${chalk.dim(cmd.displayCommand)}`);
		}
	} else {
		for (const cmd of serviceCommands) {
			console.log(
				`  ${chalk.bold(cmd.name)} ${chalk.dim(cmd.displayCommand)}`,
			);
			console.log(chalk.dim(`    in ${cmd.directory}`));
		}
	}
	console.log();

	const { commands, result } = concurrently(serviceCommands, {
		prefix: "name",
		killOthersOn: ["failure"],
		padPrefix: true,
		prefixColors: Object.values(servicesToStart).map(
			(service) => service.color ?? "bgBlue.bold",
		),
	});

	// Set up per-service log files by subscribing to each command's output
	const logStreams: ServiceLogStream[] = [];
	for (let i = 0; i < commands.length; i++) {
		const svc = servicesToStart[i];
		const cmd = commands[i];
		const logStream = createServiceLogStream(
			expandPath(svc.directory),
			svc.name.toLowerCase(),
		);
		logStreams.push(logStream);

		console.log(chalk.dim(`  📝 ${svc.name}: ${logStream.logPath}`));

		cmd.stdout.subscribe((data) => logStream.write(data));
		cmd.stderr.subscribe((data) => logStream.write(data));
	}
	console.log();

	try {
		await result;
	} finally {
		for (const stream of logStreams) {
			stream.end();
		}
	}
}

function buildServiceCommand(service: Service): string {
	// Install is handled serially up-front; here we only run the dev command.
	return generateRunNodeCommand({
		directory: service.directory,
		stringCommand: service.startCommand,
	});
}
