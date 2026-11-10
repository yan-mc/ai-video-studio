# 附录 C：DSH 插件接口与数据模型（设计稿）

> 注：本文件为历史归档，其中的软件名已中性化处理。

> 配套《AI视频本地制作软件与DSH插件工程规划-v2.md》（v2.1）与附录 D/E。本附录只定义**接口、数据模型、UI 结构、适配器契约与验收标准**，不包含实现代码。
> 目标：让 DSH Agent 与人类用户都能在同一套项目数据上工作；生成/后期全部通过外部服务完成。

## C1. 插件组成

```
@local/dsh-ai-video-studio（一个 bundle，两个 half）
├─ Host half（index.js）
│  ├─ 工具注册（studio_*）
│  ├─ Web 路由（/ai-video-studio/api/*）
│  ├─ 服务：ProjectService / ShotService / JobService / AdapterService /
│  │        QcService / ProvenanceService / CostService
│  └─ 事件：job/progress、job/completed、qc/failed（供 UI/Agent 订阅）
└─ Client half（client.js）
   ├─ sidebar.panellist：视频工作室图标（点击进入主面板）
   ├─ main（key=ai-video-studio）：制作台主面板
   └─ 可选：settings.section（服务地址/并发/默认参数/来源台账）
```

**为什么用 DSH 插件**：Host 工具让 Agent 直接操作项目数据；Client 插槽提供制作台 UI；MCP 可接 Blender/ComfyUI/外部服务；审批/凭据/子代理/工作流引擎直接复用。

## C2. Host 工具清单（Agent 调用）

> 统一风格：`action` + 参数；返回 JSON；错误带 `reason`；所有写操作需要确认（审批门）。

### C2.1 项目/剧本/镜头

| 工具 | action | 参数 | 返回 |
|---|---|---|---|
| `studio_project` | `list/create/get/update/archive` | `projectId/name/description/rootDir` | 项目对象/列表 |
| `studio_script` | `import/split/list/update` | `projectId/text/chapterCount/llm` | 章节/分段 |
| `studio_scene` | `list/create/update/reorder` | `projectId/episodeId/name/description` | 场景 |
| `studio_shot` | `list/get/create/save/duplicate/version` | `projectId/shotId/shot` | 镜头卡 |
| `studio_asset` | `list/get/create/update/link` | `projectId/assetId/type(name/ref/role)` | 资产 |

**镜头卡字段**（核心）：

```json
{
  "id": "SH012",
  "title": "黄叶独白",
  "mode": "ref2va",
  "duration": 6,
  "ratio": "16:9",
  "style": "写实电影感，冷色调，雨夜",
  "description": "中景，人物站在T台中央，缓慢抬头，灯光从左侧打来",
  "camera": "slow push in, small amplitude",
  "dialogue": "我们走吧。",
  "soundscape": "雨声、远处车流、脚步声",
  "music": "N/A",
  "subjects": [
    {"id": "S1", "name": "黄叶", "refs": ["asset/char_huangye/front.png"], "retention": "fully_preserved", "voiceRef": "asset/voice/huangye.wav"}
  ],
  "refs": {"images": ["asset/scene/stage.png"], "videos": [], "audios": []},
  "keyframes": {"first": "previz/frame_first.png", "last": null},
  "control": {"type": "depth", "file": "previz/depth.mp4", "strength": 1.0},
  "promptOverride": "",
  "backend": "comfyui",
  "status": "draft",
  "version": 1
}
```

### C2.2 提示词编译

| 工具 | action | 参数 | 返回 |
|---|---|---|---|
| `studio_prompt` | `compile/validate/save` | `projectId/shotId/save` | `{prompt, chars, warnings}` |

编译规则：

- `ref2va` → 六段式（`subject_definitions/summary/retention_analysis/detailed_description/overall_soundscape/non_diegetic_music`）；
- `fl2va/i2va/l2va` → 三段式 + 对齐指令；`t2va` → 三段式；
- 标签按槽位生成 `<Picture N>/<Video N>/<Audio N>/<Subject N>`，校验悬空标签、保留强度、台词 `<d>`、无负向提示词；
- 输出 `prompt.txt` 保存，2K 再生成要原样回放。

### C2.3 生成/任务

| 工具 | action | 参数 | 返回 |
|---|---|---|---|
| `studio_generate` | `submit/retry/cancel` | `projectId/shotId/backend/params` | `job` |
| `studio_jobs` | `list/get/retry/cancel` | `jobId/status/limit` | 任务列表 |
| `studio_route` | `recommend` | `shot/policy(budget/quality/privacy)` | `{backend, reason, estCost}` |

**Job 模型**：

