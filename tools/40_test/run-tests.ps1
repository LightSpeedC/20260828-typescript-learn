# tests/ のテストを全件実行する
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/../..").Path
$target = (Resolve-Path "$root/tests").Path
if (-not $target) { throw 'tests フォルダが見つかりません' }
Write-Host "node --test で実行します"
node --test $target
$code = $LASTEXITCODE
if (Get-Command bun -ErrorAction SilentlyContinue) {
	Write-Host "bun test で実行します"
	# bun は *.spec.ts も拾うので、PlayWright のテスト（tests/browser）を外す
	bun test --path-ignore-patterns "**/browser/**" $target
	if ($LASTEXITCODE -ne 0) { $code = $LASTEXITCODE }
}
# ブラウザのテスト（tests/browser）は PlayWright 共有環境で動かす
if (Get-Command playwright-test -ErrorAction SilentlyContinue) {
	Write-Host "playwright-test でブラウザのテストを実行します"
	playwright-test --test-dir "$target/browser" --out-dir "$root/tmp/playwright" --reporter=line
	if ($LASTEXITCODE -ne 0) { $code = $LASTEXITCODE }
} else {
	Write-Host "playwright-test が見つからないので、ブラウザのテストは実行しません"
}
exit $code
