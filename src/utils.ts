import { homedir } from "node:os";
import prompts from "prompts";

export async function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Expands a path string with environment variables and ~ to the home directory
 * @param pathString - The path string to expand
 * @returns The expanded path string
 */
export function expandPath(pathString: string): string {
	let expanded = pathString;
	
	expanded = expanded.replace(/\$(\w+)/g, (_, varName) => {
		return process.env[varName] || `$${varName}`;
	});
	
	if (expanded.startsWith("~/")) {
		expanded = expanded.replace("~", homedir());
	}
	
	return expanded;
}

export async function promptYesNo(message: string): Promise<boolean> {
	const response = await prompts({
		type: "confirm",
		name: "value",
		message,
		initial: false,
	});

	// Handle user cancellation (Ctrl+C) - prompts returns undefined when cancelled
	if (response.value === undefined) {
		process.exit(130);
	}

	return response.value;
}