```json
{
  "id": "job_xxx",
  "type": "generate|upscale|qc|timeline",
  "projectId": "proj_x",
  "shotId": "SH012",
  "backend": "comfyui|sglang|external|mock",
  "status": "queued|running|completed|failed|cancelled",
  "remoteId": "prompt_id 或 video_id",
  "inputHash": "sha256(shot.json)",
  "promptPath": "prompts/job_xxx.txt",
  "params": {"steps": 8, "seed": 1101, "flowShift": 6, "width": 1344, "height": 768},
  "outputPath": "outputs/job_xxx.mp4",
  "error": null,
  "cost": {"model": "h3", "seconds": 5, "amount": 0.4, "currency": "USD"},
  "createdAt": 0, "updatedAt": 0
}
```

### C2.4 后期/QC/时间线

| 工具 | action | 说明 |
|---|---|---|
| `studio_post` | `upscale/interpolate/transcode/concat/subtitle/mix` | 调外部 CLI（SeedVR2/FFmpeg/RIFE/Whisper） |
| `studio_qc` | `run/report/compare` | 对比预演/上一版，输出通过/返修 |
| `studio_previz` | `open/import/attach` | DirectorDesk 文件交换：参考视频/深度/首尾帧；预演软件 sidecar 只读对照 |
| `studio_pipeline` | `render-shot/render-project/qc/assemble` | OpenCineAgent sidecar（P2/P3） |
| `studio_voice` | `project/chapter/extract/cast/synthesize/export` | 预演软件 voice-sidecar 或本地 TTS（P3 可选） |
| `studio_asset_import` | `scan/import/verify` | 导入 fuka CC0 资产/场景模板 |
| `studio_timeline` | `build/export` | OTIO 时间线；导出 EDL/XML 给 Resolve |
| `studio_blender` | `scene/camera/render_depth/render_pose/preview` | 可选兜底：BlenderMCP 或 `blender --background` |
| `studio_provenance` | `list/add/verify` | 来源台账 |
| `studio_cost` | `summary/byProject/byModel` | 成本台账 |
| `studio_config` | `get/set` | 服务地址、并发、默认参数（写配置需审批） |

## C3. Client 主面板结构

### C3.1 布局

```
┌──────────────────────────────────────────────────────────────┐
│ 顶部：项目选择 | 后端（mock/ComfyUI/SGLang/外部） | 批量生成 | 设置 │
├──────────────┬──────────────────────────────────┬────────────┤
│ 左栏          │ 中栏：镜头卡编辑器                │ 右栏        │
│ 项目/集/场树  │ 标题/模式/时长/风格/描述/运镜      │ 任务列表     │
│ 镜头列表      │ 台词/环境声/配乐/角色/参考图/首尾帧 │ 状态/预览    │
│ 资产/预演入口 │ 编译结果（只读）/ 手动覆盖         │ 超分/导出    │
└──────────────┴──────────────────────────────────┴────────────┘
```

### C3.2 页面模块

1. **项目页**：项目/集/场/镜头树、状态筛选、批量操作。
2. **镜头卡页**：表单 + 标签预览 + 提示词编译结果 + 生成按钮 + take 列表。
3. **资产页**：角色三视图/服装/场景/道具/音频；生成/上传/引用计数。
4. **预演页**：Blender 场景/机位预设/白模截图/depth 预览；"导出控制序列"。
5. **任务页**：队列/运行/失败/重试；成本/耗时。
6. **审片页**：预演 vs 生成、上一版 vs 新版、QC 报告、通过/返修。
7. **时间线页**：镜头顺序/时长/音频/字幕/导出（OTIO/EDL）。
8. **设置页**：服务地址（ComfyUI/SGLang/外部 API）、并发、默认参数、数据目录、来源台账。
9. **来源台账页**：代码/素材/模型来源、许可证、修改记录、审核状态。

### C3.3 Slot 使用

- `sidebar.panellist`：注册 `id=ai-video-studio`，label "视频工作室"；点击进入主面板。
- `main`：注册 `key=ai-video-studio`，渲染主面板。
- `settings.section`（可选）：注册设置页。
- 对话内工具卡片：`studio_*` 工具结果用文本/JSON 呈现；生成结果用媒体卡片（如 DSH 支持）。

## C4. 适配器契约

### C4.1 ComfyUI 适配器

- 输入：`workflow.json`（API 格式）+ 占位符 `{{PROMPT}}/{{DURATION}}/{{SEED}}/{{WIDTH}}/{{HEIGHT}}/{{FIRST_FRAME}}/{{CONTROL_VIDEO}}`；
- 提交：`POST /prompt`，`prompt=workflow`，`client_id=job.id`；
- 轮询：`GET /history/{prompt_id}`；
- 下载：`GET /view?filename=...&subfolder=...&type=...`；
- 错误：节点缺失/模型缺失 → 返回 `missing` 清单；
- 版本：固定 ComfyUI 版本 + 每个模型文件哈希。

### C4.2 SGLang H3 适配器

- 提交：`POST /v1/videos`，JSON：`model/prompt/seconds/task/conditions/target{short_edge,aspect_ratio,duration_seconds}/num_inference_steps/flow_shift/audio_flow_shift/seed`；
- 轮询：`GET /v1/videos/{id}`；
- 下载：`GET /v1/videos/{id}/content`；
- 双服务：FL2VA 与 Ref2VA 分端口；适配器按 `shot.mode` 路由；
- 2K：本地只出 768p；需要时调用官方 `/v2/video_regeneration`（带最终提示词）。

