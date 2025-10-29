import { createCLI } from "../src/cli-generator.js";
import type { Config } from "../src/config.js";

const ROOT_DIR = "$HOME/src/work/example";

const exampleConfig: Config = {
	services: {
		app: {
			name: "App",
			directory: `${ROOT_DIR}/slc-app`,
			installCommand: "npm install",
			startCommand: "bun run dev",
			port: 3000,
			color: "bgBlue.bold",
		},
		server: {
			name: "Server",
			directory: `${ROOT_DIR}/example-server`,
			installCommand: "npm install",
			startCommand: "bun run dev",
			port: 3001,
			color: "bgGreen.bold",
		},
		migrate: {
			name: "Migrate",
			directory: `${ROOT_DIR}/example-server`,
			startCommand:
				'bun run migrate:up-local || osascript -e "display notification \\"Migration failed\\" with title \\"Example\\""',
			color: "bgRed.bold",
		},
	},
	validation: {
		commands: [
			{
				name: "LINT",
				command: "bunx eslint --ext .js,.jsx,.ts,.tsx --fix --cache {files_js}",
				color: "bgBlue",
			},
			{
				name: "FORMAT",
				command: "bunx prettier --write {files}",
				color: "bgYellow",
			},
			{
				name: "BUILD",
				command: "bun run type-check || bun run build",
				color: "bgBlue",
				slow: true,
			},
		],
	},
};

const program = createCLI({ name: "example", config: exampleConfig });
program.parse();
