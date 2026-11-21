#!/usr/bin/env pwsh
# A/B 台架：同一源、同一提示词、同一种子，只切换「上下文加噪」开关。
#
# 为什么要 12s 而不是 30s：单轮 33 分钟 vs 105 分钟。
# 12s / 3 段已经能复现漂移（段 2→3 身份回退），足够做对照。
param(
  [Parameter(Mandatory=$true)][ValidateSet('A','B')][string]$Arm,
  [string]$ContextLength = '22',
  [switch]$Watch
)

$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:2150/jiuzhang/api'
$repo = 'F:\AI视频\dsh-jiuzhang-studio'

$tok = (Invoke-RestMethod -Uri "$base/token" -TimeoutSec 10).token
$prompt = Get-Content (Join-Path $repo 'data/_abprompt.txt') -Raw -Encoding UTF8

# A = 关加噪（对照组，等价于改动前的行为）
# B = 开加噪（实验组，锥形 0.45 / 0.10 / 2）
$taper = $Arm -eq 'B'
$title = "AB-$Arm taper=$taper ctx$ContextLength"

$body = @{
  title       = $title
  sourceRel   = 'assets/asset_cont_src_12s.mp4'
  refImages   = @(@{ rel = 'assets/asset_sakiko_v2_front.png'; pictureIndex = 1; name = 'sakiko' })
  prompt      = $prompt
  segmentSec  = 5
  continuation = $true
  contextLength = $ContextLength
  accelPlan   = 'dmad8'
  preset      = 'draft'
  styleId     = 'none'
  lightingId  = 'none'
  steps       = 8
  megapixels  = 0.6
  denoise     = 1
  seed        = 1101
  secondPass  = $false
  taperEnabled = $taper
  taperAlpha    = 0.45
  taperAlphaEnd = 0.10
  taperRampSteps = 2
} | ConvertTo-Json -Depth 6

$task = Invoke-RestMethod -Uri "$base/replace/tasks" -Method Post `
  -Headers @{ 'X-JZ-Token' = $tok; 'Content-Type' = 'application/json' } `
  -Body $body -TimeoutSec 30

Write-Host "created $($task.id)  segs=$($task.segments.Count)  taperEnabled=$($task.taperEnabled)  ctx=$($task.contextLength)"

Invoke-RestMethod -Uri "$base/replace/run/$($task.id)" -Method Post `
  -Headers @{ 'X-JZ-Token' = $tok } -TimeoutSec 30 | Out-Null
Write-Host "started $($task.id)"
Write-Host $task.id