### C4.3 外部 API 适配器（可选）

统一接口：

```ts
interface VideoBackend {
  name: string;
  capabilities: { maxDuration: number; audio: boolean; firstFrame: boolean; refImages: number; refVideos: number; refAudios: number; maxResolution: string };
  submit(input: BackendInput): Promise<{ remoteId: string }>;
  poll(remoteId: string): Promise<{ status: 'running'|'completed'|'failed'; outputUrl?: string; error?: string }>;
  download(remoteId: string, dest: string): Promise<void>;
}
```

### C4.4 后期 CLI 契约

| 能力 | 命令/服务 | 输入 | 输出 |
|---|---|---|---|
| 超分 | SeedVR2 / FlashVSR | mp4/帧序列 | 2×/4× mp4 |
| 补帧 | RIFE / FILM | mp4 | 60fps mp4 |
| 字幕 | Whisper | mp4/wav | srt/vtt |
| 拼接/转码/混音 | FFmpeg | 文件列表/参数 | mp4 |
| 时间线 | OTIO | JSON | EDL/XML/OTIO |
| 剪辑/调色 | Resolve（外部） | EDL/素材 | 成片 |

### C4.5 Blender MCP 契约

- `scene.create/load`：加载/创建场景；
- `camera.set`：机位/焦距/关键帧；
- `character.place`：角色/道具摆位；
- `render.preview`：viewport 截图；
- `render.passes`：depth/canny/pose/seg 序列；
- `export.camera`：camera.json（仅软件记录，模型不吃）。

## C5. Agent 工作流

```text
① 编剧 Agent：小说→章节→分段（人工确认）
② 分镜 Agent：分段→镜头卡/景别/时间码（人工确认）
③ 资产 Agent：角色三视图/场景参考（人工选图）
④ 预演 Agent（可选）：Blender 白模/机位/depth/canny/pose
⑤ 提示词 Agent：镜头卡→H3 六段式/三段式（校验）
⑥ 生成 Agent：提交任务→轮询→多 take（审批：花钱）
⑦ 审片 Agent：QC（身份/深度/姿态/台词/音频）→ 通过/返修
⑧ 后期 Agent：超分/补帧/字幕/混音/拼接→导出
⑨ 来源检查 Agent：代码/素材/模型/生成记录 → 台账
```

**审批门**：

- 生成前：显示模型/秒数/预计成本；
- 覆盖 take：必须显式确认；
- 外部 API：首次配置需确认；
- 发布/导出：检查 AI 标识、授权、来源台账完整。

## C6. 存储与安全

```
data/
├─ projects/<projectId>/
│  ├─ project.json
│  ├─ episodes/<episodeId>/scenes/<sceneId>/shots/<shotId>.json
│  ├─ assets/<assetId>/...
│  ├─ takes/<shotId>/<takeId>.mp4
│  ├─ qc/<takeId>.json
│  └─ provenance.json
├─ jobs/jobs.json
├─ prompts/<jobId>.txt
├─ outputs/<jobId>.mp4
└─ index.sqlite（可选，查询用）
```

- 所有路径相对数据根目录；禁止越界；
- Web 路由只服务数据目录内文件；
- 外部 API Key 走 DSH 凭据服务/环境变量，不写文件；
- 生成任务与素材不上传第三方，除非显式启用外部后端；
- 来源台账与媒体分离，便于律师审阅与迁移。

## C7. 验收与测试

| 测试 | 通过标准 |
|---|---|
| 单镜头闭环 | 镜头卡→编译→mock/H3→预览→超分，全程可复现 |
| 任务恢复 | 重启 DSH/ComfyUI 后任务状态可恢复（幂等） |
| 后端切换 | ComfyUI/SGLang/外部/mock 同一镜头可切换并记录参数 |
| 来源台账 | 每个拷贝代码/模型/素材 100% 有记录 |
| UI 基本操作 | 项目/镜头/资产/任务/预览无阻断 |
| 安全 | 越界路径拒绝、未授权外部调用被阻止 |
| 成本 | 每条任务有模型/秒数/单价/重试记录 |
| 合规 | 导出前 AI 标识/授权检查 |

## C8. 实施顺序（与主方案 P0—P4 对应）

1. **P1**：`studio_project/studio_shot/studio_prompt/studio_generate/studio_jobs` + ComfyUI/mock 适配 + 主面板最小页；
2. **P2**：`studio_asset/studio_post/studio_qc/studio_provenance` + 超分/FFmpeg + 审片页；
3. **P3**：`studio_previz`（DirectorDesk 文件交换）+ 预演页 + ControlNet 工作流；
4. **P4**：`studio_timeline` + 多角色 Agent + 批量/成本/发布检查。

---
