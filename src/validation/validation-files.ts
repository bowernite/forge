import { execa } from "execa";
import path from "node:path";
import {
	getBranchChangedFiles,
	getChangedJsTsFiles,
	getChangedTestFiles,
} from "../git-utils.js";

export interface ChangedFiles {
	repoRoot: string;
	all: string[];
	jsts: string[];
	tests: string[];
	allAbsolute: string[];
	jstsAbsolute: string[];
	testsAbsolute: string[];
}

export async function getRepoRoot(): Promise<string> {
	const { stdout } = await execa("git", ["rev-parse", "--show-toplevel"]);
	return stdout.trim();
}

export async function getChangedFilesContext(): Promise<ChangedFiles> {
	const repoRoot = await getRepoRoot();

	const all = await getBranchChangedFiles();
	const jsts = await getChangedJsTsFiles();
	const tests = await getChangedTestFiles();

	const toAbsolute = (file: string) => path.join(repoRoot, file);

	return {
		repoRoot,
		all,
		jsts,
		tests,
		allAbsolute: all.map(toAbsolute),
		jstsAbsolute: jsts.map(toAbsolute),
		testsAbsolute: tests.map(toAbsolute),
	};
}
