// tools/40_test/verify-versions.ts の判定部分のテスト
// 版の差を見落とすと、資料の文言が古いまま残る。判定そのものを押さえる

import { test } from "node:test";
import assert from "node:assert/strict";
import { compare, decode, normalize, parseArgs } from "../tools/40_test/verify-versions.ts";

test("decode は &amp;lt; を &lt; のまま残す（&amp; を最後に戻す）", () => {
	// 資料のコード例に「&lt;」という文字列そのものを書いた場合に、< へ化けさせない
	assert.equal(decode("a &amp;lt; b"), "a &lt; b");
});

test("decode は実体参照を戻し、ハイライトのタグを外す", () => {
	assert.equal(decode('<span class="k">let</span> x: Array&lt;"a"&gt; = [];'), 'let x: Array<"a"> = [];');
	assert.equal(decode("&#39;s&#39; &amp;&amp; t"), "'s' && t");
});

test("parseArgs は --tsc を名前とコマンドに分ける（コマンド中の = は残す）", () => {
	const r = parseArgs(["--out", "tmp/v", "--tsc", "7=node a.js --x=1"]);
	assert.deepEqual(r.tscs, [{ name: "7", cmd: "node a.js --x=1" }]);
});

test("parseArgs は --out か --tsc が無ければ止まる", () => {
	assert.throws(() => parseArgs(["--tsc", "7=tsc"]), /--out/);
	assert.throws(() => parseArgs(["--out", "tmp/v"]), /--tsc/);
	assert.throws(() => parseArgs(["--out", "tmp/v", "--tsc", "=tsc"]), /名前=コマンド/);
});

test("normalize は作業フォルダの位置を消し、並べ替える", () => {
	// 置き場が違う 2 つの tsc の出力を、同じ行として比べるため
	const r = normalize([
		"C:/w/tmp/blocks/09-02.ts(3,1): error TS2345: x",
		"tmp\\blocks\\01-01.ts(1,1): error TS2304: y",
		"Found 2 errors.",
	]);
	assert.deepEqual(r, ["01-01.ts(1,1): error TS2304: y", "09-02.ts(3,1): error TS2345: x"]);
});

test("compare は片方にだけある行を数える。同じなら 0", () => {
	assert.equal(compare(["a", "b"], ["b", "a"]).count, 0);
	const r = compare(["a", "b"], ["b", "c"]);
	assert.deepEqual(r.onlyA, ["a"]);
	assert.deepEqual(r.onlyB, ["c"]);
	assert.equal(r.count, 2);
});
