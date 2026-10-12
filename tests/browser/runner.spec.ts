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
test.beforeAll(async () => {
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
