# ComfyUI 内存/卡死问题分析报告

> 分析对象：`F:\AI视频\ai-runtime`（ComfyUI 0.45.0 + 南风 H3 V15）
> 复现样本：`rp_mws3tkjas5c47` —— 7 段换人 + 续写批次
> 分析时间：2026-11-23
> 结论均已在本机实测验证，证据见各节「实测」小节

---

## 一、先给结论

用户描述的两个症状 —— **「连续跑越来越慢」** 和 **「第 4 段完全跑不动、很久之后才恢复」** ——
是**两个不同的故障**，被同一个现象串起来了：

| 症状 | 真实原因 | 严重度 | 本次处理 |
|---|---|---|---|
| 第 4 段卡 1 小时 32 分后自己恢复 | **GPU 驱动 TDR 超时恢复**（`nvlddmkm` 事件 153） | 致命 | 已改启动参数规避 |
| 连续跑越来越慢 | 每段重复 staged **66GB** 权重 + 放大器缓存无界累积 | 严重 | 已修代码 + 启动参数 |
| 「内存 30.4GB 不释放」 | 主要是 `--lowvram` 误导 + RAM pressure cache 阈值不可达 | 中 | 已改启动参数 |
| 量化算力 | ~~cu128 腰斩 2.3 倍~~ → **已证伪**，int8 路径本就不如 bf16 | — | 无需处理 |

**最重要的纠正**：所谓「ComfyUI 内存泄漏」在本机的实测结果是**并不存在典型泄漏**。
真实生成跑 4 段，进程私有内存 13.77GB 峰值 → 结束回落到 **4.54GB**。
问题出在**重复加载**和**驱动超时**，不是引用泄漏。

**第二个纠正**：初版报告称「cu128 让量化算力腰斩」，该结论是冷启动噪声误判，
已在 `docs/CU128-ASSESSMENT.md` 中更正。详见第五节。

---

## 二、第 4 段卡死的真正原因：GPU 驱动 TDR

### 证据链

```
任务时间线（jobs.json）              Windows 系统日志
────────────────────────────────────────────────────────
02:18:54  job_mws5uttaa24t4t 开始
          ↓ 卡住，无任何进度
03:03:56  ←────────────────────  nvlddmkm 事件 ID 153（错误）
          ↓ 驱动恢复后继续
05:18:08  job_mws89elb1khw2n 完成
          总耗时 111.9 分钟（正常应为 20-25 分钟）
```

两处 `nvlddmkm` 153 事件分别落在 `03:03:56` 和 `06:09:08`，都精确对应任务卡死窗口。

### 机制

`nvlddmkm` 事件 153 = **TDR（Timeout Detection and Recovery）**：GPU 上的一次内核执行超过
Windows 默认 2 秒阈值，驱动判定挂起，强制复位 GPU 并重建上下文。

复位期间：
- GPU 计算停摆 → 日志里 `Model Initializing` 首步耗时从 5:16 暴涨到 **1:32:24**
- 功耗从 150W+ 掉到 ~44W（用户观察到的正是这个）
- 驱动恢复后任务继续跑（所以「很久之后自己恢复了」）

**为什么 12GB 卡特别容易触发**：VBAR 把显存填到接近满载时，WDDM 会把部分权重降级到
「共享 GPU 内存」（实际走系统内存），随后的采样每步都要从内存流权重。
ComfyUI 源码自己也承认这条路径（`comfy/model_management.py:853`）：

```python
EXTRA_RESERVED_VRAM = 600 * 1024 * 1024 #Windows is higher because of the shared vram issue
```

### 处理

在 `start-h3.ps1` 加 `--vram-headroom 1`，给 WDDM 留 1GB 余量，避免踩到溢出路径。

