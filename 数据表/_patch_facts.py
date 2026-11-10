# -*- coding: utf-8 -*-
"""对报告分节与分方向研究做事实纠偏：AA 榜单“前五占四席”应为“前十占五席、前五占三席”。
并为主报告追加“附录 D 关键时间线”。"""
import io
import os

BASE = r"F:\AI视频"
SEC = os.path.join(BASE, "研究资料", "报告分节")

def patch(path, pairs):
    with io.open(path, "r", encoding="utf-8") as f:
        text = f.read()
    for old, new in pairs:
        if old not in text:
            raise SystemExit("NOT FOUND in {}: {}".format(path, old[:60]))
        text = text.replace(old, new, 1)
    with io.open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print("patched:", path)

# 00 封面与执行摘要
patch(os.path.join(SEC, "00-封面与执行摘要.md"), [
    ("含 2024—2026 年 22 个关键节点",
     "附 2024—2026 年 30+ 关键节点时间线（见附录 D 与配套 XLSX）"),
    ("AA 文生视频（带音频）榜前五中中国占四席——阿里 Wan 3.0（1172）第一、MiniMax H3（1160，开源）第三、字节 Seedance 2.5（1155）第五",
     "AA 文生视频（带音频）榜前十中中国占五席、前五占三席——阿里 Wan 3.0（1172）第一、MiniMax H3（1160，开源）第三、字节 Seedance 2.5（1155）第五，H3 Max（1148）第七、Seedance 2.0（1136）第九"),
    ("AA T2V 前五中国占四席；可灵 2025 年营收约 11 亿元、净亏 19 亿元",
     "AA T2V 前十中国占五席（前五占三席）；可灵 2025 年营收约 11 亿元、净亏 19 亿元"),
])

# 01b 行业全景
patch(os.path.join(SEC, "01b-行业全景.md"), [
    ("AA 文生视频（带音频）前五中国占四席；图生视频第一、视频编辑第一均为中国模型。",
     "AA 文生视频（带音频）前十中国占五席（前五占三席）；图生视频第一、视频编辑第一均为中国模型。"),
])

# 03 模型篇
patch(os.path.join(SEC, "03-模型篇.md"), [
    ("四强+两梯队；AA 文生视频前五占四席；价格战+生态闭环",
     "四强+两梯队；AA 文生视频前十占五席（前五占三席）；价格战+生态闭环"),
    ("① 中国模型在 T2V 前五占四席、I2V 第一、编辑前二占二",
     "① 中国模型在 T2V 前十占五席、前五占三席，I2V 第一、编辑前二占二"),
])

# 09 结论建议
patch(os.path.join(SEC, "09-结论建议与附录.md"), [
    ("中国模型在质量榜全面上位（AA T2V 前五占四席、I2V 第一、编辑第一）",
     "中国模型在质量榜全面上位（AA T2V 前十占五席、前五占三席，I2V 第一、编辑第一）"),
])

# 01 国际闭源模型（分方向研究）
patch(os.path.join(BASE, "研究资料", "01-国际闭源模型.md"), [
    ("文本生视频（带音频）前5名中中国模型占4席（Wan 3.0 1172分第1、MiniMax H3 1160第3、Seedance 2.5 1155第5）",
     "文本生视频（带音频）前10名中中国模型占5席、前5名中占3席（Wan 3.0 1172分第1、MiniMax H3 1160第3、Seedance 2.5 1155第5、H3 Max 1148第7、Seedance 2.0 1136第9）"),
])

# XLSX 构建脚本中的备注
patch(os.path.join(BASE, "数据表", "_build_xlsx.py"), [
    ("中国模型在 AA T2V（带音频）前五占四席；",
     "中国模型在 AA T2V（带音频）前十占五席（前五占三席）；"),
])

# 追加“附录 D 关键时间线”，并把原 D/E 顺延为 E/F
p09 = os.path.join(SEC, "09-结论建议与附录.md")
with io.open(p09, "r", encoding="utf-8") as f:
    t = f.read()

