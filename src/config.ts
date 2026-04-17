import type { ChalkColor } from "./chalk-utils.js";

export interface Service {
	name: string;
	directory: string;
	installCommand?: string;
	startCommand: string;
	port?: number;
	color?: ChalkColor;
	// Short blurb describing what this service is.
	description?: string;
	// Guidance for when the user should actually start this service.
	whenToUse?: string;
}

export interface ValidationCommand {
	name: string;
	command: string;
	color?: ChalkColor;
	slow?: boolean;
	directory?: string;
	// If set, skip this command unless at least one of the listed pnpm scripts
	// exists in the cwd's package.json. Lets us show honest "skipped" output
	// for repos that don't have e.g. a root-level `build` script, rather than
	// the misleading "succeeded" that `pnpm run --if-present` otherwise produces.
	skipIfNoScripts?: string[];
}

export interface ValidationConfig {
	commands: ValidationCommand[];
	installCommand?: string;
}

export interface ServiceConfig {
	[key: string]: Service;
}

export interface Config {
	services?: ServiceConfig;
	validation?: ValidationConfig;
	commands?: ValidationCommand[];
}
