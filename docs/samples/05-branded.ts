type UserId = string & { readonly __brand: "UserId" };

function toUserId(s: string): UserId {
	if (!s.startsWith("user-")) {
		throw new Error(`UserId の形式が不正です: ${s}`);
	}
	return s as UserId;
}

const id = toUserId("user-001");
console.log(id);

try {
	toUserId("order-123");
} catch (e) {
	console.log((e as Error).message);
}