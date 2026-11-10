# -*- coding: utf-8 -*-
"""生成单文件可视化速览 HTML（无外部依赖）。"""
import io
import os

BASE = r"F:\AI视频"
OUT = os.path.join(BASE, "AI视频调研速览.html")

conclusions = [
    ("01", "OpenAI 已实质退出", "Sora App 2026-04-26 停服、API 2026-09-24 关闭，Sora 3 从未发布。日均约 1,500 万美元成本 vs C 端变现能力，社交化 AI 视频烧钱模式受挫。"),
    ("02", "中国模型质量上位", "AA 文生视频（带音频）前十中国占五席、前五占三席：Wan 3.0 第一（1172）、MiniMax H3 第三（1160，开源）、Seedance 2.5 第五（1155）；I2V 第一 Seedance 2.5，编辑第一 Wan 3.0。"),
    ("03", "开源追到 1—3 名内", "开放权重第一 H3（1160）与闭源第一 Wan 3.0（1172）仅差 12 Elo；但 H3 排除美/欧/英/韩本地部署，最强 Wan 3.0 已闭源。"),
    ("04", "旗舰标配已换代", "原生音视频 + 单次 30 秒 + 多模态参考 + 编辑不漂移：Seedance 2.5（50 项参考）、Kling 4.0（30 秒/续拍 2 分钟）、Wan 3.0（20 项素材）。"),
    ("05", "价格进入分币级", "HeyGen $0.01/秒、Grok Lite $0.02/秒、Vidu Q4 0.09 元/秒起，而 Veo 3.1 仍 $0.40/秒。质量与价格相关性显著变弱。"),
    ("06", "通用大模型跨界", "Claude Opus 5.5 用代码渲染视频（Vibe Video，单条约 $2 级）、GPT-6 Astra 操作 Blender/Unreal——“确定性编程”对“概率性抽卡”发起非对称竞争。"),
    ("07", "成本转移到返工", "60 秒成片现金成本约 ¥70—250（云 API）/$50—200（专业 SaaS）；但人工审片/返工占总工时 30%—50%，这是 AI 替代不了的部分。"),
    ("08", "AI 短剧增产不增收", "2026 年 AI 剧/漫剧市场预计 400 亿元（+138%）、用户超 6 亿；播放破亿率仅 0.48%、98.7% 项目上线半年不回本。"),
    ("09", "收入涨、成本涨更快", "可灵 2025 年营收约 11 亿元、净亏 19 亿元；字节 2026 资本开支超 2,000 亿元、快手约 260 亿元；C 端订阅是小池子，B 端/广告/短剧是大池子。"),
    ("10", "合规成为硬门槛", "中国 AI 标识强执行（6 类必选标签、微信带货限流）、欧盟 AI Act 第 50 条 2026-08-02 适用、美国州法拼图——AI 标识/肖像声音/版权素材是三条红线。"),
]

aa_t2v = [
    ("1", "Wan 3.0", "1172", "2026-08", "$12.00/min", "中国 · 闭源"),
    ("2", "Utopai X", "1169", "2026-09", "无 API", "美国 · 闭源"),
    ("3", "MiniMax H3 (768p)", "1160", "2026-07", "$4.80/min", "中国 · 开放权重"),
    ("4", "FLUX 3 Max", "1156", "2026-10", "$4.35/min", "德国 · 闭源"),
    ("5", "Dreamina Seedance 2.5", "1155", "2026-07", "$34.12/min", "中国 · 闭源"),
    ("6", "HeyGen Video 1", "1153", "2026-10", "$2.40/min", "美国 · 闭源"),
    ("7", "MiniMax H3 Max", "1148", "2026-08", "$9.60/min", "中国 · 闭源"),
    ("8", "FLUX 3", "1139", "2026-07", "$17.40/min", "德国 · 闭源"),
    ("9", "Dreamina Seedance 2.0", "1136", "2026-03", "$22.45/min", "中国 · 闭源"),
    ("10", "Gemini Omni Flash 1.1", "1129", "2026-08", "$9.12/min", "美国 · 闭源"),
    ("22", "Veo 3.1", "961", "2026-01", "$24.00/min", "美国 · 闭源"),
]

