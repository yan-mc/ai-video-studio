# vendor/ 是什么，为什么 Python 在这里

## 一句话

这里的 Python **不是本插件的代码，是 ComfyUI 的自定义节点包**。
插件（Node）从不 import 它、也从不执行它 —— 它必须被部署到
`<ComfyUI>/custom_nodes/`，由 **ComfyUI 进程**加载并执行。

## 它到底怎么被用到的

```
DSH Agent / 浏览器
      │  HTTP POST /prompt  （221 个参数 + 素材文件名）
      ▼
DSH 插件 host/  （Node ESM）
      │  组装 ComfyUI 的图 JSON：{ "1": { class_type: "NanFengH3MultiReferenceGeneratorV15", inputs: {...} } }
      │  HTTP POST http://127.0.0.1:8488/prompt
      ▼
ComfyUI 进程  （Python）
      │  加载 vendor/nanfeng/ 这个 custom_node
      │  NanFengH3MultiReferenceGeneratorV15.generate() 内部用 GraphBuilder
      │  展开成 ~40 个原生节点（采样器 / VAE / LoRA / 续写 latent / 二采 / 输出）
      ▼
GPU 出片 → output/ → 插件下载归档
```

**关键理解**：插件和这个 Python 包之间**只有 HTTP**，没有 import。
所以它放哪都行 —— 只要 ComfyUI 能加载到。放在 `vendor/` 的理由是：

1. **随插件分发**：用户 clone 仓库就拿到了节点包，不用另外去南风那里下载
   （那个包已经没有后续更新了，V15 是终点）
2. **版本锁定**：插件的行为依赖这个包的**具体版本**。`h3_generator.py`
   里的 `False` 分支、参数语义、GraphBuilder 的节点组合都写死了，
   换一个版本插件就错。所以它必须和插件一起做版本管理
3. **改造记录可追溯**：`VENDOR.md` 记录了删掉了哪些模块、为什么删

## 为什么不能搬到 host/ 或 app-src/

| 目录 | 为什么不行 |
|---|---|
| `host/` | 那是 Node ESM。Python 在这里**永远不会被执行** —— 没有任何东西会 import 它 |
| `app-src/` | 那是浏览器代码（TypeScript），更不可能跑 Python |
| `skills/` | 那是给模型读的 Markdown 文档 |

唯一的合法归宿就是 ComfyUI 的 `custom_nodes/`，而 `vendor/`
是"随包分发但由外部宿主执行"的第三方代码的标准位置。

## 目录内容

| 文件 | 行数 | 职责 |
|---|---|---|
| `__init__.py` | 44 | 包入口。只 import `h3_generator`，**不加载** `_removed/` |
| `h3_generator.py` | 2590 | 主节点 `NanFengH3MultiReferenceGeneratorV15`：221 参数 → GraphBuilder 展开 ~40 节点 |
| `nodes.py` | 287 | 提示词节点（中文提示词 + `@` 素材引用） |
| `latent_continuation.py` | 74 | 续写 latent 落盘：`clip_1`、`clip_2`… 按 `(workflow,node,group,run)` 哈希分目录 |
| `continuation_audio_refine.py` | 126 | 续写接缝的音频精修（保护已对齐的音频关键帧） |
| `native_audio_lock.py` | 41 | 锁音频：把参考音频原样作为输出音轨 |
| `nanfeng_sampler.py` | 17 | ER-SDE 采样器封装 |
| `trt_options.py` | 31 | TensorRT 引擎文件枚举（`vae/` 目录下扫 `.engine`） |
| `dlss_output.py` + `dlss_schema.json` | 45 + 426 | DLSS 超分/补帧输出节点；**无插件时自动降级** |
| `retired_mode_guard.py` | 11 | 旧模式参数守卫：收到已废弃字段就明确报错，不静默转换 |
| `_removed/` | — | 已移除模块，**不被加载**，仅作"当初删了什么"的依据 |

## 依赖（都在 ComfyUI 进程侧，不在插件侧）

| 依赖 | 谁用 | 说明 |
|---|---|---|
| `torch` / `torchaudio` | `native_audio_lock.py` | ComfyUI 自带 |
| `comfy.nested_tensor` | `native_audio_lock.py` | ComfyUI 0.45.0+ 提供 |
| `folder_paths` | `trt_options.py` | ComfyUI 内部模块 |
| 第三方节点包 | 见下表 | 必须单独安装到 ComfyUI |

需要另外装的 ComfyUI 节点包：

| 包 | 用途 | 必需? |
|---|---|---|
| `ComfyUI-KJNodes` | 采样辅助 / Sage Patch | 必需 |
| `ComfyUI-H3-Motion-Context` | 续写 latent 读写 | 续写必需 |
| `ComfyUI-H3-AudioRefine` | 续写音频精修 | 可选（`continuation-quality` 用到） |
| `ComfyUI-VideoHelperSuite` | 输出 mp4 | 必需 |
| `Comfyui_Minimax_h3_latent_Upscaler` | 潜空间二采 | 二采必需 |

> ⚠️ `Comfyui_Minimax_h3_latent_Upscaler` 的上游 HEAD 已改名并删除了
> `H3LatentUpscalerNodeMegapixels`。本仓库的部署脚本会还原所需的历史版本文件，
> **不要**用该包的最新 HEAD。

## 部署

```powershell
# 在项目根目录执行
pwsh -File vendor/nanfeng/deploy-vendor.ps1 -ComfyDir "F:\AI视频\ai-runtime\ComfyUI"

# 目标已存在时需要 -Force（ComfyUI 在跑的话，覆盖后要重启它）
pwsh -File vendor/nanfeng/deploy-vendor.ps1 -ComfyDir "..." -Force
```

验证：

```powershell
# 节点已注册
curl.exe -s http://127.0.0.1:8488/object_info/NanFengH3MultiReferenceGeneratorV15

# 插件侧自检
npm test    # 应有「南风节点已加载」通过
```

## 改造记录

看 [VENDOR.md](nanfeng/VENDOR.md)：删了哪 7026 行、为什么删、
哪些 `False` 分支是**等价化简**而不是 bug。