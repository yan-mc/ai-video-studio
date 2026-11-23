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
#   .\deploy-vendor.ps1 -ComfyDir "..." -Force -Clean  # 覆盖前先清空目标的 *.py 与 __pycache__
#
# 关于 -Clean：
#   Copy-Item -Force 只会覆盖同名文件，**从不删除**目标里已不存在的旧 .py。
#   删掉某个模块后重新部署，ComfyUI 仍会 import 到那份残留旧文件。
#   -Clean 会在复制前删除目标目录顶层的 *.py 与 __pycache__（只动这个节点包自己的
#   目录 $DEST，且有 -WhatIf 支持与路径校验，不会碰到兄弟插件目录）。

param(
  [Parameter(Mandatory = $true)][string]$ComfyDir,
  [switch]$Force,
  # 复制前清空目标里的 *.py 与 __pycache__，避免已删文件残留
  [switch]$Clean
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

# ---------------------------------------------------------------- 可选清理

if ($Clean -and (Test-Path $DEST)) {
  # 安全护栏：只允许清理 custom_nodes 下的这个节点包目录本身，不做递归通配。
  $destFull = (Resolve-Path -LiteralPath $DEST).ProviderPath
  $customNodesFull = [System.IO.Path]::GetFullPath((Join-Path $ComfyDir "custom_nodes"))
  if (-not $destFull.StartsWith($customNodesFull + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    Write-Host "❌ 安全检查未通过，拒绝清理: $destFull" -ForegroundColor Red
    Write-Host "   目标必须位于 $customNodesFull 之下。" -ForegroundColor Red
    exit 3
  }
  if ($destFull -eq $customNodesFull.TrimEnd([System.IO.Path]::DirectorySeparatorChar)) {
    Write-Host "❌ 安全检查未通过：拒绝清理 custom_nodes 根目录本身。" -ForegroundColor Red
    exit 3
  }
  Write-Host "清理目标目录中的旧 *.py 与 __pycache__（-Clean）..." -ForegroundColor Yellow
  # -WhatIf 友好：Remove-Item 支持 SupportsShouldProcess，用 $WhatIfPreference 传递。
  # 递归是安全的：上面已断言 $destFull 严格位于 custom_nodes 之下，且不等于它本身，
  # 所以 -Recurse 只会触及本节点包目录内部，碰不到兄弟插件。
  Get-ChildItem -LiteralPath $DEST -Recurse -File -Filter '*.py' |
    Remove-Item -Force -WhatIf:$WhatIfPreference
  Get-ChildItem -LiteralPath $DEST -Recurse -Directory -Filter '__pycache__' |
    Remove-Item -Recurse -Force -WhatIf:$WhatIfPreference
}

# ---------------------------------------------------------------- 只复制运行所需

# _removed/ 是历史参考（不被 __init__.py import），不进 ComfyUI
$EXCLUDE_DIRS = @('_removed')
# 运行所需：Python 代码、依赖的 JSON schema，以及给部署者看的 VENDOR.md
# （VENDOR.md 在 ComfyUI 里不参与运行，但漏掉它会让部署后的包无法自查来源，V-13）
$COPY_EXTS = @('.py', '.json', '.md')

New-Item -ItemType Directory -Force -Path $DEST | Out-Null

$copied = 0
Get-ChildItem $SRC -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($SRC.Length + 1)
  $top = ($rel -split '\\')[0]
  if ($EXCLUDE_DIRS -contains $top) { return }
  # 顶层只收 VENDOR.md 这一个 md，避免把 *-skill/ 里的技能书也倒进 ComfyUI
  if ($_.Extension -eq '.md' -and $top -ne 'VENDOR.md') { return }
  if ($_.Extension -notin $COPY_EXTS) { return }
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