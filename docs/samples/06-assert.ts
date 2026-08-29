function findUser(id: string): { name: string } | undefined {
	const db: Record<string, { name: string }> = { "1": { name: "Alice" } };
	return db[id];
}

function getUserOrThrow(id: string): { name: string } {
	const user = findUser(id);
	if (!user) {
		throw new Error(`ユーザーが見つかりません: ${id}`);
	}
	return user;
}

console.log(getUserOrThrow("1").name);

try {
	getUserOrThrow("999");
} catch (e) {
	console.log((e as Error).message);
}