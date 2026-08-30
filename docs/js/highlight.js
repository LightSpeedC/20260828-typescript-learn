/*
 * コードブロックの色付け
 *
 * CDN も外部ライブラリも使わない。読み込めなかった場合は色が付かないだけで、
 * コードはそのまま読める状態を保つ。
 *
 * 対応: TypeScript / JavaScript（既定）、シェル（$ で始まる行がある）、JSON。
 */
(function () {
	'use strict';

	/** HTML に書き戻すためのエスケープ。textContent で読むと実体参照が解決済みになるため必須 */
	function esc(s) {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	var KEYWORDS = [
		'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
		'switch', 'case', 'default', 'break', 'continue', 'do', 'new', 'delete',
		'type', 'interface', 'enum', 'class', 'extends', 'implements', 'namespace',
		'import', 'export', 'from', 'as', 'declare', 'satisfies', 'is', 'asserts',
		'async', 'await', 'try', 'catch', 'finally', 'throw', 'yield',
		'typeof', 'instanceof', 'in', 'of', 'keyof', 'infer',
		'readonly', 'public', 'private', 'protected', 'static', 'abstract',
		'this', 'super', 'true', 'false', 'null', 'undefined'
	];

	var TYPES = [
		'string', 'number', 'boolean', 'unknown', 'any', 'never', 'void', 'object',
		'symbol', 'bigint', 'Array', 'Promise', 'Record', 'Partial', 'Required',
		'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract', 'NonNullable', 'ReturnType',
		'Parameters', 'Awaited', 'Capitalize', 'Uppercase', 'Lowercase', 'Map', 'Set',
		'Date', 'Error', 'RegExp', 'JSON', 'Math', 'Object', 'Response'
	];

	/* 順番が意味を持つ。コメント→文字列→キーワード→型→数値 の順に判定する */
	var TS_RE = new RegExp(
		'(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)' +                          // 1 コメント
		'|(`(?:[^`\\\\]|\\\\.)*`|"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\')' + // 2 文字列
		'|\\b(' + KEYWORDS.join('|') + ')\\b' +                             // 3 キーワード
		'|\\b(' + TYPES.join('|') + ')\\b' +                                // 4 型
		'|\\b(\\d+(?:\\.\\d+)?)\\b',                                        // 5 数値
		'g'
	);

	var SH_RE = /^(\$)|(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/gm;

	var JSON_RE = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|\b(-?\d+(?:\.\d+)?)\b/g;

	/* tsc のエラー行。行頭からの「error TSxxxx:」を含む行全体を赤にする */
	var ERR_RE = /^.*\berror TS\d+:.*$/gm;

	/** class="language-xxx" があればそれに従う。無ければ中身から推定する */
	function detect(code, text) {
		var m = /language-(\w+)/.exec(code.className || '');
		if (m) {
			var lang = m[1].toLowerCase();
			if (lang === 'shell' || lang === 'bash' || lang === 'sh' || lang === 'console' || lang === 'batch') return 'sh';
			if (lang === 'json') return 'json';
			return 'ts';
		}
		if (/^\s*[$]/m.test(text)) return 'sh';
		if (/^\s*[{[]/.test(text) && /"[^"]*"\s*:/.test(text)) return 'json';
		return 'ts';
	}

	function wrap(cls, s) {
		return '<span class="' + cls + '">' + esc(s) + '</span>';
	}

	/** 正規表現でトークンに切り、種類ごとに span で包む */
	function tokenize(text, re, classOf) {
		var out = '';
		var last = 0;
		var m;
		re.lastIndex = 0;
		while ((m = re.exec(text)) !== null) {
			if (m.index < last) continue;
			out += esc(text.slice(last, m.index));
			var cls = classOf(m);
			out += cls ? wrap(cls, m[0]) : esc(m[0]);
			last = m.index + m[0].length;
			if (m[0].length === 0) re.lastIndex++;
		}
		out += esc(text.slice(last));
		return out;
	}

	function highlightTs(text) {
		return tokenize(text, TS_RE, function (m) {
			if (m[1]) return 't-com';
			if (m[2]) return 't-str';
			if (m[3]) return 't-kw';
			if (m[4]) return 't-typ';
			if (m[5]) return 't-num';
			return null;
		});
	}

	function highlightSh(text) {
		return tokenize(text, SH_RE, function (m) {
			if (m[1]) return 't-kw';   // プロンプトの $
			if (m[2]) return 't-com';  // # コメント
			if (m[3]) return 't-str';
			return null;
		});
	}

	function highlightJson(text) {
		return tokenize(text, JSON_RE, function (m) {
			if (m[1]) return m[2] ? 't-kw' : 't-str';  // キーはキーワード色、値は文字列色
			if (m[3]) return 't-kw';
			if (m[4]) return 't-num';
			return null;
		});
	}

	/** エラー行を丸ごと赤にする。既に span で包まれた中身はそのまま活かす */
	function markErrors(html, text) {
		if (!ERR_RE.test(text)) return html;
		ERR_RE.lastIndex = 0;
		return html.replace(/^.*\berror TS\d+:.*$/gm, function (line) {
			return '<span class="t-err">' + line + '</span>';
		});
	}

	function run() {
		var blocks = document.querySelectorAll('pre > code');
		for (var i = 0; i < blocks.length; i++) {
			var code = blocks[i];
			var text = code.textContent;
			if (!text) continue;

			var kind = detect(code, text);
			var html;
			if (kind === 'sh') html = highlightSh(text);
			else if (kind === 'json') html = highlightJson(text);
			else html = highlightTs(text);

			code.innerHTML = markErrors(html, text);
			code.parentNode.setAttribute('data-lang', kind);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run);
	} else {
		run();
	}
})();
