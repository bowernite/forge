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
