// docs/js/runner-worker.js をブラウザと同じ形で読み込む
// Worker の中では typescript.js と runner-worker.js が同じ大域で動く。vm で同じ状況を作る

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const root = path.resolve(import.meta.dirname, "..");

export type Diagnostic = { code: number; line: number; message: string };
export type Core = {
	compile(ts: unknown, libs: Record<string, string>, code: string): { js: string; errors: Diagnostic[] };
	run(js: string, log: (line: string) => void): void;
	inspect(value: unknown): string;
};

let cache: { core: Core; ts: unknown; libs: Record<string, string> } | undefined;

export function loadCore(): { core: Core; ts: unknown; libs: Record<string, string> } {
	if (cache) return cache;
	const ctx = vm.createContext({});
	// typescript.js は module が無ければ大域の ts に入る
	vm.runInContext(fs.readFileSync(path.join(root, "docs/js/lib/typescript.js"), "utf8"), ctx);
	vm.runInContext(fs.readFileSync(path.join(root, "docs/js/runner-worker.js"), "utf8"), ctx);
	const json = JSON.parse(fs.readFileSync(path.join(root, "docs/js/lib/ts-libs.json"), "utf8")) as { libs: Record<string, string> };
	cache = { core: ctx.RunnerCore as Core, ts: ctx.ts, libs: json.libs };
	return cache;
}
