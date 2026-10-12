// 実行可能サンプルの Worker（p261009-01）
//
// 2 つの役目を、受け取ったメッセージの type で分ける
//   compile  型検査と変換。変換器の読込が重いので、ページごとに 1 つを使い回す
//   run      変換した JS の実行。時間切れで止められるよう、実行のたびに作り直す
//
// Node のテスト（tests/runner.test.ts）も、このファイルを vm で読み込んで RunnerCore を使う
"use strict";

var RunnerCore = (function () {
	// console の型は lib.dom.d.ts を読まずに、この宣言で足りる
	var CONSOLE_DECL = "declare var console: { log(...a: any[]): void; error(...a: any[]): void; warn(...a: any[]): void; info(...a: any[]): void; };";
	var DEFAULT_LIB = "lib.es2022.d.ts";
	var libCache = {};

	function baseName(name) {
		return name.replace(/^.*[\\/]/, "");
	}

	function compile(ts, libs, code) {
		var options = {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.CommonJS,
			strict: true,
			types: [],
			lib: [DEFAULT_LIB],
		};
		var files = { "main.ts": code, "console.d.ts": CONSOLE_DECL };
		var js = "";
		function text(name) {
			if (Object.prototype.hasOwnProperty.call(files, name)) return files[name];
			var b = baseName(name);
			return Object.prototype.hasOwnProperty.call(libs, b) ? libs[b] : undefined;
		}
		var host = {
			getSourceFile: function (name, lang) {
				if (Object.prototype.hasOwnProperty.call(files, name)) return ts.createSourceFile(name, files[name], lang);
				var b = baseName(name);
				if (!Object.prototype.hasOwnProperty.call(libs, b)) return undefined;
				// lib は毎回同じなので、解析した結果を使い回す
				if (!libCache[b]) libCache[b] = ts.createSourceFile(b, libs[b], lang);
				return libCache[b];
			},
			getDefaultLibFileName: function () { return DEFAULT_LIB; },
			getDefaultLibLocation: function () { return ""; },
			writeFile: function (name, data) { if (/\.js$/.test(name)) js = data; },
			getCurrentDirectory: function () { return ""; },
			getDirectories: function () { return []; },
			fileExists: function (name) { return text(name) !== undefined; },
			readFile: function (name) { return text(name); },
			getCanonicalFileName: function (name) { return name; },
			useCaseSensitiveFileNames: function () { return true; },
			getNewLine: function () { return "\n"; },
		};
		var program = ts.createProgram(["main.ts", "console.d.ts"], options, host);
		var errors = ts.getPreEmitDiagnostics(program)
			.filter(function (d) { return !d.file || d.file.fileName === "main.ts"; })
			.map(function (d) {
				var line = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0;
				return { code: d.code, line: line, message: ts.flattenDiagnosticMessageText(d.messageText, "\n") };
			});
		program.emit();
		return { js: js, errors: errors };
	}

	// ---- 出力の整形。Node の util.inspect に合わせる ----

	var BREAK_LENGTH = 80;
	var MAX_DEPTH = 2;

	function quote(s) {
		var q = s.indexOf("'") < 0 ? "'" : s.indexOf('"') < 0 ? '"' : s.indexOf("`") < 0 ? "`" : "'";
		var body = s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
		if (q === "'") body = body.replace(/'/g, "\\'");
		return q + body + q;
	}

	function keyText(k) {
		return /^[A-Za-z_$][\w$]*$/.test(k) ? k : quote(k);
	}

	function join(start, entries, end, indent) {
		if (entries.length === 0) return start + end;
		var total = entries.length + start.length + indent + 10;
		var multi = false;
		for (var i = 0; i < entries.length; i++) {
			total += entries[i].length + 1;
			if (entries[i].indexOf("\n") >= 0) multi = true;
		}
		if (!multi && total <= BREAK_LENGTH) return start + " " + entries.join(", ") + " " + end;
		var pad = new Array(indent + 3).join(" ");
		var back = new Array(indent + 1).join(" ");
		return start + "\n" + pad + entries.join(",\n" + pad) + "\n" + back + end;
	}

	// 型の判定は instanceof を使わない。テストが vm の外で作った値を渡すため
	function tag(v) {
		return Object.prototype.toString.call(v);
	}

	function isPlain(proto) {
		return Object.getPrototypeOf(proto) === null && !!proto.constructor && proto.constructor.name === "Object";
	}

	function fmt(v, depth, indent) {
		var t = typeof v;
		if (v === null) return "null";
		if (t === "undefined") return "undefined";
		if (t === "string") return quote(v);
		if (t === "number") return Object.is(v, -0) ? "-0" : String(v);
		if (t === "bigint") return String(v) + "n";
		if (t === "boolean") return String(v);
		if (t === "symbol") return v.toString();
		if (t === "function") {
			var src = Function.prototype.toString.call(v);
			if (/^class\b/.test(src)) return "[class " + (v.name || "(anonymous)") + "]";
			return v.name ? "[Function: " + v.name + "]" : "[Function (anonymous)]";
		}
		if (Array.isArray(v)) {
			if (depth > MAX_DEPTH) return "[Array]";
			return join("[", v.map(function (x) { return fmt(x, depth + 1, indent + 2); }), "]", indent);
		}
		if (tag(v) === "[object Map]") {
			if (depth > MAX_DEPTH) return "[Map]";
			var me = [];
			v.forEach(function (val, key) { me.push(fmt(key, depth + 1, indent + 2) + " => " + fmt(val, depth + 1, indent + 2)); });
			return join("Map(" + v.size + ") {", me, "}", indent);
		}
		if (tag(v) === "[object Set]") {
			if (depth > MAX_DEPTH) return "[Set]";
			var se = [];
			v.forEach(function (val) { se.push(fmt(val, depth + 1, indent + 2)); });
			return join("Set(" + v.size + ") {", se, "}", indent);
		}
		if (tag(v) === "[object Date]") return v.toISOString();
		if (tag(v) === "[object Error]") return v.stack || String(v);
		var proto = Object.getPrototypeOf(v);
		var name = proto === null ? "[Object: null prototype]" : isPlain(proto) ? "" : (proto.constructor && proto.constructor.name) || "";
		if (depth > MAX_DEPTH) return "[" + (name || "Object") + "]";
		var oe = Object.keys(v).map(function (k) { return keyText(k) + ": " + fmt(v[k], depth + 1, indent + 2); });
		var start = name ? name + " {" : "{";
		if (oe.length === 0) return start + "}";
		return join(start, oe, "}", indent);
	}

	function inspect(v) {
		return fmt(v, 0, 0);
	}

	function format(args) {
		return Array.prototype.map.call(args, function (a) { return typeof a === "string" ? a : inspect(a); }).join(" ");
	}

	function run(js, log) {
		var out = function () { log(format(arguments)); };
		var con = { log: out, info: out, warn: out, error: out };
		var exports = {};
		new Function("exports", "console", js)(exports, con);
	}

	return { compile: compile, run: run, inspect: inspect, format: format };
})();

// ---- Worker として動くときだけ、メッセージを受ける ----

if (typeof self !== "undefined" && typeof importScripts === "function") {
	var tsLibs = null;

	self.onmessage = function (e) {
		var msg = e.data;
		if (msg.type === "compile") {
			try {
				if (!tsLibs) {
					var t0 = Date.now();
					importScripts("lib/typescript.js");
					var xhr = new XMLHttpRequest();
					xhr.open("GET", "lib/ts-libs.json", false);
					xhr.send();
					tsLibs = JSON.parse(xhr.responseText).libs;
					self.postMessage({ type: "loaded", ms: Date.now() - t0, version: self.ts.version });
				}
				var t1 = Date.now();
				var r = RunnerCore.compile(self.ts, tsLibs, msg.code);
				self.postMessage({ type: "compiled", js: r.js, errors: r.errors, ms: Date.now() - t1 });
			} catch (err) {
				self.postMessage({ type: "failed", message: String(err && err.message || err) });
			}
		} else if (msg.type === "run") {
			try {
				RunnerCore.run(msg.js, function (line) { self.postMessage({ type: "log", line: line }); });
				self.postMessage({ type: "done" });
			} catch (err) {
				self.postMessage({ type: "thrown", message: String(err && err.stack || err) });
			}
		}
	};
}