prices = [
    ("HeyGen Video 1", "$0.01/秒（促销）", "480p-2K · 原生音频", "数字人升维"),
    ("Grok Imagine 1.5 Lite", "$0.02/秒起", "480p-1080p", "低价社交"),
    ("Vidu Q4 Preview", "0.09 元/秒起", "2K/4K", "国内旗舰最低价之一"),
    ("Wan 3.0", "0.21 元/秒（480P）", "480P-1080P · 音频", "AA T2V 第一"),
    ("MiniMax H3", "$0.08/秒（768P）", "768P-2K · 立体声", "开放权重第一"),
    ("Kling 4.0", "$0.157/秒（720P）", "30 秒/4K HDR", "长镜头/续拍"),
    ("Gemini Omni 1.1", "$0.101/秒（720p）", "720p-4K · 音频", "对话式编辑"),
    ("Runway Gen-4.5", "$0.12/秒", "720p/10s", "编辑工作流"),
    ("Seedance 2.5", "$34.12/min（AA）", "30 秒/50 项参考", "高端叙事"),
    ("Veo 3.1", "$0.40/秒（含音频）", "720p/1080p/4K", "价格最高档之一"),
]

platforms = [
    ("即梦 AI", "字节/剪映", "模型+剪映+抖音闭环；2026Q1 MAU 1,352.5 万（赛道第一）", "个人/商家", "69 元/月起"),
    ("可灵 AI", "快手", "30 秒/4K；用户 1 亿；估值 180 亿美元", "进阶/专业", "58 元/月起"),
    ("海螺 AI", "MiniMax", "H3 半开源；API $0.08/秒起", "开发者/进阶", "$9.99/月起"),
    ("通义万相", "阿里", "Wan 3.0 AA 双榜第一；百炼 API", "开发者/企业", "按量 0.42 元/秒起"),
    ("Vidu", "生数科技", "参考一致性；Q4 Preview 0.09 元/秒起", "短剧/动漫", "$8.25/月起"),
    ("PixVerse", "爱诗科技", "模板/特效；注册 1.5 亿、177 国", "海外创作者", "积分制"),
    ("剪映 / CapCut", "字节", "移动端 MAU 7.36 亿；AI 成片/字幕/数字人", "所有创作者", "25—79 元/月"),
    ("Google Flow", "Google", "Veo+Omni+YouTube 生态；AI Plus $4.99 起", "海外创作者", "$4.99/月起"),
    ("Runway", "Runway", "Gen-4.5/Aleph 2.0；6,000 万+创作者", "专业/工作室", "$15/月起"),
    ("Higgsfield", "Higgsfield", "多模型聚合+爆款模板；估值 54 亿美元", "UGC/广告", "按模型秒价"),
    ("HeyGen", "HeyGen", "数字人/口播；ARR 2 亿美元", "跨境/培训", "$29/月起"),
    ("Synthesia", "Synthesia", "企业数字人；估值 40 亿美元", "企业培训", "$29/月起"),
]

workflows = [
    ("方案一：开源本地", "¥5—20/条", "6—12 小时", "720p—1080p", "已有 RTX 4090/32GB 设备、愿意折腾的创作者", "ComfyUI + Wan2.2-TI2V-5B / LTX-2.5 + LightX2V 4 步 + 剪映"),
    ("方案二：云 API", "¥70—250/条", "2—5 小时", "1080p", "中小团队、批量做号", "豆包写脚本 → 即梦/LiblibAI（Seedance 2.0 Mini）→ 剪映/Hedra → 剪映成片"),
    ("方案三：专业 SaaS", "$50—200/条", "1—3 小时", "1080p—4K", "品牌方、MCN、影视/广告外包", "Claude/GPT 分镜 → 可灵/Seedance/Runway → Aleph 2.0 精修 → 视频增强软件 → DaVinci"),
]

