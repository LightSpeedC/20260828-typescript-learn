function parseJson(text: string): unknown {
	return JSON.parse(text);
}

type User = { name: string; age: number };

function isUser(v: unknown): v is User {
	return (
		typeof v === "object" && v !== null &&
		typeof (v as Record<string, unknown>).name === "string" &&
		typeof (v as Record<string, unknown>).age === "number"
	);
}

const data = parseJson('{"name":"Alice","age":30}');

if (isUser(data)) {
	console.log(`${data.name} は ${data.age} 歳`);
} else {
	console.log("User の形ではありません");
}

console.log(isUser(parseJson('{"name":"Bob"}')));