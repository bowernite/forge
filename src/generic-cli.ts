#!/usr/bin/env node

import { createCLI } from "./cli-generator.js";
import { loadProjectConfig } from "./project-loader.js";

const projectName = process.argv[2];

if (!projectName) {
	console.error("Usage: generic-cli <project-name> [command] [options]");
	console.error("Available projects: slc");
	process.exit(1);
}

const config = loadProjectConfig(projectName);

if (!config) {
	console.error(`Project configuration not found for: ${projectName}`);
	process.exit(1);
}

const program = createCLI({ name: projectName, config });

// Remove the project name from argv so commander doesn't see it
process.argv = process.argv.slice(1);
program.parse();
