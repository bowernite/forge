import chalk from "chalk";
import { execa } from "execa";
import type { Service } from "./config";

export async function cleanUpOrphanedServices(services: Service[]) {
	console.log(chalk.yellow("\n🧹 Checking for orphaned processes..."));

	for (const { port, name } of services) {
		const { stdout } = await execa("lsof", ["-i", `:${port}`], {
			reject: false,
		});

		const orphanedProcesses = stdout
			.split("\n")
			.filter((line) => line.includes("LISTEN"))
			.map((line) => line.split(/\s+/)[1])
			.filter(Boolean);
		if (orphanedProcesses.length) {
			console.log(
				chalk.red(
					`🛑 Killing orphaned process for ${name.toUpperCase()} on port ${port}:`,
				),
			);
			console.log(`\t${orphanedProcesses.join("\n\t")}`);
			await killProcesses(orphanedProcesses);
		}
	}
}

async function killProcesses(processes: string[]) {
	await execa("kill", ["-9", ...processes]);
}