> ⚠️ **这条不能完全根治**。TDR 是驱动层机制，`--vram-headroom` 只是降低触发概率。
> 如果再次出现，需要调高 Windows 的 `TdrDelay`（需管理员权限，本机当前无）：
> ```
> reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v TdrDelay /t REG_DWORD /d 60 /f
> ```
> 但这是把「2 秒超时」改成「60 秒超时」，属于掩盖而非修复，只在前者无效时考虑。

---

## 三、每段重复 staged 66GB —— 「越来越慢」的主体

### 实测数据

从 `comfy_err.log` 逐条数出来的 staging 事件（每个 prompt 都是一模一样的一遍）：

| 模型 | 大小 |
|---|---|
| MiniMaxH3TEModel（文本编码器） | 25,882 MB |
| MiniMaxH3（扩散模型） | 19,983 MB |
| MiniMaxH3VideoVAE | 4,965 MB × **3 次** |
| MiniMaxH3AudioVAE | 576 MB |
| **单 prompt 合计** | **约 66 GB** |

而机器只有 32GB 内存 + 12GB 显存。

### 根因：`_aggressive_h3_vram_release()` 的调用位置

`h3_generator.py` 里这个函数会做 6 件事，其中两件是破坏性的：

```python
def _aggressive_h3_vram_release(mm, collect_garbage):
    mm.unload_all_models()          # ① 清空已加载模型列表
    mm.reset_cast_buffers()         # ② 清空 cast 缓冲 + bounce 所有模型 mmap
    collect_garbage()
    mm.cleanup_models()
    mm.cleanup_models_gc()
    mm.soft_empty_cache(force=True) # ③ 全设备 synchronize + empty_cache
```

① 之后 `current_loaded_models` 为空，下一个节点想用模型时只能**从磁盘重新 staged**。
② 的 `reset_cast_buffers()` 会调用 `comfy_aimdo.model_mmap.bounce()`，把模型文件的
**mmap 页缓存整段丢弃** —— 因为本机 `fast_disk=True`（模型在 F: NVMe 上），
`ops.py` 的 `handle_pin()` 在 fast_disk 模式下**不做 host 侧 pin**，
所以没有任何内存缓存能扛住这次 bounce，只能回盘重读。

### 调用次数的事实核对

静态看有 9 个调用点，但逐条可达性分析后，V15 Ref2VA 路径**每任务只有 3 次**：

| 行号 | 实际可达 | 说明 |
|---|---|---|
| 611 `ReleaseAtStart` | ✅ 每任务 | `IS_CHANGED` 返回 NaN，永不缓存 |
| 1095 `ReleaseBeforeConditionLoaders` | ✅ 每任务 | 「CLIP+双VAE 先于 DiT 加载」屏障 |
| 1152 `ReleaseBeforeSampling` | ✅ 每任务 | 「条件编码后、采样前」屏障 |
| 640/711/883/1038/1183 | ❌ 死代码 | 被 `is_v81 = True` 或 `hd_second_pass = False` 短路 |

**3 次已经足够解释 66GB**：每段要依次 stage 文本编码器（25.9GB）、扩散模型（20GB）、
两个 VAE（5.5GB），而中间每次屏障都把它们扔掉。

### 处理

**本次没有动 `h3_generator.py` 的屏障接线**，原因：
- 这是南风上游的设计（保证 12GB 卡不 OOM），删掉有 OOM 回归风险，需要长跑验证
- 本轮已经改了启动参数，同时改两处会让归因困难

**已改的是 `--cache-none`**：RAM pressure cache 的 inactive 阈值在 32GB 机器上
`min(128, 32) = 32GB`，而 `virtual_memory_available()` 永远小于这个值，
导致**每个节点执行后都要清一遍缓存 + 压 pin**。关掉它至少消掉这一层无效动作。

**建议的后续优化**（需要单独一轮长跑验证）：把 `ReleaseBeforeConditionLoaders`
和 `ReleaseBeforeSampling` 两个屏障从图中摘掉，让 DynamicVRAM 自己按需换入。
预计能把每段的 3 次 staged 降到 1-2 次。

---

