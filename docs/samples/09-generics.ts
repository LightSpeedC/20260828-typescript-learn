function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
	return obj[key];
}

function groupBy<T, K extends string>(items: T[], toKey: (item: T) => K): Record<K, T[]> {
	const out = {} as Record<K, T[]>;
	for (const item of items) {
		const k = toKey(item);
		(out[k] ??= []).push(item);
	}
	return out;
}

const user = { name: "Alice", age: 30 };
console.log(getProp(user, "name"));

const words = ["apple", "avocado", "banana"];
console.log(groupBy(words, (w) => w[0]));