// 資料の実行可能サンプル（<pre data-run>）の注記を照合する（p261009-01）
//
// 注記の書き方:
//   出力を起こす行の末尾に「// => 出力」。1 行で複数の出力が出るときは、続く行に「// => 出力」を重ねる
//   型エラーを見せるコードは、コメントに「error TSxxxx」（または「エラー TSxxxx」）と番号を書く
//
// 照合するもの:
//   1. 型エラーの番号が、コメントに書いた番号と一致する（ブラウザと同じ変換器で検査する）
//   2. ブラウザの Worker が出す出力が、注記と一致する
//   3. 本物の Node が出す出力も、注記と一致する（Worker の整形が Node からずれていないか）
//   4. 直後に「$ npx tsx」の実行結果を貼ってあれば、それも注記と一致する

import { test } from "node:test";
import assert from "node:assert/strict";
import { format } from "node:util";
import { annotations, expectedErrors, readBlocks } from "./doc-blocks.ts";
import { loadCore } from "./runner-core.ts";

const blocks = readBlocks().filter((b) => b.run);

test("data-run を付けたコード例がある", () => {
	assert.ok(blocks.length > 0);
});

for (const b of blocks) {
	test(`${b.doc} の ${b.index} 本目（${b.line} 行目）は注記どおりに動く`, () => {
		const { core, ts, libs } = loadCore();
		const r = core.compile(ts, libs, b.code);
		const errors = Array.from(r.errors, (e) => e.code).sort((x, y) => x - y);
		assert.deepEqual(errors, expectedErrors(b.code), "型エラーの番号");

		const expected = annotations(b.code);
		assert.ok(expected.length > 0, "注記（// => …）が無い");

		const browser: string[] = [];
		core.run(r.js, (l) => browser.push(l));
		assert.deepEqual(Array.from(browser), expected, "Worker の出力");

		const node: string[] = [];
		const log = (...a: unknown[]) => node.push(format(...a));
		new Function("exports", "console", r.js)({}, { log, info: log, warn: log, error: log });
		assert.deepEqual(node, expected, "Node の出力");

		if (b.result) assert.deepEqual(b.result, expected, "貼ってある実行結果");
	});
}