timeline = """## 附录 D 关键时间线（2024—2026 精选）

| 时间 | 事件 | 意义 |
|---|---|---|
| 2024-02 | OpenAI 发布 Sora 技术报告（最长 60 秒、多镜头） | 视频生成进入“世界模拟器”预期 |
| 2024-06 | VBench 发布（CVPR 2024） | 首个系统化视频生成评测基准 |
| 2024-12-10 | Sora 作为独立产品上线，向 ChatGPT Plus/Pro 开放 | 视频生成首次进入主流订阅体系 |
| 2025-02-25 | 阿里开源 Wan2.1（14B/1.3B，Apache-2.0） | 开源视频模型进入“可用”阶段 |
| 2025-05-19 | Google I/O 发布 Veo 3（原生音频）、Flow 上线 | 音视频一体成为新一代标配 |
| 2025-06 | Disney/Universal 起诉 Midjourney | 好莱坞首次集体诉讼生成式 AI 公司 |
| 2025-07-28 | 阿里开源 Wan2.2（27B 总参 MoE） | 开源旗舰进入 MoE 时代 |
| 2025-09-30 | OpenAI 发布 Sora 2 并上线 Sora App（美加邀请制） | 上线两天 16.4 万下载；cameo/remix 引爆社交 |
| 2025-10-14 | Google 发布 Veo 3.1 / 3.1 Fast | 更强一致性与创意控制 |
| 2025-11-04 | 英国高等法院 Getty v Stability 判决 | 驳回次级版权侵权、部分商标胜诉，训练数据版权主张受挫 |
| 2025-11-20 | 腾讯开源 HunyuanVideo 1.5（8.3B） | 14GB 可跑的轻量开源旗舰 |
| 2025-12 | Disney 宣布向 OpenAI 投资 10 亿美元并授权 200+ 角色（3 年） | 版权授权化标志性交易 |
| 2026-01-08 | MiniMax、智谱同日登陆港交所 | 中国 AI 公司 IPO 窗口打开 |
| 2026-02-05 | 可灵 3.0 系列全球上线 | 国产模型进入“音画一体+影视级控制” |
| 2026-02-12 | 字节 Seedance 2.0 发布 | 统一多模态音视频、15 秒多镜头 |
| 2026-03-24/25 | OpenAI 宣布关闭 Sora 业务（4-26 App/网页停服） | C 端烧钱换规模模式受挫 |
| 2026-03 | 即梦上调 15 秒视频积分（45→120）引发投诉后部分回调 | 推理成本压力传导至 C 端定价 |
| 2026-05-19 | Google I/O 发布 Gemini Omni Flash | 统一多模态、对话式视频编辑 |
| 2026-05 | 中央网信办要求短视频平台 6 类必选标签 | 中国 AI 标识强执行 |
| 2026-07-02 | 快手公告可灵完成近 30 亿美元融资、投后 180 亿美元 | 全球视频大模型最大单轮融资 |
| 2026-07-31 | 字节 Seedance 2.5 发布（30 秒/50 项参考） | 原生 30 秒+全模态参考 |
| 2026-08-02 | 欧盟 AI Act 第 50 条透明度义务适用 | 全球最严 AI 内容标识制度落地 |
| 2026-08-03 | MiniMax H3 开放权重（33B 全模态） | 开源画质追到闭源前沿 1—3 名 |
| 2026-08-24 | 阿里 Wan 3.0 正式发布（30 秒/文档输入） | AA T2V/编辑双榜第一，但未开源 |
| 2026-09-22 | Anthropic 发布 Claude Opus 5.5，带火 Vibe Video | 通用大模型用代码渲染视频 |
| 2026-09-28 | OpenAI 发布 GPT-6 Astra | 可操作 Blender/Unreal，承担“导演+制片” |
| 2026-10-15 | 可灵 4.0 上线（30 秒/4K/续拍 2 分钟） | 国产模型进入原生 4K+长镜头阶段 |
| 2026-10-26 | OpenAI 洽谈将 Sora 转让给 Katzenberg 等新公司（未官宣） | Sora 或以专业影视工具形态重生 |
| 2026-11 | 可灵完成 198.02 亿元增资交割 | 国内 AI 视频最大单笔融资落地 |

"""

t = t.replace("## 附录 D 主要信息来源（节选）", timeline + "## 附录 E 主要信息来源（节选）", 1)
t = t.replace("## 附录 E 调研方法与局限", "## 附录 F 调研方法与局限", 1)
with io.open(p09, "w", encoding="utf-8", newline="\n") as f:
    f.write(t)
print("patched: 09 appendix timeline")

print("done")
