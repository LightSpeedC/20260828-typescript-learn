type Shape =
	| { kind: "circle"; radius: number }
	| { kind: "rect"; width: number; height: number };

function area(s: Shape): number {
	switch (s.kind) {
		case "circle": return Math.PI * s.radius ** 2;
		case "rect":   return s.width * s.height;
	}
}

console.log(area({ kind: "circle", radius: 2 }).toFixed(2));
console.log(area({ kind: "rect", width: 3, height: 4 }));