# 南风 H3 V15 · Vendored 改造记录

> 来源：南风 V15 干净迁移包（`F:\AI视频\+ 南风H3\南风V15\`）
> 改造时间：2026-11-17
> 改造目标：接进九章工作室，作为**唯一的 H3 视频生成引擎**

---

## 1. 来源与许可

| 项 | 内容 |
|---|---|
| 原始包 | `南风V15-干净迁移包.zip`（156.6 MB / 265 文件） |
| 主体 | `custom_nodes/nanfeng_prompt_nodes_v15/` |
| 迁移包声明 | 「不是完整 ComfyUI，也不是离线一键运行环境」 |
| 第三方组件 | 各保留原 LICENSE |

---

## 2. 目录结构（改造后）

```
vendor/nanfeng/
├─ __init__.py                    节点包入口（已改：不加载 HTTP API 层）
├─ h3_generator.py                生成主节点 2590 行（原 2596，已删版本分支）
├─ nodes.py                       提示词节点
├─ latent_continuation.py         续写 latent 落盘
├─ continuation_audio_refine.py   续写音频精修
├─ native_audio_lock.py           锁音频
├─ nanfeng_sampler.py             ER-SDE 采样器
├─ retired_mode_guard.py          退役字段守卫
├─ trt_options.py                 TRT 选项
├─ dlss_output.py + dlss_schema.json   DLSS 输出（无插件自动降级）
└─ _removed/                      已移除的模块（保留作参考，**不被加载**）
   ├─ storyboard_api.py           766 行
   ├─ audio_drive_api.py          414 行
   ├─ audio_media_api.py           78 行
   ├─ model_refresh_api.py         43 行
   └─ continuation_scheduler.py   287 行

> ⚠️ 关于 `h3_generator.py.orig`：2026-11-18 已删除。
>    它是改造前的 2596 行原始副本（141 KB）。改造差异在下面第 4 节逐条记录，
>    且 git 历史里也有完整版本 —— 留一份无引用的 `.orig` 只会制造
>    "到底哪个才是正在跑的代码"这类疑问。需要溯源时：
>    `git log --diff-filter=D -- vendor/nanfeng/_removed/h3_generator.py.orig`
>
> `_removed/` 里的 `.py` **不会**被执行：`__init__.py` 只 import
> `h3_generator`，且 ComfyUI 只扫描包根目录的 `__init__.py`。
> 它们存在的唯一理由是"当初删了什么、为什么删"有据可查。

