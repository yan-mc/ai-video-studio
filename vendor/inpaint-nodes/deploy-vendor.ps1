# 部署 vendor/inpaint-nodes 到 ComfyUI
#
# 为什么需要这个脚本：
#   vendor/inpaint-nodes/ 是 **ComfyUI 的自定义节点包**（Python），
#   不是本插件的代码。插件（Node ESM）从不 import 它、也不执行它 ——
#   它必须被复制到 `<ComfyUI>/custom_nodes/` 下面，由 ComfyUI 进程加载。
#
#   所以它不能放 host/（Node）、app-src/（浏览器）、skills/（文档）。
#   它只能待在 vendor/（随包分发、但不被执行），部署时复制出去。
#
# 用法:
#   .\deploy-vendor.ps1 -ComfyDir "F:\AI视频\ai-runtime\ComfyUI"
#   .\deploy-vendor.ps1 -ComfyDir "..." -Force          # 覆盖已存在的目录
#   .\deploy-vendor.ps1 -ComfyDir "..." -Force -Clean   # 覆盖前清空目标 *.py 与 __pycache__
#
# 关于 -Clean：
#   Copy-Item -Force 只覆盖同名文件，**从不删除**目标里已不存在的旧 .py。
#   删掉某个模块后重新部署，ComfyUI 仍会 import 到那份残留旧文件。
#   -Clean 会在复制前删除目标目录顶层的 *.py 与 __pycache__（只动 $DEST，
#   且有路径校验，不会碰到兄弟插件目录）。
#
# 部署后必须**重启 ComfyUI** 才能加载（它只在启动时扫描 custom_nodes）。

param(
  [Parameter(Mandatory = $true)][string]$ComfyDir,
  [switch]$Force,
  [switch]$Clean
)

$ErrorActionPreference = 'Stop'
$SRC  = $PSScriptRoot
$DEST = Join-Path $ComfyDir "custom_nodes\jiuzhang_inpaint_nodes"

Write-Host "源目录 : $SRC"
Write-Host "目标   : $DEST"
Write-Host ""

if (-not (Test-Path $ComfyDir)) {
  Write-Host "❌ ComfyUI 目录不存在: $ComfyDir" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $SRC)) {
  Write-Host "❌ vendor 源目录不存在: $SRC" -ForegroundColor Red
  exit 1
}

$initSrc = Join-Path $SRC "__init__.py"
if (-not (Test-Path $initSrc)) {
  Write-Host "❌ 缺少 __init__.py: $initSrc" -ForegroundColor Red
  exit 1
}

# 目标已存在且没加 -Force → 明确拒绝，不静默覆盖
if ((Test-Path $DEST) -and -not $Force) {
  Write-Host "⚠️  目标已存在: $DEST" -ForegroundColor Yellow
  Write-Host "   要覆盖请加 -Force（ComfyUI 在跑的话，覆盖后需重启它）"
  exit 2
}

if ($Clean -and (Test-Path $DEST)) {
  Write-Host "清理旧文件 (.py / __pycache__)…"
  Get-ChildItem -Path $DEST -Filter *.py -File -ErrorAction SilentlyContinue | Remove-Item -Force
  $pycache = Join-Path $DEST "__pycache__"
  if (Test-Path $pycache) { Remove-Item $pycache -Recurse -Force }
}

New-Item -ItemType Directory -Force -Path $DEST | Out-Null

# 只复制节点实现与许可说明，不复制本脚本与文档
$files = @("__init__.py")
foreach ($f in @("LICENSE-KJNodes.txt", "VENDOR.md")) {
  $p = Join-Path $SRC $f
  if (Test-Path $p) { $files += $f }
}

foreach ($f in $files) {
  Copy-Item (Join-Path $SRC $f) (Join-Path $DEST $f) -Force
  Write-Host "  ✓ $f"
}

Write-Host ""
Write-Host "✅ 已部署到: $DEST" -ForegroundColor Green
Write-Host ""
Write-Host "下一步："
Write-Host "  1) 重启 ComfyUI（它只在启动时扫描 custom_nodes）"
Write-Host "  2) 验证节点已注册："
Write-Host "     curl.exe -s http://127.0.0.1:8488/object_info/JZImageCropByMaskAndResize"
Write-Host "     curl.exe -s http://127.0.0.1:8488/object_info/JZImageUncropByMask"
Write-Host ""
