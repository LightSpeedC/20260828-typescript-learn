// 実行可能サンプルをブラウザで動かし、出力が注記と一致するかを確かめる（p261009-01 の手順 6）
//
// 実行: playwright-test --test-dir tests/browser --out-dir tmp/playwright
// node --test の対象外（PlayWright 共有環境で動かす）
//
// このフォルダは CommonJS にしてある（package.json）。ES モジュールとして読まれると、
// 共有環境の @playwright/test が見つからない。そのため tests/doc-blocks.ts は使わず、取り出しをここに書く

import { test, expect } from "@playwright/test";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";

const root = path.resolve(__dirname, "../..");

const TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
};

function decode(s: string): string {
	return s
		.replace(/<[^>]+>/g, "")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&");
}

// data-run のコードから「// => 出力」の注記を、資料ごと・書いた順に集める
function readExpected(): Map<string, string[][]> {
	const out = new Map<string, string[][]>();
	const docs = fs.readdirSync(path.join(root, "docs")).filter((f) => f.endsWith(".html")).sort();
	for (const f of docs) {
		const html = fs.readFileSync(path.join(root, "docs", f), "utf8");
		const list: string[][] = [];
		for (const m of html.matchAll(/<pre data-run><code class="language-typescript">([\s\S]*?)<\/code><\/pre>/g)) {
			const notes: string[] = [];
			for (const l of decode(m[1]).split("\n")) {
				const a = /\/\/ => (.*)$/.exec(l);
				if (a) notes.push(a[1]);
			}
			list.push(notes);
		}
		if (list.length > 0) out.set(f.replace(/\.html$/, ""), list);
	}
	return out;
}

let server: http.Server;
let base = "";

// Worker は file:// では動かないので、プロジェクトを HTTP で配る
// 環境変数 RUNNER_BASE に公開 URL（末尾の / なし）を渡すと、手元のサーバを立てずにそちらを開く
test.beforeAll(async () => {
	if (process.env.RUNNER_BASE) {
		base = process.env.RUNNER_BASE;
		return;
	}
	server = http.createServer((req, res) => {
		const rel = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
		const file = path.join(root, rel);
		if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
			res.writeHead(404);
			res.end();
			return;
		}
		res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
		fs.createReadStream(file).pipe(res);
	});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
	if (!server) return;
	await new Promise<void>((r) => server.close(() => r()));
});

test("編集したコードを実行でき、型エラーと時間切れを表示する", async ({ page }) => {
	test.setTimeout(180_000);
	await page.goto(`${base}/docs/${encodeURI("07-関数の型")}.html`);
	const bar = page.locator(".runbar").first();
	const out = page.locator(".runout").first();
	await bar.getByRole("button", { name: "編集" }).click();
	const editor = page.locator("textarea.runedit").first();

	await editor.fill('function f(s: string) { return s; }\nconsole.log(f(1));');
	await bar.locator(".runbtn").first().click();
	await expect(out.locator(".runerr")).toContainText("error TS2345", { timeout: 90_000 });
	// 型エラーがあっても、変換した JS は実行する（tsc の既定と同じ）
	await expect(out.locator(".runline")).toHaveText(["1"]);

	// 無限ループでもページは固まらず、時間切れで止まる
	await editor.fill("while (true) {}");
	await bar.locator(".runbtn").first().click();
	await expect(out.locator(".runerr")).toContainText("時間切れ", { timeout: 30_000 });

	// 元に戻すと、編集欄が消えて元のコードが見える
	await bar.getByRole("button", { name: "元に戻す" }).click();
	await expect(editor).toHaveCount(0);
	await expect(page.locator("pre[data-run]").first()).toBeVisible();
});

// check-contrast はファイルを直接開くので、JS が足す部品は検査されない。ここで実測する
// 判定は共通ルールと同じ。グラデーションは色停止点の平均を背景とし、1.5:1 未満を 0 件にする
test("実行ボタンと出力欄の文字が読める配色になっている", async ({ page }) => {
	test.setTimeout(180_000);
	await page.goto(`${base}/docs/${encodeURI("07-関数の型")}.html`);
	const bar = page.locator(".runbar").first();
	await bar.getByRole("button", { name: "編集" }).click();
	await page.locator("textarea.runedit").first().fill('console.log("ok");\nconst n: number = "x";');
	await bar.locator(".runbtn").first().click();
	await expect(page.locator(".runout .runline").first()).toHaveText("ok", { timeout: 90_000 });

	const ratios = await page.evaluate(() => {
		function parse(c: string): number[] | null {
			const m = /rgba?\(([^)]+)\)/.exec(c);
			if (!m) return null;
			const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
			return v.length > 3 && v[3] === 0 ? null : v.slice(0, 3);
		}
		function background(e: Element | null): number[] {
			for (let x = e; x; x = x.parentElement) {
				const s = getComputedStyle(x);
				const stops = s.backgroundImage.match(/rgba?\([^)]+\)/g);
				if (stops) {
					const cs = stops.map((t) => parse(t)).filter((t): t is number[] => !!t);
					return [0, 1, 2].map((i) => cs.reduce((a, c) => a + c[i], 0) / cs.length);
				}
				const b = parse(s.backgroundColor);
				if (b) return b;
			}
			return [255, 255, 255];
		}
		function lum(c: number[]): number {
			const [r, g, b] = c.map((v) => {
				const s = v / 255;
				return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
			});
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		}
		const out: { sel: string; ratio: number }[] = [];
		for (const sel of [".runbtn", ".runbtn-sub", ".runedit", ".runline", ".runerr"]) {
			const e = document.querySelector(sel);
			if (!e) {
				out.push({ sel, ratio: 0 });
				continue;
			}
			const fg = parse(getComputedStyle(e).color) ?? [0, 0, 0];
			const [a, b] = [lum(fg), lum(background(e))].sort((x, y) => y - x);
			out.push({ sel, ratio: (a + 0.05) / (b + 0.05) });
		}
		return out;
	});
	for (const r of ratios) expect(r.ratio, r.sel).toBeGreaterThanOrEqual(1.5);
	console.log(ratios.map((r) => `${r.sel} ${r.ratio.toFixed(2)}`).join(" / "));
});

for (const [doc, expected] of readExpected()) {
	test(`${doc} の data-run はブラウザでも注記どおりに出力する`, async ({ page }) => {
		test.setTimeout(180_000);
		await page.goto(`${base}/docs/${encodeURI(doc)}.html`);
		await expect(page.locator("pre[data-run]")).toHaveCount(expected.length);
		for (let i = 0; i < expected.length; i++) {
			const btn = page.locator(".runbar").nth(i).locator(".runbtn").first();
			const out = page.locator(".runout").nth(i);
			const t0 = Date.now();
			await btn.click();
			await expect(btn).toBeEnabled({ timeout: 90_000 });
			expect(await out.locator(".runline").allTextContents()).toEqual(expected[i]);
			console.log(`${doc} ${i + 1} 本目: ${Date.now() - t0} ms`);
		}
	});
}
