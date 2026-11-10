# 模型适配规范：MiniMax H3 + Seedance

> 注：本文件为历史归档，其中的软件名已中性化处理。

> 配套《方案总览.md》与《插件架构与接口规范.md》。只定义接口/字段/流程，不含实现代码。
> 目标：两个主模型走同一 `VideoBackend` 接口；本地 H3 与云端 Seedance 可互换；API Key/账号等测试阶段再配。

## 1. 统一能力矩阵

| 能力 | H3（本地/官方 API） | Seedance 2.5（火山方舟） | Seedance 2.0 系列 |
|---|---|---|---|
| 时长 | 4—15 秒（整数） | 最长 30 秒 | 5—10 秒级 |
| 原生音频 | ✅（对白/环境声/音乐） | ✅（有声/无声） | ✅（有声/无声） |
| 文生视频 | ✅ | ✅ | ✅ |
| 首帧 | ✅（I2VA/L2VA） | ✅ | ✅ |
| 首尾帧 | ✅（FL2VA） | ✅ | ✅ |
| 参考图 | ≤9 张 | 0—30 张 | 0—9 张 |
| 参考视频 | ≤3 个（2—15s，总 ≤15s） | 0—10 个 | 0—3 个 |
| 参考音频 | ≤3 个（2—15s，总 ≤15s） | 0—10 个（可单独传音频） | 0—3 个（不可单独音频） |
| 分辨率 | 768p（开源）/2K（官方 API） | 720p/1080p 等（按模型） | 720p 等 |
| 提示词 | 六段式/三段式（≤7000 字符） | 中文 ≤500 字/英文 ≤1000 词 | 同 |
| 计费 | 本地电费/折旧；官方 $0.04—0.13/s | 火山方舟按 token/秒（后查） | 后查 |

## 2. `VideoBackend` 接口

```ts
type ResolvedAssetRef = { packId: string; entryId: string; absPath: string; sha256: string; kind: string };

interface BackendInput {
  prompt: string;
  mode: 't2v' | 'i2v' | 'fl2v' | 'ref2v';
  durationSec: number;
  resolution?: string;
  ratio?: string;
  seed?: number;
  images?: ResolvedAssetRef[];   // first/last/reference
  videos?: ResolvedAssetRef[];
  audios?: ResolvedAssetRef[];
  extras?: Record<string, unknown>;
}

interface JobHandle { backendId: string; remoteId: string; jobId: string; }
interface JobStatus {
  state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number; etaSec?: number; error?: string; raw?: unknown;
}
interface OutputFile { role: 'video' | 'audio' | 'lastFrame' | 'thumb'; path: string; bytes: number; sha256: string; }

interface VideoBackend {
  id: string;
  capabilities: BackendCapabilities;
  health(): Promise<{ ok: boolean; detail?: string }>;
  submit(input: BackendInput): Promise<JobHandle>;
  poll(handle: JobHandle): Promise<JobStatus>;
  fetch(handle: JobHandle, destDir: string): Promise<OutputFile[]>;
  cancel?(handle: JobHandle): Promise<void>;
}
```

## 3. H3 适配器

### 3.1 本地（h3-local）

- 路径 A：**ComfyUI HTTP**（主）
  - `GET /object_info` 预检节点/模型；`POST /prompt` 提交工作流；`GET /history/{prompt_id}` 轮询；`GET /view?...` 取文件。
  - 工作流模板从资产包 `h3-local-workflows` 挂载；占位符：`{{PROMPT}}/{{DURATION}}/{{SEED}}/{{WIDTH}}/{{HEIGHT}}/{{FIRST_FRAME}}/{{LAST_FRAME}}/{{REF_IMAGES}}/{{CONTROL_VIDEO}}`。
  - Profile：`P12-draft`（480p/8 步 Turbo，12GB）、`P16-std`（768p）、`P24-quality`（768p/10s）；模型选择由资产包 manifest 声明（GGUF/NF4/int8）。
- 路径 B：**SGLang `/v1/videos`**（可选）
  - `POST /v1/videos` → `{id}`；`GET /v1/videos/{id}` 轮询；`GET /v1/videos/{id}/content` 下载。
  - 双服务（FL2VA/Ref2VA）分端口；按 `mode` 路由。
