import { readFileSync } from "node:fs";

type Sale = { date: string; product: string; amount: number; qty: number };

type Result<T, E = Error> =
	| { ok: true; value: T }
	| { ok: false; error: E };

function isSale(v: unknown): v is Sale {
	if (typeof v !== "object" || v === null) return false;
	const o = v as Record<string, unknown>;
	return (
		typeof o.date === "string" &&
		typeof o.product === "string" &&
		typeof o.amount === "number" &&
		typeof o.qty === "number"
	);
}

function loadSales(path: string): Result<Sale[]> {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch {
		return { ok: false, error: new Error(`ファイルを読めません: ${path}`) };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, error: new Error(`JSON として読めません: ${path}`) };
	}

	if (!Array.isArray(parsed)) {
		return { ok: false, error: new Error("配列ではありません") };
	}

	const sales: Sale[] = [];
	for (let i = 0; i < parsed.length; i++) {
		const row: unknown = parsed[i];
		if (!isSale(row)) {
			return { ok: false, error: new Error(`${i} 件目の形式が不正です`) };
		}
		sales.push(row);
	}
	return { ok: true, value: sales };
}

function sumByProduct(sales: Sale[]): Map<string, number> {
	const out = new Map<string, number>();
	for (const s of sales) {
		out.set(s.product, (out.get(s.product) ?? 0) + s.amount);
	}
	return out;
}

const r = loadSales("sales.json");
if (!r.ok) {
	console.error(`エラー: ${r.error.message}`);
	process.exit(1);
}

for (const [product, total] of [...sumByProduct(r.value)].sort((a, b) => b[1] - a[1])) {
	console.log(`${product}: ${total} 円`);
}

const missing = loadSales("nothing.json");
console.log(missing.ok ? "読めた" : `想定どおり失敗: ${missing.error.message}`);