## 四、真正被修掉的两处代码缺陷

### 4.1 放大器 MODEL_CACHE 无界累积

**位置**：`Comfyui_Minimax_h3_latent_Upscaler/nodes/` 下三个模块

**问题**：
```python
MODEL_CACHE = {}            # 模块级，进程存活期不清
...
MODEL_CACHE[cache_key] = model     # 只写，从不删除
```
`cache_key` 含 `device` 与 `precision`，换精度或换卡就新增一个键，旧键永不淘汰。
多份模型同时常驻 → 12GB 卡直接 OOM，且 RAM 里各留一份。

**更糟的是清理节点扫不到它们**。`h3_generator.py` 的清理循环只匹配：
```python
if "h3_upscaler_common" not in module_name.lower():   # ← 只认这一个
    continue
```
而实际模块名是 `...minimax_h3_latent_upscaler_3d`，**不含** `h3_upscaler_common`。
实测确认：

| 模块 | 旧规则命中 | 新规则命中 |
|---|---|---|
| `...h3_upscaler_common` | ✅ | ✅ |
| `...minimax_h3_latent_upscaler_2d` | ❌ | ✅ |
| `...minimax_h3_latent_upscaler_3d` | ❌ | ✅ |

**修复**：
1. 三个模块各加 `cache_model()`，装新模型前先 `clear()`（单槽淘汰），避免峰值出现两份
2. 清理规则改为 `"h3_upscaler"` 或 `"latent_upscaler"` 命中

### 4.2 job-store 的 IO 放大

**位置**：`host/services/job-store.js` 的 `pruneJobs()`

**问题**：逐条 `remove(id)` 删 100 条 → 100 次完整的 608KB 读改写。
Windows 上 `renameSync` 还会撞杀软/索引器触发 EPERM 重试（带真睡眠，最坏 0.7 秒/条）。

**修复**：改用一次 `replaceAll(kept)`。安全性已验证：`replaceAll` → `replaceJson`
→ `updateJson` 走**同一个 per-file 串行队列**，不绕过并发保护。

### 4.3 replace-runner 的重复回读

**位置**：`host/services/replace-runner.js` 的 `emit()`

**问题**：`upsert()` 内部已经读过一次磁盘，紧接着 `store.get()` 又读一次 152KB。
每段调用 2 次，30 段批次 = 60 次重复的全量读 + JSON.parse。

**修复**：直接用 `upsert()` 的返回值（契约就是「返回合并后的单条记录」）。

---

## 五、已更正：cu128 的实际影响没有当初判断的那么大

> ⚠️ **本节结论已被 `docs/CU128-ASSESSMENT.md` 推翻并修正。**
> 保留原始记录是为了说明错在哪里 —— 原始测量用的是冷启动单次计时，
> 得到「慢 2.3 倍」；改用 `torch.utils.benchmark` 稳态测量后，
> eager 与 cuda 后端**基本一样快**，且 int8 路径本身还比
> 「反量化→bf16」慢 1.87 倍。
>
> **一句话：不是 cu128 的问题，是 int8 量化路径在本机就不划算。**
> 升级 cu130 对本问题收益接近于零。详见该文档。

### 原始记录（保留）

本机 `torch 2.11.0+cu128`。ComfyUI 0.45.0 在 `comfy/quant_ops.py:26-28` 里
在 `torch.version.cuda < 13` 时调用 `ck.registry.disable("cuda")`。

后续核查发现：这只是一个 Python 层开关（二进制在 cu128 下可正常 import），
但即使绕过它也没有收益 —— `comfy-kitchen` 的 CUDA 后端把 `int8_linear`
的注册条件卡在 `_C.HAS_CUBLASLT`（编译期常量，本机为 False），
所以 int8 GEMM 无论如何都回退到 eager；而 cuda 后端相对 eager 多出来的能力
只有 3D 网格算子，H3 一个都用不到。

