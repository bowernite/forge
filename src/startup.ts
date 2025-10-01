import chalk from "chalk";
import concurrently from "concurrently";
import type { Service, ServiceConfig } from "./config.js";
import { generateRunNodeCommand } from "./node-utils.js";
import { cleanUpOrphanedServices } from "./port-utils.js";
import { wait } from "./utils.js";

// Constants
const _LOGS_DIR = "logs";
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
	}));
	const { result } = concurrently(serviceCommands, {
		prefix: "name",
		killOthersOn: ["failure"],
		padPrefix: true,
		prefixColors: Object.values(servicesToStart).map(
			(service) => service.color ?? "bgBlue.bold",
		),
	});

	await result;
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

// async function prepareLogDirectory({
// 	directory,
// 	name,
// }: Service): Promise<void> {
// 	try {
// 		await execa("mkdir", ["-p", `${directory}/${LOGS_DIR}`]);
// 		await execa("touch", [`${directory}/${LOGS_DIR}/${name}.log`]);
// 	} catch {
// 		console.warn(chalk.yellow(`Warning: Could not prepare logs for ${name}`));
// 	}
// }

// async function _runWithLogging(
// 	name: string,
// 	directory: string,
// 	command: string,
// ): Promise<void> {
// 	try {
// 		await prepareLogDirectory(name, directory);

// 		const fullCommand = generateRunNodeCommand({ stringCommand: command });

// 		await executeShellCommand(fullCommand, { cwd: directory });
// 	} catch (error) {
// 		console.error(chalk.red(`Error running ${name}:`), error);
// 		throw new Error(`Failed to run ${name}`);
// 	}
// }
