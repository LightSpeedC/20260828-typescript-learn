function greet(name: string, title = "様"): string {
	return `${title} ${name}`;
}

function join(sep: string, ...parts: string[]): string {
	return parts.join(sep);
}

console.log(greet("田中"));
console.log(greet("Alice", "Ms."));
console.log(join(" / ", "a", "b", "c"));