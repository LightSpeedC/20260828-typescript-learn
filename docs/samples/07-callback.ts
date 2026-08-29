type Mapper<T, U> = (item: T, index: number) => U;

function mapAll<T, U>(items: T[], fn: Mapper<T, U>): U[] {
	const out: U[] = [];
	for (let i = 0; i < items.length; i++) {
		out.push(fn(items[i], i));
	}
	return out;
}

console.log(mapAll([1, 2, 3], (n) => n * 10));
console.log(mapAll(["a", "b"], (s, i) => `${i}:${s}`));