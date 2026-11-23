# cu128 能不能修？—— 实测结论

> 承接 `docs/MEMORY-ANALYSIS.md` 第五节
> 分析时间：2026-11-23
> **本文推翻了上一轮报告里「量化算力腰斩 2.3 倍」的说法**，原因见第一节

---

## 一、先更正上一轮的错误

上一轮我写「eager 比 cuda 后端慢 2.3 倍」，那个数字是**冷启动噪声**，不成立。
用 `torch.utils.benchmark` 做稳态测量（min_run_time=2s）后：

| 路径 | 4096 tokens, 5120→13824 | 结论 |
|---|---|---|
| eager 后端 | 17.7 ms | 基线 |
| cuda 后端（强制） | 18.7 ms | **一样，甚至略慢** |

**强制启用 cuda 后端没有任何收益**，因为它根本不处理 int8 GEMM（见第三节）。

真正的发现是另一件事，而且比原判断更有价值：

| 路径 | 耗时 | 相对 |
|---|---|---|
| eager int8_linear（**当前在用**） | 17.7 ms | 1.00× |
| `torch._int_mm` 原生 int8 | 11.5 ms | **1.55× 更快** |
| 反量化成 bf16 再乘 | 9.4 ms | **1.87× 更快** |

**int8 量化路径在本机反而是最慢的那条。** 继续追 cublasLt 的性价比很低。

---

## 二、cu130 检查到底是什么

`comfy/quant_ops.py:25-28`：

```python
cuda_version = tuple(map(int, str(torch.version.cuda).split('.')))
if cuda_version < (13,):
    ck.registry.disable("cuda")
    logging.warning("WARNING: You need pytorch with cu130 or higher ...")
```

**它只是一个 Python 层的开关**，不是二进制不兼容。实测：

```
import comfy_kitchen.backends.cuda   → IMPORT OK
registry.enable("cuda")              → available: True
```

也就是说，把这个判断绕过去，CUDA 后端能加载、能注册。但——

---

## 三、绕过这个检查没有用：它根本不做 int8 GEMM

`int8_linear` 在 cuda 后端里的注册条件是：

```python
# comfy_kitchen/backends/cuda/__init__.py:248
_CUBLASLT_AVAILABLE = _EXT_AVAILABLE and getattr(_C, "HAS_CUBLASLT", False)

# :5278
if _CUBLASLT_AVAILABLE:
    constraints["int8_linear"] = FunctionConstraints(...)
```

本机实测：

```
_C.EXT_AVAILABLE  = True
_C.HAS_CUBLASLT   = False        ← 卡在这里
```

`HAS_CUBLASLT` 是 **C++ 扩展编译期写死的常量**，不是运行时探测。
二进制里确实有 `cublasLtMatmul` / `cublasLtCreate` 符号（各 16 / 2 次），
但构建这份 wheel 时没有把 `HAS_CUBLASLT` 置真。

结果：cuda 后端能注册，但 `int8_linear` 不在它的能力集里，自动回退到 eager。
实测确认：

```
registry.is_available("cuda")        → True
"int8_linear" in cuda capabilities   → False
registry.get_capable_backend(...)    → eager
```

**cuda 后端比 eager 多出来的能力只有这些**（全与 H3 无关）：

```
closest_hit_on_mesh, closest_point_on_mesh, connected_components,
delaunay3d, edge_collapse_checks, mesh_bvh, min_cut
```

那是 3D 网格算子，H3 视频生成一个都用不到。

### 所以升级 cu130 会怎样

| 期待 | 实际 |
|---|---|
| int8 GEMM 变快 | ❌ 不会。`HAS_CUBLASLT` 仍是 False，仍回退 eager |
| comfy-kitchen 后端可用 | ⚠️ 只是不再被 `quant_ops.py` 主动 disable，但 int8 仍不走它 |
| 其他改善 | 可能有少量 kernel 优化，但与你观察到的「20-25 分钟/段」无关 |

**结论：升级 cu130 对本问题收益接近于零，成本却是重装 3-5GB 的 torch 全套 +
重新验证 207 项冒烟 + 承担版本变动风险。不建议为了这个目的升级。**

---

## 四、真正该改的地方：文本编码器走的是「逐层反量化」

### 关键证据

`comfy/sd1_clip.py:114`：

```python
if quant_config is not None:
    operations = comfy.ops.mixed_precision_ops(quant_config, dtype, full_precision_mm=True)
    #                                                                     ^^^^^^^^^^^^^^^^^^
```

文本编码器被**硬编码**成 `full_precision_mm=True`。

而 `use_quantized_matmul()` 只在这个上下文里把 flag 压回 False
（`comfy/sd.py:489`），**且只包裹 `generate()` 路径**：