- 官方 API（兜底/2K）：`POST /v2/video_generation`、`/v2/video_regeneration`（2K 需回传最终提示词）；Key 后置。

### 3.2 提示词编译（H3）

- 六段式（Ref2VA）：`subject_definitions / summary / retention_analysis / detailed_description / overall_soundscape / non_diegetic_music`。
- 三段式 + 对齐（FL2VA/I2VA/L2VA/T2VA）：`integrated_multimodal_description / overall_soundscape / non_diegetic_music`。
- 标签：`<Picture N>/<Video N>/<Audio N>/<Subject N>`；保留强度 `fully_preserved/partially_preserved/attribute_transfer`；台词 `<d>[Chinese]…</d>`。
- 校验：悬空标签、标签与素材数量一致、无负向提示词、时长 4—15 整数、字符 ≤7000、参考组 ≤9/3/3/12。

## 4. Seedance 适配器

### 4.1 端点与流程（火山方舟）

- 创建任务：`POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks`
- 查询任务：`GET .../tasks/{id}`；取消/列表按官方文档。
- 鉴权：`Authorization: Bearer $ARK_API_KEY`；模型 ID 与开通条件由你在测试阶段提供（余额/资源包要求）。
- 返回：`ContentGenerationTask{id, model, status, content.video_url, last_frame_url, usage, seed, duration, ratio, resolution, framespersecond, output_format...}`。

### 4.2 请求映射

- 文生视频：`content=[{type:'text',text:prompt}]` + `model/resolution/ratio/duration/seed/watermark`。
- 首帧：追加 `{type:'image_url',image_url:{url},role:'first_frame'}`。
- 首尾帧：追加两张，`role` 分别为 `first_frame`/`last_frame`。
- 全模态参考：`role` 按官方文档（reference_image/reference_video/reference_audio 等，具体字段以测试阶段文档为准）。
- 素材上传：优先 `asset://<ASSET_ID>`（火山素材库）；本地文件测试阶段可 Base64/公网 URL；单图 <30MB、请求体 ≤64MB。
- 时长/分辨率/比例：按模型能力校验；不合法直接拒绝并给出可选值。
- 轮询：建议 10—15 秒间隔；状态 `queued/running/succeeded/failed`；成功后下载 `video_url`（可能过期，及时 fetch）。

### 4.3 与 H3 的差异

| 项 | H3 | Seedance |
|---|---|---|
| 参考图上限 | 9 | 2.5:30 / 2.0:9 |
| 参考视频上限 | 3 | 2.5:10 / 2.0:3 |
| 参考音频上限 | 3 | 2.5:10 / 2.0:3 |
| 最长时长 | 15s | 2.5:30s |
| 中文提示词 | 六段式结构化 | 建议 ≤500 字 |
| 真人脸素材 | 无硬限制（本地自用） | 平台限制：不支持直接含真人人脸的参考图/视频（需虚拟人像/授权素材） |
| 计费 | 本地/官方 API | 方舟按量 |

> 适配器需在 UI 上显示"当前后端能力"，并对超限输入做前置校验。

## 5. 任务/成本/错误

- `Job` 字段：`id/backendId/mode/promptHash/paramsHash/status/remoteId/outputs[]/cost/createdAt/updatedAt`。
- 成本：h3-local 记 GPU 分钟+电价；seedance 记 token/秒与单价；H3 API 记 $/s。
- 错误分类：`auth/config/rate-limit/invalid-input/backend-error/timeout/download-failed`；每类给可操作提示。
- 重试：网络/限流指数退避；输入错误不重试；超时按 profile 降级或切另一后端（用户策略）。

## 6. 测试阶段待补（你提供）

1. 火山方舟 API Key、模型 ID（Seedance 2.5/2.0）、额度/限流。
2. H3 官方 API Key（如需 2K/Regenerate）与账号地区限制确认。
3. 本地 H3：ComfyUI 地址/端口、模型资产包实际文件与显存。
4. 参考素材来源（图片/视频/音频）与其授权。
5. 成本上限与优先级（本地优先/云端优先/质量优先）。

---
