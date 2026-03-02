import {
	createWriteStream,
	mkdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import type { WriteStream } from "node:fs";
import { stripVTControlCharacters } from "node:util";

const LOGS_DIR = "logs";
const MAX_LOG_LINES = 8000;

export interface ServiceLogStream {
	write(data: Buffer | string): void;
	end(): void;
	logPath: string;
}

/**
 * Creates a log stream for a service that writes ANSI-stripped output
 * to `<serviceDirectory>/logs/<name>.log`.
 *
 * On creation, trims the existing log file to the last MAX_LOG_LINES lines.
 */
export function createServiceLogStream(
	serviceDirectory: string,
	name: string,
): ServiceLogStream {
	const logsDir = path.join(serviceDirectory, LOGS_DIR);
	mkdirSync(logsDir, { recursive: true });

	const logPath = path.join(logsDir, `${name}.log`);
	trimLogFile(logPath);

	const fileStream = createWriteStream(logPath, { flags: "a" });
	writeSessionHeader(fileStream);

	return {
		write(data: Buffer | string) {
			const text = typeof data === "string" ? data : data.toString();
			fileStream.write(stripVTControlCharacters(text));
		},
		end() {
			fileStream.end();
		},
		logPath,
	};
}

function writeSessionHeader(stream: WriteStream): void {
	const divider = "=".repeat(60);
	stream.write(`\n${divider}\n`);
	stream.write(`Session started: ${new Date().toISOString()}\n`);
	stream.write(`${divider}\n\n`);
}

/**
 * Trims a log file to the last MAX_LOG_LINES lines, preserving recent output.
 */
function trimLogFile(logPath: string): void {
	try {
		const stat = statSync(logPath);
		if (!stat.isFile()) return;
	} catch {
		return; // File doesn't exist yet
	}

	const content = readFileSync(logPath, "utf-8");
	const lines = content.split("\n");
	if (lines.length <= MAX_LOG_LINES) return;

	const trimmed = lines.slice(-MAX_LOG_LINES).join("\n");
	writeFileSync(logPath, trimmed);
}