> ### ⚠️ 提示词技能书已迁出 vendor（2026-11-18）
>
> 原包里有 8 个 `*-skill/` 目录随节点包分发，改造时保留在 vendor 下。
> 现已全部迁到 **`skills/prompt/`**（插件唯一的 skill 根目录）：
>
> | 原目录（vendor） | 新位置（skills/prompt） | 说明 |
> |---|---|---|
> | `storyboard-skill` | `h3-official` | H3 官方六段式 + references |
> | `ns-storyboard-skill` | `h3-hailuo` | 海螺版（真正不同的另一份）|
> | `oneshot-continuation-skill` | `h3-continuation` | 一镜到底续写 |
> | `continuation-cuts-skill` | `h3-continuation-cuts` | 可切镜续写 |
> | `nonfirst-i2v-skill` | `h3-nonfirst-i2v` | 非首帧 I2V |
>
> **删除的 4 个重复目录**（已核实 SHA256）：
> `audio-drive-skill`（与 storyboard-skill 逐字节相同，且无音频内容 —— 原包错拷）、
> `oneshot-continuation-ns-skill`、`continuation-cuts-ns-skill`、
> `nonfirst-i2v-ns-skill`（三者与各自 regular 版逐字节相同）。
>
> `storyboard.js` 的 `SKILL_ROOT` 已相应改为 `skills/prompt/`。
> **vendor 现在只放 Python，不再夹带文档资产。**
```

---

## 3. 改造内容

### 3.1 删除 38 处版本判断

**原问题**：V15 继承链是 `V1 → V2 → ... → V81 → V9 → V15`，共 11 代。
代码里 38 处 `isinstance(self, V4)` / `type(self) is V15` 之类的判断，
把 11 代的行为差异冻结在同一个函数里。

**改造原则**：V15 继承自全部祖先，所以 `isinstance(self, V*)` 对 V15 **恒为 True**。

| 表达式 | 对 V15 求值 |
|---|---|
| `isinstance(self, V1..V9, V81)` | **True** |
| `type(self) is V15` | **True** |
| `type(self) is V4` | **False** |
| `not isinstance(self, V6/V7/V81)` | **False** |

**做法**：只做**语义等价的文本替换**，不改代码块结构（Python 缩进敏感，
自动内联会破坏结构 —— 这是踩过的坑）。

```python
# 替换前
if isinstance(self, NanFengH3MultiReferenceGeneratorV8) and bool(kwargs.get("启用H3潜空间放大二采", False)):
# 替换后
if True and bool(kwargs.get("启用H3潜空间放大二采", False)):
# 再简化
if bool(kwargs.get("启用H3潜空间放大二采", False)):
```

**结果**：2596 → 2590 行。行数变化小是**正确的** —— 只删了版本判断，
没删功能代码。恒假分支保留 `if False:` 标记 + 注释，方便日后追溯。

### 3.2 保留 / 删除的分支（关键理解）

**对 V15 真正生效的 8 个分支**（保留）：

| 分支 | 作用 |
|---|---|
| V3 条件相位屏障 | 让 CLIP+双VAE 先于 DiT 加载 |
| V3 单加速分支互斥 | Sol / T8 / Sage 三选一 |
| V4 原图比例 | `画面比例 == "原图比例"` |
| V7 Sigma策略 | 用户显式指定 Sigma |
| V8.1 低峰值放大 | CPU 转精度再上卡，避免峰值 |
| V9 SLA | 稀疏注意力（需上游节点，本机缺） |
| V9 独立LoRA槽 | LoRA1-8 逐个启用 |
| V15 严格LoRA | `require_explicit=True` |

**对 V15 恒假的 5 个分支**（标注删除）：

| 分支 | 原因 |
|---|---|
| V4 Sigma调节 | V8.1 起由 `H3完整Sigma序列` 独立控制 |
| V4 双采样 | V5+ 已废弃 |
| V5 高清二采 | V7+ 已移除该实验分支 |
| V6 自动切家族 | V6+ 模式切换不改模型下拉 |
| V8 早期放大路径 | V8.1 改用低峰值放大器 |

### 3.3 移除 HTTP API 层

南风原包里有 5 个模块是**为它自己的 ComfyUI 前端服务的**：

| 模块 | 行数 | 用途 | 移除原因 |
|---|---|---|---|
| `storyboard_api.py` | 766 | 智能分镜（读 .env 调外部 LLM） | 改由 DSH 内部 LLM 实现 |
| `audio_drive_api.py` | 414 | 智能音频驱动（同上） | 同上 |
| `audio_media_api.py` | 78 | 音频波形 REST | 九章前端自己处理 |
| `model_refresh_api.py` | 43 | 模型列表刷新 | 九章从 object_info 拉 |
| `continuation_scheduler.py` | 287 | 进程内批次调度 | 九章有 job-runner |
| `web/` | 5438 | 节点 UI | 九章用自己的 SPA |

**总计移除 7026 行**，保留生成核心。

### 3.4 凭据机制归零

原实现要用户填 `.env`：

```ini
NANFENG_VISION_BASE_URL=
NANFENG_VISION_API_KEY=
...
```

**改造后完全不需要**：智能分镜走 `ctx.llm.stream()`（DSH 已登录的模型）。

---

## 4. 保留的路径（不改）

| 路径 | 原因 |
|---|---|
| `nanfeng_v15_context/` | ComfyUI/output 下的相对路径，被正则 `nanfeng_v15_context/[0-9a-f]{64}` 锁死 |
| `*-skill/` | 随代码分发 |
| `.nanfeng_v15_jobs` | 已随 scheduler 移除 |

---

## 5. 必须修复的环境适配（host 侧 graph.js）

改造后仍在 `host/bridge/vendors/nanfeng/graph.js` 里做三件事：

### ① 类型强制 `coerceTypes()`

南风有一批**数值型 COMBO**：

```
「尺寸倍数」      options = [32]
「H3潜空间对齐」  options = [2, 4, 8, 16, 32]
「参考图最长边」  options = [1280, 1536, 1920, 2560, 3072, 3840]
```

ComfyUI 做**严格类型比较**，字符串 `'32'` ≠ 整数 `32`，报 `value_not_in_list`。

### ② 环境修正 `applyFixes()`

| 参数 | 上游默认 | 我们的值 | 原因 |
|---|---|---|---|
| `SageAttention` | `auto` | `disabled` | 本机未装 SageAttention |
| `H3专用注意力` | `H3专用Sage加速` | `关闭` | **第二个独立开关**，同样触发 Sage Patch |
| `TRT视频解码引擎` | `''` | `None` | 空串不是合法选项 |

> ⚠️ `SageAttention` 与 `H3专用注意力` 是两个**独立参数**，必须都改。

### ③ 输出节点接线

```javascript
workflow['2'] = {
  class_type: 'VHS_VideoCombine',
  inputs: {
    images: ['1', 0],   // 南风 IMAGE 输出
    audio:  ['1', 1],   // 南风 AUDIO 输出
    frame_rate: 24,
    filename_prefix: `jz_${jobId}`,
    format: 'video/h264-mp4',
    save_output: true,
  },
};
```

不接输出节点 → ComfyUI 报 `prompt_no_outputs`。

---

## 6. 验证记录

### A/B 对比（改造版 vs 原版，2026-11-17）

| 项 | 原版 | 改造版 | 结论 |
|---|---|---|---|
| 参数数 | 217 | **217** | ✅ 一致 |
| 单镜 | 864×480/124帧/5.167s | 同 | ✅ 一致 |
| 二采 | 1472×832/124帧 | 同 | ✅ 一致 |
| 续写 | latent 链 3 clips | 同 | ✅ 一致 |
| 耗时 | 116s | 111s | ✅ 在波动范围 |

### 性能优化：`--use-ck-attention`

| 模式 | bench1 | bench2 | bench3 | 平均 |
|---|---|---|---|---|
| 无 ck-attention | 116s | 116s | 116s | 116s |
| 有 ck-attention | 96s | 96s | 106s | **99s** |

**提速 14.7%，零额外依赖**（`comfy-kitchen` 随 ComfyUI 安装）。

> **为什么不用 SageAttention**：需要 `triton-windows`（约 200 MB）+ 
> `sageattention` wheel（20-50 MB），且本机无 nvcc 无法源码编译，
> 预编译 wheel 主要面向 py311/Blackwell。
> 与「上 GitHub、安装时不要下载一大堆包」的目标冲突。

---

## 7. 与九章侧的接口

```
host/services/nanfeng/
├─ schema.js       221 参数定义（A-L 分组）
├─ graph.js        图组装 + 类型强制 + 环境修正
├─ presets.js      7 个内置预设 + 三层合并
├─ continuation.js 续写批次编排（含 folder 算法复刻）
├─ storyboard.js   智能分镜（移植南风提示词资产，接 DSH LLM）
├─ dsh-llm.js      DSH LLM 桥接（零凭据）
└─ index.js        门面：buildShotWorkflow()
```

**调用链**：

```
镜头卡 → nanfeng/index.js → buildShotWorkflow()
       → ComfyUI /prompt → NanFengH3MultiReferenceGeneratorV15
       → GraphBuilder 展开 ~40 节点 → 出片
```
