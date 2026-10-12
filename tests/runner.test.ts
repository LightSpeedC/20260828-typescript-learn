// 実行可能サンプルの Worker（docs/js/runner-worker.js）のテスト
// ブラウザで読者が見る出力は、手元の Node（npx tsx）の出力と同じでなければならない

import { test } from "node:test";
import assert from "node:assert/strict";
import { inspect } from "node:util";
import { loadCore } from "./runner-core.ts";

function runCode(code: string): { lines: string[]; errors: number[] } {
	const { core, ts, libs } = loadCore();
	const r = core.compile(ts, libs, code);
	const lines: string[] = [];
	core.run(r.js, (l) => lines.push(l));
	// vm の中で作った配列は、外の配列と比べると別物になる。外の配列に移す
	return { lines, errors: Array.from(r.errors, (e) => e.code) };
}

test("型エラーを番号と行で返す", () => {
	const { core, ts, libs } = loadCore();
	const r = core.compile(ts, libs, 'function greet(n: string) { return n; }\n\ngreet(1);\n');
	assert.equal(r.errors.length, 1);
	assert.equal(r.errors[0].code, 2345);
	assert.equal(r.errors[0].line, 3);
});

test("console.log の出力を 1 行ずつ返す（07 章の args.ts）", () => {
	const r = runCode(`function greet(name: string, title = "様"): string {
	return \`\${title} \${name}\`;
}
console.log(greet("田中"));
console.log("a", 1, true);
`);
	assert.deepEqual(r.errors, []);
	assert.deepEqual(r.lines, ["様 田中", "a 1 true"]);
});

test("ES2022 までの標準ライブラリが型検査に入っている", () => {
	// lib を読めていないと Array.prototype.at などが TS2550 になる
	const r = runCode("console.log([1, 2, 3].at(-1), Object.hasOwn({ a: 1 }, 'a'));");
	assert.deepEqual(r.errors, []);
	assert.deepEqual(r.lines, ["3 true"]);
});

test("export を含むコードも実行できる", () => {
	const r = runCode("export const x = 1;\nconsole.log(x);");
	assert.deepEqual(r.lines, ["1"]);
});

test("inspect は Node の util.inspect と同じ文字列を返す", () => {
	class User {
		name: string;
		constructor(name: string) {
			this.name = name;
		}
	}
	const values: unknown[] = [
		[10, 20, 30],
		["0:a", "1:b"],
		[],
		{},
		{ name: "Alice", age: 30 },
		{ "a-b": 1, ok: [1, { x: "y" }] },
		{ a: { b: { c: { d: 1 } } } },
		new Map([["a", 1]]),
		new Set(["x", "y"]),
		new User("Bob"),
		null,
		undefined,
		-0,
		10n,
		"it's",
		function named() {},
		() => 1,
		{ long: "x".repeat(40), other: "y".repeat(40) },
	];
	const { core } = loadCore();
	for (const v of values) {
		// 文字列は入れ子のときの形（引用符つき）を比べる
		assert.equal(core.inspect([v]), inspect([v]), inspect(v));
	}
});