trends = [
    ("Agent 化", "从生成工具到交付工作流，2027 年按成片/任务计费"),
    ("实时化", "实时生成/世界模型先落地数字人、社交、游戏"),
    ("长视频", "30 秒—1 分钟成标配，分钟级仍需分段+人审"),
    ("原生音频", "音视频一体成为模型默认能力"),
    ("平台内置", "分发即生产，独立 App 被平台内嵌挤压"),
    ("版权授权化", "从诉讼威胁到付费放行，IP 授权库出现"),
    ("价格分层", "按秒/积分+价格战并行，免费额度收缩"),
    ("开源追赶", "开源追画质、闭源卖工作流，时间差 3—6 个月"),
    ("算力决胜", "算力自给型平台 vs 买模型/租算力型应用"),
    ("双重挤压", "合规内生化 + 通用大模型跨界，纯工具受挤压"),
]

timeline = [
    ("2024-02", "Sora 技术报告，视频生成进入“世界模拟器”预期"),
    ("2025-02", "阿里开源 Wan2.1（Apache-2.0），开源进入可用阶段"),
    ("2025-05", "Veo 3 原生音频 + Flow 上线，音视频一体元年"),
    ("2025-09", "Sora 2 + Sora App 上线，上线两天 16.4 万下载"),
    ("2025-11", "HunyuanVideo 1.5 开源；Getty v Stability 判决"),
    ("2026-02", "可灵 3.0、Seedance 2.0 发布，国产进入音画一体"),
    ("2026-03", "Sora 宣布关闭；即梦 15 秒视频积分 45→120"),
    ("2026-05", "Gemini Omni 发布；中国 6 类 AI 必选标签"),
    ("2026-07", "可灵近 30 亿美元融资；Seedance 2.5 发布（30 秒/50 项）"),
    ("2026-08", "MiniMax H3 开源；Wan 3.0 发布（未开源）；EU AI Act 第 50 条"),
    ("2026-09", "Claude Opus 5.5（Vibe Video）、GPT-6 Astra"),
    ("2026-10", "Kling 4.0 上线；Sora 转让洽谈"),
    ("2026-11", "可灵 198.02 亿元增资交割，估值 180 亿美元"),
]

