/*
 * 実行可能サンプル（p261009-01）
 *
 * <pre data-run> のコードに「実行」「編集」のボタンと出力欄を足す。
 * 型検査と変換は Worker（runner-worker.js）が TypeScript の変換器で行い、
 * 実行は別の Worker で行う。時間切れになったら、その Worker ごと止める。
 *
 * ボタンと出力欄は JS が足すので、HTML と Markdown には出ない。
 * JS が動かないときは、コードと貼ってある実行結果がそのまま読める。
 */
(function () {
	'use strict';

	var TIMEOUT_MS = 5000;
	var workerUrl = new URL('runner-worker.js', document.currentScript.src).href;
	var compiler = null;
	var queue = [];

	function el(tag, cls, text) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text !== undefined) e.textContent = text;
		return e;
	}

	/** 変換器を持つ Worker はページに 1 つ。読込が重いので使い回す */
	function compile(code, onLoaded) {
		return new Promise(function (resolve, reject) {
			if (!compiler) {
				compiler = new Worker(workerUrl);
				compiler.onmessage = function (e) {
					var msg = e.data;
					if (msg.type === 'loaded') { if (queue[0]) queue[0].onLoaded(msg); return; }
					var job = queue.shift();
					if (!job) return;
					if (msg.type === 'compiled') job.resolve(msg);
					else job.reject(new Error(msg.message));
					if (queue[0]) compiler.postMessage({ type: 'compile', code: queue[0].code });
				};
			}
			queue.push({ code: code, resolve: resolve, reject: reject, onLoaded: onLoaded });
			if (queue.length === 1) compiler.postMessage({ type: 'compile', code: code });
		});
	}

	/** 実行のたびに Worker を作り、終わったら捨てる */
	function execute(js, onLine) {
		return new Promise(function (resolve) {
			var w = new Worker(workerUrl);
			var timer = setTimeout(function () {
				w.terminate();
				resolve({ status: 'timeout' });
			}, TIMEOUT_MS);
			w.onmessage = function (e) {
				var msg = e.data;
				if (msg.type === 'log') { onLine(msg.line); return; }
				clearTimeout(timer);
				w.terminate();
				resolve(msg.type === 'done' ? { status: 'done' } : { status: 'thrown', message: msg.message });
			};
			w.postMessage({ type: 'run', js: js });
		});
	}

	function setup(pre) {
		var code = pre.querySelector('code');
		if (!code) return;
		var original = code.textContent;
		var editor = null;

		var bar = el('div', 'runbar');
		var runBtn = el('button', 'runbtn', '▶ 実行');
		var editBtn = el('button', 'runbtn runbtn-sub', '編集');
		var resetBtn = el('button', 'runbtn runbtn-sub', '元に戻す');
		runBtn.type = editBtn.type = resetBtn.type = 'button';
		resetBtn.hidden = true;
		bar.appendChild(runBtn);
		bar.appendChild(editBtn);
		bar.appendChild(resetBtn);

		var out = el('div', 'runout');
		out.hidden = true;
		out.setAttribute('aria-live', 'polite');

		pre.parentNode.insertBefore(bar, pre.nextSibling);
		bar.parentNode.insertBefore(out, bar.nextSibling);

		function source() {
			return editor ? editor.value : original;
		}

		editBtn.addEventListener('click', function () {
			if (editor) { editor.focus(); return; }
			editor = el('textarea', 'runedit');
			editor.value = original;
			editor.spellcheck = false;
			editor.rows = Math.min(30, original.split('\n').length + 1);
			pre.hidden = true;
			pre.parentNode.insertBefore(editor, pre);
			resetBtn.hidden = false;
			editor.focus();
		});

		resetBtn.addEventListener('click', function () {
			if (editor) editor.remove();
			editor = null;
			pre.hidden = false;
			resetBtn.hidden = true;
			out.hidden = true;
		});

		runBtn.addEventListener('click', function () {
			runBtn.disabled = true;
			out.hidden = false;
			out.textContent = '';
			var status = el('div', 'runstatus', compiler ? '型検査中…' : '変換器を読み込み中…（初回のみ・約 9 MB）');
			out.appendChild(status);

			compile(source(), function (info) {
				status.textContent = '型検査中…（TypeScript ' + info.version + ' を ' + info.ms + ' ms で読み込み）';
			}).then(function (r) {
				status.remove();
				r.errors.forEach(function (d) {
					out.appendChild(el('div', 'runerr', (d.line ? d.line + ' 行目: ' : '') + 'error TS' + d.code + ': ' + d.message));
				});
				return execute(r.js, function (line) {
					out.appendChild(el('div', 'runline', line));
				});
			}).then(function (res) {
				if (res.status === 'timeout') out.appendChild(el('div', 'runerr', '時間切れ（' + TIMEOUT_MS / 1000 + ' 秒）で止めました'));
				if (res.status === 'thrown') out.appendChild(el('div', 'runerr', res.message));
				if (!out.querySelector('.runline, .runerr')) out.appendChild(el('div', 'runstatus', '（出力なし）'));
			}).catch(function (err) {
				out.textContent = '';
				out.appendChild(el('div', 'runerr', '実行できませんでした: ' + err.message));
			}).then(function () {
				runBtn.disabled = false;
			});
		});
	}

	function init() {
		// Worker が使えない環境（file:// で開いた等）では何も足さない
		if (typeof Worker === 'undefined' || location.protocol === 'file:') return;
		Array.prototype.forEach.call(document.querySelectorAll('pre[data-run]'), setup);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
