import chalk from "chalk";
import concurrently from "concurrently";
import type { Service, ServiceConfig } from "./config.js";
import {
	type ServiceLogStream,
	createServiceLogStream,
} from "./log-stream.js";
import { generateRunNodeCommand } from "./node-utils.js";
import { cleanUpOrphanedServices } from "./port-utils.js";
import { expandPath, wait } from "./utils.js";

const PORT_CLEANUP_DELAY = 1000;

export interface StartupOptions {
	service?: string;
	serviceConfig: ServiceConfig;
}

export async function startServices(options: StartupOptions): Promise<void> {
	const { service, serviceConfig } = options;

	const servicesToStart = service
		? [serviceConfig[service]]
		: Object.values(serviceConfig);

	await cleanUpOrphanedServices(servicesToStart);
	await wait(PORT_CLEANUP_DELAY);

	console.log(chalk.blue("\n🚀 Starting services...\n"));

	const serviceCommands = servicesToStart.map((service) => ({
		name: service.name.toUpperCase(),
		command: buildServiceCommand(service),
		displayCommand: service.installCommand
			? `${service.installCommand} && ${service.startCommand}`
			: service.startCommand,
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
	const installCmd = service.installCommand;

	const command = installCmd
		? `${installCmd} && ${service.startCommand}`
		: service.startCommand;

	return generateRunNodeCommand({
		directory: service.directory,
		stringCommand: command,
	});
}