**为什么没修**：不需要修。详见 `docs/CU128-ASSESSMENT.md`。

---

## 六、启动参数变更清单

文件：`ai-runtime/start-h3.ps1`

| 参数 | 变更 | 理由 |
|---|---|---|
| `--lowvram` | **删除** | DynamicVRAM 下是空操作（`cli_args.py` 帮助文本自己写明）。留着只会让日志打 `Set vram state to: LOW_VRAM` 误导人 |
| `--disable-pinned-memory` | **保留** | 本机最值钱的一行。Windows pin 上限 = ram×0.40 ≈ 12.8GB，且每模型预留 2 倍地址空间。上游 #11775 记录的「重启 ComfyUI 都放不掉」就是这条路径 |
| `--fast-disk` | **新增（显式）** | 本机模型在 F: NVMe，自动探测本来就为 True；显式写死避免换盘后策略静默翻转 |
| `--cache-none` | **新增** | RAM pressure cache 的 inactive 阈值 32GB 在本机不可达，导致每节点驱逐+压 pin。H3 每段换提示词，跨 prompt 缓存本就没有命中率 |
| `--vram-headroom 1` | **新增** | 规避 WDDM 共享显存溢出的 TDR（见第二节） |
| `--use-ck-attention` | **保留** | 实测快 15%，零额外依赖 |

### 实测生效验证

重启后日志确认：

```
[INFO] Set vram state to: NORMAL_VRAM      ← 不再是误导性的 LOW_VRAM
[INFO] Disabling intermediate node cache.  ← --cache-none 生效
Enabled pinned memory lines: 0             ← pinned memory 确实关着
[INFO] DynamicVRAM support detected and enabled
```

---

## 七、验证结果

### 冒烟测试

```
通过 207 / 207，全部通过
```

（重启 ComfyUI 后跑，包含全部 ComfyUI 集成项）

### 端到端连续生成

用真实参考图 + 真实 `buildShotWorkflow` 连续跑 4 段（每段提示词不同以避开节点缓存）：

```
段  结束时 private 内存
1      8.02 GB
2      8.71 GB
3     11.61 GB
4      4.54 GB   ← 回落
```

**峰值 13.77GB，结束后回落到 4.54GB，无单调上升。**
对照用户报告的症状（30.4GB 且不释放），累积问题已消失。

GPU 状态正常：`153.95W / 100% 利用率`（故障时是 44W）。

---

## 八、仍然存在的风险

| 风险 | 说明 | 建议 |
|---|---|---|
| TDR 仍可能触发 | `--vram-headroom 1` 只降低概率 | 若复发，调高 `TdrDelay`（需管理员） |
| 每段仍 staged 66GB | 屏障节点未摘除 | 单独一轮长跑验证后摘掉两个屏障 |
| 量化算力 | ~~cu128 导致~~ → 实为 int8 路径本身不划算 | **不必升级 cu130**，见 `CU128-ASSESSMENT.md` |
| 文本编码器 25.9GB | int8 版，每段重跑一遍 | 换 NVFP4 版（约 15.7GB）收益最大 |
| `--use-ck-attention` | Windows 上有零星硬复位报告（上游 #17332） | 若出现异常复位，先去掉它做 A/B |

---

## 九、方法论备忘

排查这类问题，**日志 + 系统事件日志 + 实测内存曲线**三者缺一不可：

1. `comfy_err.log` 的 `prepared for dynamic VRAM loading` 行能逐条数出 staged 次数
   —— 这是判断「重复加载」最硬的证据
2. `Get-WinEvent -ProviderName nvlddmkm` 能抓到 TDR —— 这是解释「卡死又自己恢复」
   的唯一途径。**只看 ComfyUI 日志会误判成内存泄漏**
3. 内存要盯着 `PrivateMemorySize64` 而不是 `WorkingSet64` —— 后者会被 mmap 的模型
   文件撑大（实测 25GB 文件映射只占 0.1GB RSS，是可回收的页缓存）