```python
with model_management.cuda_device_context(device), comfy.ops.use_quantized_matmul(self.cond_stage_model, device):
    return self.cond_stage_model.generate(...)
```

H3 用的是 encode 不是 generate，所以**文本编码器的每一层都在做：
反量化 int8 权重 → bf16 → matmul**。

而 `MiniMaxH3TEModel` 是 25.9GB / 250 个 group member 的大家伙，每段都要完整跑一遍。

### 这条路径的实际代价

在 TE 的真实 token 规模（约 512）下：

| 路径 | 耗时 | 吞吐 |
|---|---|---|
| 反量化 + bf16 mm（TE 现状） | 2.68 ms | 27.0 TFLOP/s |
| int8 量化 mm（DiT 走这条） | 3.51 ms | 20.7 TFLOP/s |

有意思的是：**反量化路径反而更快**。因为 eager 的 `int8_linear` 要额外做
per-row 量化（`quantize_int8_rowwise`）+ 分块反缩放（见
`comfy_kitchen/backends/eager/quantization.py:985-1081`），这些开销盖过了
int8 GEMM 省下的带宽。

所以 TE 目前的写法（full_precision_mm）在**性能上是对的**，不是 bug。

---

## 五、那么 20-25 分钟/段到底花在哪

综合三轮分析，单段耗时的构成大致是：

| 环节 | 量级 | 依据 |
|---|---|---|
| 文本编码器完整跑一遍（25.9GB） | **8-10 分钟** | 日志 `25882MB Staged` + TE 前向 |
| 扩散模型 staged + 8 步采样 | 6-8 分钟 | 日志 `19983MB Staged`，134s/step × 8 |
| 双 VAE 编解码（4.965GB × 3 次） | 2-3 分钟 | 日志 Video VAE 解码 42-45 秒/次 |
| **每段重复 staged 66GB 的 IO** | 2-5 分钟 | `Model Initializing` 2:16 |

**最大头是「每段重复把 66GB 权重从 NVMe 读一遍」+「TE 完整跑一遍」**，
不是量化算子慢。

---

## 六、可选的三个动作（按性价比排序）

### ① 换更小的文本编码器（收益最大，成本最低）

本机 `models/text_encoders/` 只有 int8 的 25.3GB 版本。社区对 32GB 内存机器的建议是
换 **NVFP4 版（约 15.7GB）**：

- 每段少读 10GB，少占 10GB 内存
- TE 前向本身也快约 1/3
- 只是换个文件，`resolveModelNames()` 会自动探测，不需要改代码

**风险**：需要下载；NVFP4 在该卡（sm_89）上走 emulated 路径，精度需实测。

### ② 摘掉两个释放屏障（收益大，需长跑验证）

`NanFengH3ReleaseBeforeConditionLoadersV15` 和 `NanFengH3ReleaseBeforeSamplingV15`
导致每段 3 次 staged。摘掉预计降到 1-2 次，省 2-5 分钟/段。

**风险**：这是南风上游为 12GB 卡设计的保护，删掉有 OOM 回归风险。

### ③ 升级 cu130（**不推荐**）

理由见第三节：`HAS_CUBLASLT` 仍是 False，int8 仍回退 eager，收益接近于零。

---

## 七、如果仍想试 cu130，完整步骤与风险

仅当你出于其他原因想升级时参考。

```powershell
# 1) 备份现状（可回滚）
& 'F:\AI视频\ai-runtime\venv\Scripts\python.exe' -m pip freeze > F:\AI视频\ai-runtime\requirements-backup.txt

# 2) 卸载并重装（cu130 索引）
$py='F:\AI视频\ai-runtime\venv\Scripts\python.exe'
& $py -m pip uninstall -y torch torchvision torchaudio
& $py -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130

# 3) 验证
& $py -c "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available())"

# 4) 重启 ComfyUI 并跑冒烟
```

**风险清单**：

| 风险 | 说明 |
|---|---|
| comfy-kitchen 可能不兼容 | 它的 wheel 是针对特定 torch ABI 编译的，换 torch 主版本可能要重装 |
| 207 项冒烟要重跑 | 尤其 `schema.js 与 object_info 逐项一致` 这类集成项 |
| 回滚成本 | 需要按 `requirements-backup.txt` 重装回 cu128 |
| 收益 | 对本问题**接近于零**（见第三节） |

---

## 八、一句话总结

**cu128 可以改，但不该为了「提升量化算力」去改。**
因为本机的 int8 路径慢不是因为 CUDA 版本，而是因为
`comfy-kitchen` 的预编译 wheel 没开 `HAS_CUBLASLT`，且即使开了，
eager 实现本身也不比 bf16 慢多少（实测反量化路径还更快）。

真正值得做的是**换小一档的文本编码器**和**减少每段重复 staged**。
