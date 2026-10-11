# tests/ のテストを全件実行する
$ErrorActionPreference = 'Stop'
$target = (Resolve-Path "$PSScriptRoot/../../tests").Path
if (-not $target) { throw 'tests フォルダが見つかりません' }
Write-Host "node --test で実行します"
node --test $target
$code = $LASTEXITCODE
if (Get-Command bun -ErrorAction SilentlyContinue) {
	Write-Host "bun test で実行します"
	bun test $target
	if ($LASTEXITCODE -ne 0) { $code = $LASTEXITCODE }
}
exit $code
