// 実行可能サンプル（p261009-01）の変換器を docs/js/lib/ に置く
//
// 使い方:
//   npm pack typescript@<版> を展開したフォルダを渡す
//   node tools/20_build/build-runner-lib.ts --from <展開した package フォルダ>
//
// 置くもの:
//   typescript.js    変換器の本体（lib/typescript.js をそのまま写す）
//   ts-libs.json     型検査に要る lib.es*.d.ts と lib.decorators*.d.ts を 1 本にまとめたもの
//   LICENSE.txt      TypeScript のライセンス文
//   ThirdPartyNoticeText.txt

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const outDir = path.join(root, "docs/js/lib");

function main(): void {
	const i = process.argv.indexOf("--from");
	const from = i > 0 ? process.argv[i + 1] : "";
	if (!from) throw new Error("--from <展開した package フォルダ> を渡す");
	const pkgDir = path.resolve(from);
	const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")) as { version: string };

	fs.mkdirSync(outDir, { recursive: true });
	for (const f of ["LICENSE.txt", "ThirdPartyNoticeText.txt"]) {
		fs.copyFileSync(path.join(pkgDir, f), path.join(outDir, f));
	}
	fs.copyFileSync(path.join(pkgDir, "lib/typescript.js"), path.join(outDir, "typescript.js"));

	const libs: Record<string, string> = {};
	const names = fs
		.readdirSync(path.join(pkgDir, "lib"))
		.filter((f) => /^lib\.(es|decorators).*\.d\.ts$/.test(f))
		.sort();
	for (const f of names) libs[f] = fs.readFileSync(path.join(pkgDir, "lib", f), "utf8");
	fs.writeFileSync(path.join(outDir, "ts-libs.json"), JSON.stringify({ version: pkg.version, libs }));

	console.log(`TypeScript ${pkg.version} を置きました（lib ${names.length} 本）`);
}

main();
