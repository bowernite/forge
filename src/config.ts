import type { ChalkColor } from "./chalk-utils.js";

export interface Service {
	name: string;
	directory: string;
	installCommand?: string;
	startCommand: string;
	port?: number;
	color?: ChalkColor;
}

export interface ValidationCommand {
	name: string;
	command: string;
	color?: ChalkColor;
	slow?: boolean;
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
