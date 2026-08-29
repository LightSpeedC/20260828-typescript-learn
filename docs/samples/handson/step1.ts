import { readFileSync } from "node:fs";

const text = readFileSync("sales.json", "utf8");
const sales = JSON.parse(text);

const totals: any = {};
for (const s of sales) {
	totals[s.product] = (totals[s.product] ?? 0) + s.amount;
}

console.log(totals);