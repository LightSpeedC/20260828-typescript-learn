// 資料のコード例を複数の TypeScript で型検査し、結果を突き合わせる
//
// 使い方:
//   node tools/40_test/verify-versions.ts --out <作業フォルダ> --tsc "<名前>=<コマンド>" --tsc "<名前>=<コマンド>"
//   例: --tsc "7.0.2=npx --prefix docs/samples tsc" --tsc "6.0.3=node tmp/ts603/package/bin/tsc"
//
// docs/*.html の <code class="language-typescript"> を 1 本 1 ファイルに取り出し、
// 各ファイルを独立したモジュールにして（export {} を足す）名前の衝突を避ける。
// 断片のコードは未定義名のエラーが出るが、両方の版で同じなら差にはならない。
// 比べるのは「ファイル・行・エラー番号・文言」の組。版の差だけを報告する。

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

function parseArgs(argv: string[]): { out: string; tscs: { name: string; cmd: string }[] } {
	let out = "";
	const tscs: { name: string; cmd: string }[] = [];
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--out") out = argv[++i] ?? "";
		else if (argv[i] === "--tsc") {
			const v = argv[++i] ?? "";
			const eq = v.indexOf("=");
			if (eq < 1) throw new Error(`--tsc は "名前=コマンド" の形で渡す: ${v}`);
			tscs.push({ name: v.slice(0, eq), cmd: v.slice(eq + 1) });
		}
	}
	if (!out) throw new Error("--out を渡す");
	if (tscs.length < 1) throw new Error("--tsc を 1 つ以上渡す");
	return { out: path.resolve(root, out), tscs };
}

function decode(s: string): string {
	// &amp; は最後に戻す。先に戻すと &amp;lt; が < になる
	return s
		.replace(/<[^>]+>/g, "")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&");
}

function extract(outDir: string): number {
	const blocks = path.join(outDir, "blocks");
	fs.rmSync(blocks, { recursive: true, force: true });
	fs.mkdirSync(blocks, { recursive: true });
	let count = 0;
	const docs = fs.readdirSync(path.join(root, "docs")).filter((f) => f.endsWith(".html")).sort();
	for (const doc of docs) {
		const html = fs.readFileSync(path.join(root, "docs", doc), "utf8");
		const re = /<code class="language-typescript">([\s\S]*?)<\/code>/g;
		let m: RegExpExecArray | null;
		let n = 0;
		while ((m = re.exec(html))) {
			n++;
			count++;
			const id = doc.slice(0, 2);
			const file = path.join(blocks, `${id}-${String(n).padStart(2, "0")}.ts`);
			fs.writeFileSync(file, decode(m[1]) + "\nexport {};\n");
		}
	}
	const typeRoots = path.join(root, "docs/samples/node_modules/@types").replaceAll("\\", "/");
	const tsconfig = {
		compilerOptions: {
			target: "es2022",
			module: "nodenext",
			moduleResolution: "nodenext",
			strict: true,
			noEmit: true,
			types: ["node"],
			typeRoots: [typeRoots],
		},
		include: ["*.ts"],
	};
	fs.writeFileSync(path.join(blocks, "tsconfig.json"), JSON.stringify(tsconfig, null, "\t"));
	return count;
}

function check(outDir: string, name: string, cmd: string): string[] {
	const project = path.join(outDir, "blocks");
	let text = "";
	try {
		text = execSync(`${cmd} -p "${project}" --pretty false`, { cwd: root, encoding: "utf8", timeout: 600_000 });
	} catch (e) {
		// 型エラーがあると終了コードが 0 でなくなる。出力は残っている
		const err = e as { stdout?: string; status?: number };
		if (typeof err.stdout !== "string") throw e;
		text = err.stdout;
	}
	const lines = text.split(/\r?\n/).filter((l) => /error TS\d+/.test(l));
	// 先頭のパスを、作業フォルダからの相対に揃える
	const norm = lines.map((l) => l.replace(/^.*[\\/]blocks[\\/]/, "")).sort();
	fs.writeFileSync(path.join(outDir, `result-${name}.txt`), norm.join("\n") + "\n");
	return norm;
}

const { out, tscs } = parseArgs(process.argv.slice(2));
const count = extract(out);
console.log(`取り出したコード例: ${count} 本`);

const results = tscs.map((t) => {
	const r = check(out, t.name, t.cmd);
	const files = new Set(r.map((l) => l.split("(")[0])).size;
	console.log(`${t.name}: エラー ${r.length} 件（${files} ファイル）`);
	return { name: t.name, lines: r };
});

let diff = 0;
const base = results[0];
for (const other of results.slice(1)) {
	const a = new Set(base.lines);
	const b = new Set(other.lines);
	const onlyA = base.lines.filter((l) => !b.has(l));
	const onlyB = other.lines.filter((l) => !a.has(l));
	diff += onlyA.length + onlyB.length;
	for (const l of onlyA) console.log(`  ${base.name} だけ: ${l}`);
	for (const l of onlyB) console.log(`  ${other.name} だけ: ${l}`);
}
console.log(diff === 0 ? "版の差: なし" : `版の差: ${diff} 件`);
process.exitCode = diff === 0 ? 0 : 1;
