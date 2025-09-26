import type { Config } from "./config.js";

export interface ProjectModule {
	[key: string]: Config;
}

export function loadProjectConfig(projectName: string): Config | null {
	try {
		// Try to import the project configuration
		const projectModule = require(
			`../projects/${projectName}.js`,
		) as ProjectModule;

		// Look for a config export (could be named like 'slcConfig', 'frgConfig', etc.)
		const configKey = Object.keys(projectModule).find(
			(key) =>
				key.toLowerCase().includes("config") &&
				key.toLowerCase().includes(projectName.toLowerCase()),
		);

		if (configKey) {
			return projectModule[configKey];
		}

		// If no specific config found, look for any config export
		const anyConfigKey = Object.keys(projectModule).find((key) =>
			key.toLowerCase().includes("config"),
		);

		if (anyConfigKey) {
			return projectModule[anyConfigKey];
		}

		return null;
	} catch (error) {
		console.error(`Failed to load project config for ${projectName}:`, error);
		return null;
	}
}

export function getAvailableProjects(): string[] {
	// This would need to be implemented based on your file system
	// For now, return a hardcoded list
	return ["slc"];
}
