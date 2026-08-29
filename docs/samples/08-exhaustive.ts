type Event =
	| { type: "click"; x: number; y: number }
	| { type: "key"; code: string }
	| { type: "close" };

function describe(e: Event): string {
	switch (e.type) {
		case "click": return `クリック (${e.x}, ${e.y})`;
		case "key":   return `キー ${e.code}`;
		case "close": return "閉じる";
		default: {
			const _exhaustive: never = e;
			throw new Error(`未対応のイベント: ${JSON.stringify(_exhaustive)}`);
		}
	}
}

console.log(describe({ type: "click", x: 10, y: 20 }));
console.log(describe({ type: "key", code: "Enter" }));
console.log(describe({ type: "close" }));