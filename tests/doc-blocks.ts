// 資料（docs/*.html）からコード例を取り出す
// 注記の照合テスト（tests/samples-run.test.ts）と、候補の洗い出し（tools/40_test/list-runnable.ts）が使う

import fs from "node:fs";
import path from "node:path";
import { decode } from "../tools/40_test/verify-versions.ts";
import { root } from "./runner-core.ts";

// result は直後に貼ってある「$ npx tsx …」の実行結果（無ければ undefined）
export type Block = { doc: string; index: number; line: number; run: boolean; code: string; result?: string[] };

const RESULT_RE = /^\s*<pre><code class="language-shell">\$ npx tsx [^\n]*\n([\s\S]*?)<\/code><\/pre>/;

export function readBlocks(): Block[] {
	const blocks: Block[] = [];
	const docs = fs.readdirSync(path.join(root, "docs")).filter((f) => f.endsWith(".html")).sort();
	for (const doc of docs) {
		const html = fs.readFileSync(path.join(root, "docs", doc), "utf8");
		const re = /<pre( data-run)?><code class="language-typescript">([\s\S]*?)<\/code><\/pre>/g;
		let m: RegExpExecArray | null;
		let index = 0;
		while ((m = re.exec(html))) {
			index++;
			const line = html.slice(0, m.index).split("\n").length;
			const r = RESULT_RE.exec(html.slice(m.index + m[0].length));
			const result = r ? decode(r[1]).split("\n") : undefined;
			blocks.push({ doc: doc.replace(/\.html$/, ""), index, line, run: !!m[1], code: decode(m[2]), result });
		}
	}
	return blocks;
}

// console.log の行末の「// => 値」を、書いた順に返す
export function annotations(code: string): string[] {
	const out: string[] = [];
	for (const l of code.split("\n")) {
		const m = /\/\/ => (.*)$/.exec(l);
		if (m) out.push(m[1]);
	}
	return out;
}

// コメントに書いた「error TSxxxx」の番号を返す。型エラーを見せるコードはこれで照合する
export function expectedErrors(code: string): number[] {
	const out: number[] = [];
	for (const m of code.matchAll(/(?:error|エラー) TS(\d+)/g)) out.push(Number(m[1]));
	return out.sort((a, b) => a - b);
}
