import { createProjectCLI } from "../src/cli-generator.js";
import type { Config } from "../src/config.js";

const _ROOT_DIR = "$HOME/src/personal/forge";

const frgConfig: Config = {
	validation: {
		installCommand: "/opt/homebrew/bin/bun install",
		commands: [
			{
				name: "BIOME",
				command:
					"bunx @biomejs/biome check --write --unsafe --error-on-warnings .",
				color: "bgBlue",
			},
			{
				name: "TYPES",
				command: "bun run type-check",
				color: "bgBlue",
				slow: true,
			},
		],
	},
};

const cli = createProjectCLI("frg", frgConfig);
cli.parse();
