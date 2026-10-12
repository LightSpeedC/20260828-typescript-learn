// 実行可能サンプル（p261009-01）の候補を洗い出す
//
// 使い方: node tools/40_test/list-runnable.ts
//
// console.log を含む typescript のコード例を、ブラウザと同じ変換器で型検査・実行し、
// 型エラーの番号・出力・例外を表示する。data-run を付けるかの判断材料にする

import { format } from "node:util";
import { readBlocks } from "../../tests/doc-blocks.ts";
import { loadCore } from "../../tests/runner-core.ts";

const { core, ts, libs } = loadCore();
for (const b of readBlocks()) {
	if (!/console\.log/.test(b.code)) continue;
	const r = core.compile(ts, libs, b.code);
	const lines: string[] = [];
	let thrown = "";
	if (!/^\s*import |require\(|process\.|document\.|await /m.test(b.code)) {
		try {
			// 本物の Node の出力。ブラウザ側の整形と比べるため
			const con = { log: (...a: unknown[]) => lines.push(format(...a)) };
			new Function("exports", "console", r.js)({}, { ...con, error: con.log, warn: con.log, info: con.log });
		} catch (e) {
			thrown = String(e);
		}
	} else {
		thrown = "（import・await 等を含むので実行しない）";
	}
	const errs = Array.from(r.errors, (e) => `TS${e.code}@${e.line}`).join(" ");
	console.log(`${b.run ? "[run] " : ""}${b.doc} #${b.index} (L${b.line}) errors=[${errs}] ${thrown}`);
	for (const l of lines) console.log(`    | ${l}`);
}
