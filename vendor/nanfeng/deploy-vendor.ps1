# 部署 vendor/nanfeng 到 ComfyUI
#
# 为什么需要这个脚本：
#   vendor/nanfeng/ 是 **ComfyUI 的自定义节点包**，不是本插件的代码。
#   它必须被复制到 `<ComfyUI>/custom_nodes/` 下面，由 ComfyUI 进程加载 ——
#   插件（Node）本身既不 import 它、也不执行它，只是通过 HTTP 把参数
#   提交给 ComfyUI，由这个节点在 ComfyUI 进程内展开成 ~40 个原生节点。
#
#   所以这三个地方都不能放它：
#     · host/      —— 那是 Node ESM，Python 在这里不会被加载
#     · app-src/   —— 那是浏览器代码，更不可能
#     · skills/    —— 那是给模型看的文档
#
#   它只能待在 vendor/（随包分发、但不被执行），部署时复制出去。
#
# 用法:
#   .\deploy-vendor.ps1 -ComfyDir "F:\AI视频\ai-runtime\ComfyUI"
#   .\deploy-vendor.ps1 -ComfyDir "..." -Force      # 覆盖已存在的目录

param(
  [Parameter(Mandatory = $true)][string]$ComfyDir,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
# 脚本就放在 vendor/nanfeng/ 里，所以源目录是脚本所在目录本身
$SRC  = $PSScriptRoot
$DEST = Join-Path $ComfyDir "custom_nodes\nanfeng_prompt_nodes_v15_modified"

if (-not (Test-Path $ComfyDir)) {
  Write-Host "❌ ComfyUI 目录不存在: $ComfyDir" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $SRC)) {
  Write-Host "❌ vendor 源目录不存在: $SRC" -ForegroundColor Red
  exit 1
}

# ---------------------------------------------------------------- 目标检查

if (Test-Path $DEST) {
  if (-not $Force) {
    Write-Host "⚠️  目标已存在: $DEST" -ForegroundColor Yellow
    Write-Host "    ComfyUI 正在运行的话，覆盖后需要重启它才会重新加载节点。"
    Write-Host "    要覆盖请加 -Force"
    exit 2
  }
  Write-Host "覆盖已存在的节点目录..." -ForegroundColor Yellow
}

# ---------------------------------------------------------------- 只复制运行所需

# _removed/ 是历史参考（不被 __init__.py import），不进 ComfyUI
$EXCLUDE_DIRS = @('_removed')

New-Item -ItemType Directory -Force -Path $DEST | Out-Null

$copied = 0
Get-ChildItem $SRC -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($SRC.Length + 1)
  $top = ($rel -split '\\')[0]
  if ($EXCLUDE_DIRS -contains $top) { return }
  # 只复制 Python 与它依赖的 JSON schema
  if ($_.Extension -notin @('.py', '.json')) { return }
  $to = Join-Path $DEST $rel
  New-Item -ItemType Directory -Force -Path (Split-Path $to) | Out-Null
  Copy-Item $_.FullName $to -Force
  $script:copied++
}

Write-Host "✅ 已复制 $copied 个文件到:" -ForegroundColor Green
Write-Host "   $DEST"

# ---------------------------------------------------------------- 依赖自检

Write-Host ""
Write-Host "依赖自检（这个包在 ComfyUI 进程内运行，不在插件里）:" -ForegroundColor Cyan
$venvPy = Join-Path (Split-Path $ComfyDir -Parent) "venv\Scripts\python.exe"
if (Test-Path $venvPy) {
  & $venvPy -c "import torch; print('   torch', torch.__version__)" 2>$null
  & $venvPy -c "import torchaudio; print('   torchaudio ok')" 2>$null
} else {
  Write-Host "   跳过（未找到 venv: $venvPy）"
}

Write-Host ""
Write-Host "下一步：" -ForegroundColor Cyan
Write-Host "  1) 重启 ComfyUI（覆盖后必须重启才会重新加载节点）"
Write-Host "  2) 验证节点已注册："
Write-Host "     curl.exe -s http://127.0.0.1:8488/object_info/NanFengH3MultiReferenceGeneratorV15"
Write-Host "  3) 插件侧自检：npm test（应有「南风节点已加载」通过）"