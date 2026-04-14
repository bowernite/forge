export function generateRunNodeCommand({
	directory,
	stringCommand,
}: {
	directory?: string;
	stringCommand: string;
}): string {
	// After cd, --use-on-cd silently fails if the version isn't installed (exit 0, wrong version).
	// Explicitly run fnm install + fnm use to ensure the correct version is active.
	const cdAndSetup = directory
		? `cd ${directory} && fnm install --log-level=quiet && fnm use --silent-if-unchanged && `
		: "";
	return `zsh -c '${runWithFnm(`${cdAndSetup}${stringCommand}`)}'`;
}

/**
 * Wraps a command to run with fnm environment and automatic Node.js version detection.
 * Uses zsh-specific hooks (--use-on-cd) — intended for interactive service commands
 * wrapped in `zsh -c '...'`.
 */
function runWithFnm(command: string): string {
	return `eval "$(fnm env --use-on-cd --version-file-strategy=recursive --shell zsh)" && ${command}`;
}

/**
 * Wraps a command with fnm env setup and an explicit `fnm use` call.
 * POSIX-compatible (no shell hooks) — safe to use with execa's default /bin/sh.
 * The caller is responsible for ensuring the shell's CWD is the repo directory
 * so fnm can find the .nvmrc / .node-version file.
 */
export function wrapWithFnmUse(command: string): string {
	// fnm install ensures the version in .node-version/.nvmrc is available before fnm use
	return `eval "$(fnm env --version-file-strategy=recursive --shell bash)" && fnm install --log-level=quiet && fnm use --silent-if-unchanged && ${command}`;
}

/**
 * Creates a shell command that changes to a directory and runs a command with fnm
 * @param directory - The directory to change to
 * @param command - The command to execute
 * @returns A complete shell command with fnm environment setup
 */
export function runInDirectoryWithFnm(
	directory: string,
	command: string,
): string {
	return `zsh -c '${runWithFnm(`cd ${directory} && ${command}`)}'`;
}

// Could use at some point, if we don't want to have to put things like `bun run` in each config..?
// export async function getNodeBinRunner(binName: string): Promise<string> {
// 	if (await isRunnerAvailable("npx")) {
// 		return `npx ${binName}`;
// 	}

// 	if (await isRunnerAvailable("bunx")) {
// 		return `bunx ${binName}`;
// 	}

// 	// Fallback to npx if neither is detected
// 	return `npx ${binName}`;

// 	async function isRunnerAvailable(cmd: string) {
// 		try {
// 			await execa(cmd, ["--version"], { stdio: "ignore" });
// 			return true;
// 		} catch {
// 			return false;
// 		}
// 	}
// }
