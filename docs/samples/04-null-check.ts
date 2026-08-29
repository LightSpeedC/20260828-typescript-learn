type User = { name: string; age?: number };

function describe(u: User): string {
	return `${u.name} (${u.age ?? "年齢不明"})`;
}

console.log(describe({ name: "Alice", age: 30 }));
console.log(describe({ name: "Bob" }));