html_head = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI 视频 C 端制作全景调研 · 速览（2026-11）</title>
<style>
  :root{
    --bg:#0b1220; --panel:#111a2c; --panel2:#16233a; --line:#24344f;
    --txt:#e8eef8; --muted:#9db0c9; --accent:#4ea1ff; --accent2:#7cf2c8;
    --warn:#ffcc66; --grad:linear-gradient(120deg,#1e3a8a 0%,#0e7490 55%,#065f46 100%);
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--txt);font-family:"Microsoft YaHei","PingFang SC",system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.65}
  a{color:var(--accent);text-decoration:none}
  header{background:var(--grad);padding:56px 28px 42px;position:relative;overflow:hidden}
  header:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 80% 20%,rgba(124,242,200,.18),transparent 45%)}
  .wrap{max-width:1180px;margin:0 auto;padding:0 22px}
  h1{font-size:clamp(26px,4vw,42px);margin:0 0 10px;letter-spacing:.5px}
  .sub{color:#d6e6ff;font-size:clamp(14px,2vw,17px);max-width:860px}
  .badges{margin-top:18px;display:flex;gap:10px;flex-wrap:wrap}
  .badge{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);padding:5px 12px;border-radius:999px;font-size:13px}
  nav{position:sticky;top:0;z-index:20;background:rgba(11,18,32,.94);border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}
  nav .wrap{display:flex;gap:6px;overflow:auto;padding:8px 22px}
  nav a{color:var(--muted);padding:8px 12px;border-radius:8px;font-size:14px;white-space:nowrap}
  nav a:hover{background:var(--panel2);color:var(--txt)}
  section{padding:44px 0 8px}
  h2{font-size:clamp(20px,3vw,28px);margin:0 0 6px;display:flex;align-items:center;gap:10px}
  h2 .dot{width:10px;height:26px;border-radius:4px;background:var(--accent2);display:inline-block}
  .lead{color:var(--muted);margin:0 0 22px;font-size:14px}
  .grid{display:grid;gap:14px}
  .g2{grid-template-columns:repeat(auto-fit,minmax(340px,1fr))}
  .g3{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 18px 16px;transition:.2s}
  .card:hover{border-color:#3b5b8a;transform:translateY(-2px)}
  .card .num{font-size:12px;color:var(--accent2);letter-spacing:2px;font-weight:700}
  .card h3{margin:6px 0 8px;font-size:17px}
  .card p{margin:0;color:var(--muted);font-size:13.5px}
  .tag{display:inline-block;font-size:11.5px;padding:2px 8px;border-radius:999px;background:rgba(78,161,255,.14);color:#9ccbff;margin:2px 4px 2px 0}
  .tag.g{background:rgba(124,242,200,.12);color:var(--accent2)}
  .tablebox{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:auto;margin-top:6px}
  table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:680px}
  th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
  th{background:var(--panel2);color:#cfe0f7;font-weight:600;font-size:12.5px;letter-spacing:.4px;position:sticky;top:0}
  tr:hover td{background:rgba(78,161,255,.05)}
  td.n{font-variant-numeric:tabular-nums;white-space:nowrap}
  .price{color:var(--accent2);font-weight:600}
  .rank{color:var(--warn);font-weight:700}
  .note{font-size:12.5px;color:var(--muted);margin-top:10px}
  .flow{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
  .flow .card{display:flex;flex-direction:column}
  .flow .big{font-size:22px;font-weight:700;color:var(--accent2);margin:6px 0}
  .flow ul{margin:8px 0 0;padding-left:18px;color:var(--muted);font-size:13px}
  .flow li{margin:4px 0}
  .trends{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
  .trend{display:flex;gap:12px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
  .trend .idx{color:var(--accent2);font-weight:800;font-size:13px;min-width:26px;padding-top:2px}
  .trend b{font-size:14px}
  .trend span{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}
  .tl{position:relative;margin:10px 0 0;padding-left:22px}
  .tl:before{content:"";position:absolute;left:6px;top:4px;bottom:4px;width:2px;background:linear-gradient(var(--accent),var(--accent2))}
  .tl .item{position:relative;padding:7px 0 7px 8px;font-size:13.5px}
  .tl .item:before{content:"";position:absolute;left:-21px;top:14px;width:9px;height:9px;border-radius:50%;background:var(--accent2);box-shadow:0 0 0 3px rgba(124,242,200,.15)}
  .tl time{color:var(--accent);font-weight:700;margin-right:10px;font-variant-numeric:tabular-nums}
  footer{border-top:1px solid var(--line);margin-top:48px;padding:30px 0 44px;color:var(--muted);font-size:13px}
  .kpi{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin:8px 0 4px}
  .kpi .k{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px}
  .kpi .v{font-size:22px;font-weight:800;color:var(--accent2);font-variant-numeric:tabular-nums}
  .kpi .l{font-size:12px;color:var(--muted);margin-top:2px}
  .two{display:grid;gap:20px;grid-template-columns:1fr 1fr}
  @media(max-width:860px){.two{grid-template-columns:1fr}}
  .callout{border-left:3px solid var(--warn);background:rgba(255,204,102,.07);padding:12px 16px;border-radius:0 10px 10px 0;color:#ffe2a8;font-size:13.5px;margin-top:14px}
  .links a{display:inline-block;background:var(--panel2);border:1px solid var(--line);padding:7px 12px;border-radius:9px;margin:4px 6px 0 0;font-size:13px}
  .links a:hover{border-color:var(--accent)}
</style>
</head>
<body>
<header>
  <div class="wrap">
    <h1>AI 视频 C 端制作全景调研 · 速览</h1>
    <div class="sub">模型（开源→闭源）· 技术 · 工具 · 平台 · 市场 · 合规 —— 基于 2026 年 11 月 3 日最新公开信息，覆盖 40+ 模型、30+ 工具、30+ 平台。</div>
    <div class="badges">
      <span class="badge">数据截止 2026-11-03</span>
      <span class="badge">主报告 8.2 万字</span>
      <span class="badge">400+ 条来源</span>
      <span class="badge">AA 榜单当日快照</span>
    </div>
  </div>
</header>
<nav><div class="wrap">
  <a href="#conclusions">十条结论</a>
  <a href="#numbers">关键数字</a>
  <a href="#rank">AA 榜单</a>
  <a href="#prices">价格</a>
  <a href="#platforms">平台</a>
  <a href="#workflow">三档工作流</a>
  <a href="#trends">十大趋势</a>
  <a href="#timeline">时间线</a>
  <a href="#files">文件</a>
</div></nav>
"""

html_tail = """
<footer><div class="wrap">
  <p><b>说明</b>：本页为主报告《AI视频C端制作全景调研报告（2026年11月版）》的可视化速览，数据与口径以主报告为准。榜单为 Artificial Analysis 2026-11-03 快照（2026-09 重构，新旧 Elo 不可比）；价格随区域/活动变动，下单前请以官方页面复核。</p>
  <p>完整内容：<a href="AI视频C端制作全景调研报告.md">主报告 Markdown</a> ｜ <a href="数据表/AI视频模型与平台对比表.xlsx">配套数据表 XLSX</a> ｜ <a href="README.md">README 索引</a></p>
  <p>© 2026-11-03 · DeepSeek Harness 多智能体协作完成（5 个方向并行调研 + Lead 交叉核验）</p>
</div></footer>
</body>
</html>
"""


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


parts = [html_head]

# 结论卡片
parts.append('<section id="conclusions"><div class="wrap"><h2><span class="dot"></span>执行摘要 · 十条关键结论</h2>'
             '<p class="lead">2026 年 11 月：AI 视频 C 端制作已从“能不能生成”进入“能不能稳定、便宜、可编辑地做成一条能发布的片子”。</p><div class="grid g2">')
for num, title, desc in conclusions:
    parts.append('<div class="card"><div class="num">结论 %s</div><h3>%s</h3><p>%s</p></div>' % (num, esc(title), esc(desc)))
parts.append('</div></div></section>')

# 关键数字
kpis = [
    ("10.4 亿美元", "2026 全球 AI 视频生成器软件市场（窄口径）"),
    ("77 亿美元", "2026 AI 视频模型行业收入（宽口径，券商）"),
    ("7 亿+", "2026H1 中国生成式 AI 用户"),
    ("6 亿+", "2026H1 中国 AI 短剧用户"),
    ("400 亿元", "2026 中国 AI 剧/漫剧市场（+138%）"),
    ("180 亿美元", "可灵 AI 投后估值（2026-11 增资交割）"),
    ("¥70—250", "一条 60 秒成片的云 API 现金成本"),
    ("12 Elo", "开源第一 H3 与闭源第一 Wan 3.0 的差距"),
]
parts.append('<section id="numbers"><div class="wrap"><h2><span class="dot"></span>关键数字</h2>'
             '<p class="lead">引用时请注明口径：软件市场、模型产业收入、C 端付费是三个不同的池子。</p><div class="kpi">')
for v, l in kpis:
    parts.append('<div class="k"><div class="v">%s</div><div class="l">%s</div></div>' % (esc(v), esc(l)))
parts.append('</div></div></section>')

# AA 榜单
parts.append('<section id="rank"><div class="wrap"><h2><span class="dot"></span>Artificial Analysis 榜单快照（2026-11-03）</h2>'
             '<p class="lead">文生视频（带音频）v2.1 · 中国模型前十占五席、前五占三席；开放权重第一为 MiniMax H3。</p><div class="tablebox"><table>'
             '<thead><tr><th>排名</th><th>模型</th><th>Elo</th><th>发布</th><th>AA 价格</th><th>国别 / 开源</th></tr></thead><tbody>')
for rank, model, elo, rel, price, tag in aa_t2v:
    cls = ' class="rank"' if rank == "1" else ""
    parts.append('<tr><td%s>#%s</td><td><b>%s</b></td><td class="n">%s</td><td class="n">%s</td><td class="n price">%s</td><td>%s</td></tr>'
                 % (cls, rank, esc(model), elo, esc(rel), esc(price), esc(tag)))
parts.append('</tbody></table></div>'
             '<p class="note">注：AA 2026-09 重构榜单（拆分带音频/静音、新增编辑榜），新旧 Elo 不可比；完整榜单见主报告第 3 章与 XLSX「AA榜单快照」。</p>'
             '</div></section>')

# 价格
parts.append('<section id="prices"><div class="wrap"><h2><span class="dot"></span>价格对比：从 $0.01/秒到 $0.40/秒</h2>'
             '<p class="lead">质量与价格的相关性显著变弱；比较成本必须统一“分辨率 × 时长 × 是否带音频 × 重试率”。</p><div class="tablebox"><table>'
             '<thead><tr><th>模型</th><th>最低公开报价</th><th>分辨率 / 音频</th><th>备注</th></tr></thead><tbody>')
for m, p, spec, note in prices:
    parts.append('<tr><td><b>%s</b></td><td class="price n">%s</td><td>%s</td><td>%s</td></tr>' % (esc(m), esc(p), esc(spec), esc(note)))
parts.append('</tbody></table></div><p class="note">AA 的 $/分钟为 1080p 基准折算的 API 成本，不等于国内刊例价。</p></div></section>')

# 平台
parts.append('<section id="platforms"><div class="wrap"><h2><span class="dot"></span>C 端平台速览</h2>'
             '<p class="lead">国内“即梦 × 可灵”双寡头 + 多强跟随；海外 Google 生态最全、聚合/数字人赛道崛起。</p><div class="tablebox"><table>'
             '<thead><tr><th>平台</th><th>公司</th><th>定位 / 亮点</th><th>适合人群</th><th>价格参考</th></tr></thead><tbody>')
for name, comp, desc, user, price in platforms:
    parts.append('<tr><td><b>%s</b></td><td>%s</td><td>%s</td><td>%s</td><td class="n">%s</td></tr>' % (esc(name), esc(comp), esc(desc), esc(user), esc(price)))
parts.append('</tbody></table></div></div></section>')

# 工作流
parts.append('<section id="workflow"><div class="wrap"><h2><span class="dot"></span>三档 60 秒成片工作流与成本</h2>'
             '<p class="lead">按“脚本→分镜→生成→配音→口型→超分→剪辑”链路，含 2 倍重试系数。</p><div class="flow">')
for name, cost, time, quality, user, tools in workflows:
    parts.append('<div class="card"><h3>%s</h3><div class="big">%s / 条</div><ul>'
                 '<li>耗时：%s</li><li>画质：%s</li><li>适合：%s</li><li>工具：%s</li></ul></div>'
                 % (esc(name), esc(cost), esc(time), esc(quality), esc(user), esc(tools)))
parts.append('</div><div class="callout">成本已进入“几十元到几百元”区间，真正的瓶颈转移到人工审片、一致性与返工（占总工时 30%—50%）。</div></div></section>')

# 趋势
parts.append('<section id="trends"><div class="wrap"><h2><span class="dot"></span>2026Q4—2027 十大趋势</h2>'
             '<p class="lead">Agent 化、实时化、平台内置化、版权授权化、通用模型跨界五股力量叠加。</p><div class="trends">')
for i, (t, d) in enumerate(trends, 1):
    parts.append('<div class="trend"><div class="idx">%02d</div><div><b>%s</b><span>%s</span></div></div>' % (i, esc(t), esc(d)))
parts.append('</div></div></section>')

# 时间线
parts.append('<section id="timeline"><div class="wrap"><h2><span class="dot"></span>2024—2026 关键节点</h2>'
             '<p class="lead">从“技术演示”到“可交付生产”的三年。</p><div class="tl">')
for t, e in timeline:
    parts.append('<div class="item"><time>%s</time>%s</div>' % (esc(t), esc(e)))
parts.append('</div></div></section>')

# 文件
parts.append('<section id="files"><div class="wrap"><h2><span class="dot"></span>完整交付物</h2>'
             '<p class="lead">所有文件位于 F:\\AI视频 工作目录。</p><div class="links">'
             '<a href="AI视频C端制作全景调研报告.md">主报告（Markdown，8.2 万字）</a>'
             '<a href="数据表/AI视频模型与平台对比表.xlsx">配套数据表（XLSX，11 个工作表）</a>'
             '<a href="README.md">README 索引</a>'
             '<a href="研究资料/01-国际闭源模型.md">分方向研究 01—05</a>'
             '</div><p class="note">主报告章节：行业全景 / 技术 / 模型 / 工具 / 平台 / 市场 / 合规 / 趋势 / 结论与附录。</p></div></section>')

parts.append(html_tail)

html = "".join(parts)
with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write(html)
print("written:", OUT)
print("chars:", len(html))
