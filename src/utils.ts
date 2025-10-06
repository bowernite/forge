import prompts from "prompts";

export async function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
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
