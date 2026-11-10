# -*- coding: utf-8 -*-
"""生成《AI视频模型与平台对比表.xlsx》：结构化数据配套主报告。"""
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

BASE = r"F:\AI视频"
OUT = os.path.join(BASE, "数据表", "AI视频模型与平台对比表.xlsx")

TITLE_FILL = PatternFill("solid", fgColor="1F3864")
HEAD_FILL = PatternFill("solid", fgColor="2E5C8A")
ZEBRA_FILL = PatternFill("solid", fgColor="EEF3F8")
SECTION_FILL = PatternFill("solid", fgColor="D9E2F3")
WHITE_BOLD = Font(name="微软雅黑", size=11, bold=True, color="FFFFFF")
TITLE_FONT = Font(name="微软雅黑", size=16, bold=True, color="FFFFFF")
BODY_FONT = Font(name="微软雅黑", size=10)
SMALL_FONT = Font(name="微软雅黑", size=9)
THIN = Side(style="thin", color="B4C6E7")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)


def make_sheet(wb, name, title, headers, rows, widths, first=False, notes=None):
    ws = wb.active if first else wb.create_sheet()
    ws.title = name
    ncol = len(headers)

    # 标题行
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=ncol)
    c = ws.cell(row=1, column=1, value=title)
    c.font = TITLE_FONT
    c.fill = TITLE_FILL
    c.alignment = CENTER
    ws.row_dimensions[1].height = 30

    # 表头
    for j, h in enumerate(headers, start=1):
        c = ws.cell(row=2, column=j, value=h)
        c.font = WHITE_BOLD
        c.fill = HEAD_FILL
        c.alignment = CENTER
        c.border = BORDER
    ws.row_dimensions[2].height = 24

    # 数据
    for i, row in enumerate(rows, start=3):
        for j, v in enumerate(row, start=1):
            c = ws.cell(row=i, column=j, value=v)
            c.font = BODY_FONT
            c.alignment = WRAP
            c.border = BORDER
            if i % 2 == 0:
                c.fill = ZEBRA_FILL
        ws.row_dimensions[i].height = 34

    # 列宽
    for j, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(j)].width = w

    # 备注
    r = len(rows) + 3
    if notes:
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=ncol)
        c = ws.cell(row=r, column=1, value=notes)
        c.font = SMALL_FONT
        c.fill = SECTION_FILL
        c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[r].height = 32

    ws.freeze_panes = "A3"
    ws.auto_filter.ref = f"A2:{get_column_letter(ncol)}{len(rows) + 2}"
    return ws


wb = Workbook()

# ---------------- 1. 说明 ----------------
ws = wb.active
ws.title = "说明"
ws.merge_cells("A1:F1")
c = ws["A1"]
c.value = "AI 视频 C 端制作全景调研 · 配套数据表"
c.font = Font(name="微软雅黑", size=18, bold=True, color="FFFFFF")
c.fill = TITLE_FILL
c.alignment = CENTER
ws.row_dimensions[1].height = 40

intro = [
    ("数据截止", "2026-11-03（北京时间）。榜单为 Artificial Analysis 当日快照；价格为调研时点公开页面口径。"),
    ("配套报告", "《AI视频C端制作全景调研报告.md》（同目录上一级）"),
    ("分方向原始研究", "研究资料/01 国际闭源模型、02 国内闭源模型、03 开源模型全景、04 技术与工具生态、05 平台市场趋势（含 400+ 条编号来源）"),
    ("工作表", "闭源国际模型 / 闭源中国模型 / 开源模型 / 平台对比 / 价格对比 / AA榜单快照 / 市场数据 / 时间线 / 选型矩阵 / 关键来源"),
    ("口径提醒", "① AA Elo 不可跨版本比较（2026-09 榜单重构）；② AA $/分钟为 1080p 基准折算，不等于国内刊例价；③ 标 ⚠️ 为未交叉核实项。"),
    ("免责", "本表为公开信息整理，不构成投资建议；价格、榜单、法规可能变化，使用前请以官方页面复核。"),
]
ws.merge_cells("A2:F2")
c = ws["A2"]
c.value = "本表用于支撑主报告的数据查询与二次分析；灰色/条纹行为数据行，表头可筛选。"
c.font = SMALL_FONT
c.alignment = WRAP
ws.row_dimensions[2].height = 22

row = 4
for k, v in intro:
    ws.cell(row=row, column=1, value=k).font = Font(name="微软雅黑", size=10, bold=True)
    ws.cell(row=row, column=1).fill = SECTION_FILL
    ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=6)
    c = ws.cell(row=row, column=2, value=v)
    c.font = BODY_FONT
    c.alignment = WRAP
    ws.row_dimensions[row].height = 40
    row += 1

ws.column_dimensions["A"].width = 16
for col in "BCDEF":
    ws.column_dimensions[col].width = 26

# ---------------- 2. 闭源国际模型 ----------------
headers = ["厂商/国家", "模型与版本", "发布时间", "核心能力", "原生音频", "时长/分辨率", "API/订阅价格", "AA榜单表现", "渠道/备注"]
rows = [
    ["OpenAI/美国", "Sora 2 / Sora 2 Pro", "2025-09-30", "文/图生视频、Cameo 人脸声音授权、Storyboard 多镜头", "是", "App 约 10s；Pro 1080p", "Sora 2 $0.10/s；Pro $0.30-0.50/s（停服前）", "已下榜", "已停服：App 2026-04-26、API 2026-09-24；Sora 3 未发布"],
    ["Google/美国", "Veo 3.1 / 3.1 Fast / 3.1 Lite", "2025-10-14（主力）；Fast/Lite 2026", "文/图生、多参考、首尾帧、场景延长、镜头控制、outpainting", "是", "4/6/8s；720p/1080p/4K；24fps", "3.1 $0.40/次（含音频）、4K $0.60；Fast $0.10-0.30；Lite $0.05-0.08", "T2V 961（#22）、Fast 957、Lite 951", "Gemini API/Vertex、Flow、Gemini App；无 Veo 4"],
    ["Google/美国", "Gemini Omni Flash / 1.1 Flash", "2026-05-19 / 模型卡 2026-08-27", "文本/图像/音频/视频→带音频视频；对话式编辑；1.1 支持 4K 放大、延长至 40s", "是", "720p/约 10s；1.1 可延长", "720p $0.101/s、1080p $0.152/s、4K $0.304/s", "T2V 1129（#10）；编辑 1149（#4）", "Gemini App、Flow、YouTube Shorts/Create"],
    ["Runway/美国", "Gen-4.5", "2025-12", "文/图生视频；物理准确性与提示遵循；平台侧音乐/配音", "平台侧", "720p/最长 10s", "API $0.12/s；订阅 Standard $15、Pro $35、Max $95/月", "未进 AA 前列", "Runway 平台/API；Adobe Firefly 早期接入"],
    ["Runway/美国", "Aleph 2.0（编辑）", "2026-05-20", "文本指令+图像级控制、多关键帧、最长 30s 1080p 编辑", "保留原音频", "编辑 30s/1080p", "140 credits/5s；API $16.80/min", "编辑榜 1009（#9）", "Runway Edit Studio；Figma Weave"],
    ["Luma AI/美国", "Ray3 / Ray3.14 / Ray3.2", "2025-09-18 / 2026-01-26 / 待核实", "文/图/V2V、最多 16 关键帧、Reframe、原生 HDR/EXR", "支持", "1080p；5/10s；24fps", "1080p $0.24/s；HDR ×2、EXR ×3", "未进 AA 前列", "Dream Machine、Luma API；影视调色场景"],
    ["xAI/美国", "Grok Imagine Video 1.5 / 1.5 Lite", "2026-05 / 2026-08", "文/图生、14 张参考图、3 声音参考、首中尾帧、编辑续写、口型", "是", "最长 15s；480p-1080p", "1.5 起 $0.08/s；Lite $0.02/s", "T2V 1058（#13）/990（#20）", "Grok/X 平台、xAI API"],
    ["Pika/美国", "Pika 2.5 + API Club + H3 Flex", "2026；H3 Flex 2026-10-29", "平台化：聚合 100+ 模型；基于 MiniMax H3 后训练加速版", "部分", "后训练模型 15s/最高 4K", "订阅+积分；API Club 宣称最多便宜 88%", "未以自有模型上榜", "Pika 平台、API Club、ChatGPT 插件"],
    ["Meta/美国", "Vibes / Movie Gen", "Vibes 2025-09；Movie Gen 研究 2024-10", "文/图/视频→短视频+remix；口型同步、风格化", "部分", "研究 1080p/16s/16fps", "免费（Meta AI 内）", "未上榜", "Meta AI App、Vibes App；地区受限 ⚠️"],
    ["Adobe/美国", "Firefly Video + 第三方模型", "2025-02 起持续扩容", "文/图生视频、风格预设；接入 Veo 3.1 Fast、Kling 3.0、Runway Gen-4.5", "平台侧", "5s/1080p", "Standard $9.99/月起、Pro $29.99/月起", "未直接上榜", "Firefly App/网页；商用授权+内容凭证"],
    ["Midjourney/美国", "Video V1（图生视频）", "2026 Q2（第三方 ⚠️）", "图生视频、延长 4 次至 21s", "无", "5s/480p（HD 720p）/24fps ⚠️", "订阅 $10/$30/$60 + GPU 分钟", "未上榜", "Midjourney 网页；无公开 API"],
    ["Black Forest Labs/德国", "FLUX 3 / FLUX 3 Max", "2026-07 / 2026-10", "文/图/视频生视频、视频续写、关键帧、原生音频不加价", "是", "最长 20s；HD-4K", "T2V $0.06-0.80/s（按档）；V2V $0.12-0.95/s", "T2V 1156（#4）/1139（#8）", "BFL API/Dashboard；官方称 10s 视频 12.45s 生成"],
    ["Utopai Studios/美国", "Utopai X（集成于 PAI）", "2026-09-30", "文生视频+专业影视工作流；基于既有基座后训练", "未披露", "未披露", "无公开 API", "T2V 1169（#2）、I2V 1147（#2）", "仅 PAI 平台；榜单第 2 但买不到"],
    ["Pruna AI/欧洲", "P-Video-2-Pro / P-Video 2", "2026-09", "文/图生、数字人口播（Avatar 版）", "支持 ⚠️", "未完整披露", "$2.25/min（Pro）；$1.50/min（P-Video 2）", "T2V 1127（#11）、I2V 1119（#7）", "Pruna API、Replicate"],
    ["Creatify/美国", "Boreal-H3", "2026-09-30", "广告简报→受控广告镜头（基于 MiniMax H3 后训练）", "未披露", "未披露", "$0.04/s（上市优惠）", "T2V 830（#31）", "Creatify 平台；广告专用"],
    ["Lightricks/以色列", "LTX-2.5 Pro / Fast（开放权重）", "2026-08-11", "文/图/视频→同步音频+视频；4K HDR；22B", "是", "4K/最长 20s", "权重免费本地；官方 API $10.20/$7.80 每分钟", "T2V 940/944（#25/26）；I2V 913/917", "Hugging Face、ComfyUI、Lightricks API"],
    ["HeyGen/美国", "HeyGen Video 1", "2026-09-30", "通用文生/图生视频+口播；原生音频可开关；基于 H3 后训练（第三方 ⚠️）", "是", "5-15s；480p-2K", "2026-10 促销 $0.01/s；AA 折算 $2.40/min", "T2V 1153（#6）、T2V-Silent #1（1143）", "HeyGen 平台/API；数字人升维"],
    ["Sapiens AI（Agnes）/新加坡", "Agnes Video 2.5", "2026-08", "文/图/参考生视频", "未披露", "未披露", "$2.40/min；API 曾宣布免费（存疑 ⚠️）", "T2V 1067（#12）", "Agnes AI API、Pavo 平台"],
]
make_sheet(wb, "闭源国际模型", "表 1 · 国际闭源视频生成模型（截至 2026-11-03）", headers, rows,
           [20, 26, 20, 40, 10, 22, 34, 24, 40],
           notes="注：AA Elo 为 2026-11-03 快照，2026-09 榜单重构后新旧版本不可比；价格口径见主报告第 3 章。标 ⚠️ 为未交叉核实项。")

# ---------------- 3. 闭源中国模型 ----------------
headers = ["厂商", "模型与版本", "发布时间", "输入模态", "输出规格", "原生音频", "多镜头/长镜头", "AA T2V Elo（11-03）", "API 起价", "C 端入口/备注"]
rows = [
    ["快手", "Kling 4.0", "2026-10-15", "文/图/视频/主体/音色参考、关键帧", "单次最长 30s；1080P/4K、10bit HDR、21:9", "支持", "支持，续拍最长 2 分钟", "未上榜（票数不足）", "$0.157/s（720P）、$0.235/s（1080P）", "可灵AI App/Web；15 项参考+10 关键帧"],
    ["快手", "Kling 3.0 Omni 1080P Pro", "2026-01-31 内测 / 02-05 上线", "文/图/音频/视频（全模态）", "最长 15s；1080P Pro", "支持", "智能分镜+自定义镜头控制", "1022（#18）", "$0.084/s 起", "可灵AI App/Web"],
    ["字节跳动", "Seedance 2.5（即梦 Dreamina）", "2026-07-31", "文/图≤30/视频≤10/音频≤10", "单次 30s；可多轮续写至数分钟", "双声道", "支持，时间戳级编辑", "1155（#5）；I2V 1157（#1）", "火山 ¥70/百万 tokens（480/720P）；AA $34.12/min", "即梦AI/豆包Pro；50 项全模态参考"],
    ["字节跳动", "Seedance 2.0", "2026-02-12", "文/图≤9/视频≤3/音频≤3", "15s 多镜头；双声道", "支持", "支持", "1136（#9）", "720P 约 1 元/s；mini 约 0.5 元/s", "即梦AI/豆包/火山方舟"],
    ["MiniMax", "Hailuo H3", "2026-07-31（开放权重 08-03）", "文/图≤9/视频≤3/音频≤3", "4-15s；768P→2K；24fps；32kHz 立体声", "支持（11 语种）", "支持", "1160（#3，开放权重第一）", "$0.08/s（768P）；2K $0.101/s", "海螺AI；半开源（H3-Base 权重开放）"],
    ["MiniMax", "H3 Max", "2026-08（fal 后训练）", "同上（简化）", "5-15s；480P/768P", "支持", "支持", "1148（#7）", "$0.08/s（768P）", "海螺AI/API；第三方后训练版本"],
    ["阿里", "通义万相 Wan 3.0", "2026-08-06 公测 / 08-24 正式", "文/图/视频/音频/文档/网页（≤20 素材）", "2-30s；480P-1080P；30fps", "支持（台词/BGM/音效）", "支持（多镜头分镜）", "1172（#1）；编辑 1196（#1）", "0.21/0.42/0.84 元/s（7 折）；AA $12/min", "通义万相/百炼；未开放权重"],
    ["阿里", "HappyHorse 1.1（ATH 事业群）", "2026-06-22", "文/图/参考", "3-15s；720P/1080P", "1.1 升级音频", "—", "1050（#14）", "0.54 元/s（720P 优惠）、0.72 元/s（1080P）", "百炼 API；2026-04 匿名登顶后被阿里认领"],
    ["生数科技", "Vidu Q3 Pro", "2026-01-27", "文/图/首尾帧/参考", "720P-2K；媒体口径最长 16s", "支持", "支持", "938（#27）", "0.438 元/s（540P 刊例）", "Vidu 平台/App"],
    ["生数科技", "Vidu Q4 Preview", "2026-10-08", "文/图≤15/音频≤3", "2K/4K", "支持", "—", "未上榜（Preview）", "0.09 元/s 起（首发优惠）", "Vidu；国内旗舰档最低价之一"],
    ["爱诗科技", "PixVerse V6", "2026-03-31", "文/图/参考/转场", "15s；1080P；同步音频", "支持", "支持（multi-shot）", "981（#21）", "$0.041/s（720P 无音频）；$0.102/s（1080P 有音频）", "PixVerse App/Web；累计注册 1.5 亿"],
    ["腾讯", "HunyuanVideo 1.5 / 2.0", "2025-11-20 / 2.0 未证实 ⚠️", "文/图", "1.5：5-10s；480p/720p", "部分", "—", "未上 AA 前列", "腾讯云按分钟/资源包（650 元起）", "腾讯元宝/腾讯云；1.5 开源（8.3B，14GB 可跑）"],
    ["智谱", "CogVideoX-3 / 清影", "发布时间 ⚠️", "文/图/首尾帧", "1080P；30fps；可选有声", "支持", "—", "未上 AA 前列", "开放平台积分计费", "智谱清言「清影」；2026 年以免费为主"],
    ["百度", "蒸汽机 MuseSteamer 2.0", "2025-08 起 / 2026-03 升级", "图/文", "中文音视一体、多人有声；长视频/实时交互", "支持", "支持", "未上 AA 前列", "千帆积分（Air 档约 0.2 元/s 折算 ⚠️）", "百度搜索/营销场景"],
    ["昆仑万维", "SkyReels V4", "2026-03-27", "文/图", "15s；1080P；32fps；音画同步", "支持", "支持", "未上 AA 前列", "第三方渠道计费", "天工AI；V2/V3 开源"],
    ["Sand.ai", "MAGI-2 Preview（开源）", "2026-08-05", "文/图", "10s；1080P；统一音视频；114B MoE", "支持", "—", "1041（#15）", "Apache-2.0 免费自部署；需 8×H100", "开源社区；托管 API 即将上线"],
]
make_sheet(wb, "闭源中国模型", "表 2 · 中国厂商闭源/商用视频生成模型（截至 2026-11-03）", headers, rows,
           [10, 24, 18, 26, 28, 12, 18, 20, 30, 34],
           notes="注：中国模型在 AA T2V（带音频）前十占五席（前五占三席）；I2V 第一为 Seedance 2.5，编辑第一为 Wan 3.0。Elo 为 2026-11-03 快照。")

# ---------------- 4. 开源模型 ----------------
headers = ["模型/版本", "发布方·时间", "参数", "许可证（商用）", "支持任务", "原生分辨率/时长", "最低/推荐硬件", "AA 表现（11-03）", "GitHub★ / HF 下载", "备注"]
rows = [
    ["MiniMax H3", "MiniMax · 2026-07-31 发布 / 08-03 开权重", "33B 单流 Omni", "H3 Community License：排除美/欧/英/韩；年收入>$2000万需授权", "T2V/I2V/首尾帧/多参考/视频编辑/原生音频", "4-15s；768p→2K；32kHz 立体声", "官方未公布；社区约 4-8 卡", "T2V 1160（#3，开放第一）、I2V 1131、编辑 1123", "11,289★；HF 30 天下载 634 万、likes 6,537", "质量最强、许可最受限；衍生生态母体"],
    ["Wan 2.2（A14B/TI2V-5B/S2V/Animate）", "阿里 Wan · 2025-07-28", "27B 总/14B 激活 MoE；5B", "Apache-2.0（自由商用）", "T2V/I2V/TI2V/S2V/角色动画", "480p/720p；24fps；5s", "5B：24GB；A14B：80GB/多卡", "VBench 开源第一约 84.7", "18,338★；S2V 30 天下载 4.81 万", "开源生态基本盘；ComfyUI 原生"],
    ["Wan 2.1", "阿里 Wan · 2025-02-25", "14B/1.3B", "Apache-2.0", "T2V/I2V/VACE 编辑/首尾帧", "480p/720p；5s", "1.3B：8.19GB；14B：80GB", "VBench 约 83.1", "17,366★；T2V-14B 30 天下载 10.37 万", "入门/低显存首选"],
    ["HunyuanVideo 1.5", "腾讯混元 · 2025-11-20", "8.3B", "腾讯混元社区许可（排除欧盟/英国/韩国）", "T2V/I2V/480p-720p+1080p 超分", "121-241 帧（5-10s）", "最低 14GB（offload）", "未上 AA 前列；视觉质量 96.4%/文本对齐 68.5%", "4,591★；HF 主仓 30 天下载 1.4k", "24GB 最佳画质/显存比"],
    ["LTX-2.5", "Lightricks · 2026-08-11", "22B + Gemma 4 12B", "LTX Community License：年营收<$1000 万免费；禁做竞品", "T2V/I2V/多镜头/48kHz 音频/HDR", "默认 10s，最长 20s；1080p/4K", "官方最低 16GB", "T2V 940-944、I2V 913-917", "HF 30 天下载 249 万、10,426 likes", "开源唯一自带音频+专业交付"],
    ["LTX-2", "Lightricks · 2025-10-23 / 2026-01 开权重", "19B", "LTX-2 Community License", "T2V/I2V/音视频一体", "4K 原生能力；20s", "约 24GB 档", "2026-01 曾居开放权重第一（旧刻度）", "10,059★；HF 30 天下载 30.4 万", "ComfyUI 原生"],
    ["MAGI-2 Preview", "Sand.ai · 2026-08-05", "114B MoE（约 6B 激活）", "Apache-2.0（无区域/营收限制）", "T2V/I2V/10s 1080p/时间轴 prompt", "10s；1080p", "8×H100/H200 80GB（约 307GB）", "T2V 1041（#15）", "641★；HF 权重数百 GB", "许可最干净、门槛最高"],
    ["SkyReels V2 / V3", "昆仑万维 · V2 2025-04 / V3 2026-01", "14B（另 1.3B）", "Skywork 社区许可（支持商用，需登记）", "V2：T2V/I2V/无限长；V3：多参考/数字人", "540p/720p；30s+", "14B 需 24-48GB（offload）", "—", "V2 7,754★、V3 594★", "Diffusion Forcing 无限长"],
    ["CogVideoX 2B/5B", "智谱 · 2024-08/11", "2B/5B", "2B Apache-2.0；5B 自定义", "T2V/I2V", "480p/720p；6s", "2B：约 18-21.6GB", "VBench 老基线", "13,176★；5B HF 30 天 8,333", "2026 年已退出第一梯队"],
    ["Open-Sora 2.0", "潞晨科技&HPC-AI · 2025-03-12", "11B", "Apache-2.0", "T2V/I2V", "256p/768p", "多卡（≥8×H100 级）", "—", "29,906★（开源视频仓第一）", "学术影响力最大"],
    ["Mochi 1", "Genmo · 2024-10-22", "10B AsymmDiT", "Apache-2.0", "T2V", "480p；5.4s；30fps", "单卡 H100 级", "—", "3,761★；HF 30 天 3.6k", "ComfyUI/Diffusers"],
    ["Step-Video-T2V/TI2V", "阶跃星辰 · 2025-02/03", "30B", "MIT", "T2V/TI2V", "544p；最高 204 帧（≈8s）", "80GB 级", "—", "3,189★", "FastVideo/Diffusers 适配"],
    ["Kandinsky 5.0 Pro/Lite", "Sber · 2025-11-20", "Pro 19B / Lite 2B", "MIT", "T2V/I2V/相机控制", "5s/10s；720p-1080p", "Pro 40GB+；Lite 16-24GB", "—", "844★", "ComfyUI 官方教程"],
    ["FramePack", "lllyasviel · 2025-04", "13B", "Apache-2.0", "I2V/长视频（渐进式）", "30fps；可生成数千帧", "6GB 显存", "—", "17,343★", "低显存长视频"],
    ["Pyramid Flow", "北大/快手等 · 2024-10", "2B", "Apache-2.0", "T2V/I2V", "768p；10s；24fps", "24GB 级", "—", "—", "社区节点"],
    ["Wan 2.2-S2V / Animate-2", "阿里 Wan · 2025-08-26 / 2026-08-07", "14B", "Apache-2.0", "音频驱动口播/角色动画", "480p/720p；随音频", "80GB（可 offload）", "—", "S2V HF 30 天 4.81 万", "口型/动画首选开源"],
    ["Hyperflow H3（社区蒸馏）", "社区（HF: drbaph）· 2026-09", "基于 H3 少步蒸馏 LoRA", "继承 H3 Community License", "H3 加速推理（int8）", "同 H3", "H3 底座+量化", "I2V-Silent 开放第一（1118）；编辑 1151（#3）", "HF 30 天下载 1.06 万", "质量最强开源加速版"],
    ["Open-H3-Regenerate-2K", "NVIDIA+MIT · 2026-10-26", "基于 H3 两阶段重生成", "仓库标注 other ⚠️", "草稿→精修→2K/4K", "2560×1440，最高 3840×2160", "多卡 H100 级", "—", "HF 30 天下载 41.4 万", "H3 出片后处理"],
    ["Wan 2.5/2.6/2.7/3.0", "阿里 Wan · 2025-09 起", "未公开", "闭源，仅 API（Wan 3.0 无权重）", "T2V/I2V/原生音频/多镜头/编辑", "1080p；10s 级；Wan 3.0 更强", "不适用", "Wan 3.0 T2V 1172（#1）、编辑 1196（#1）", "无开源仓库", "最强 Wan 不再开源"],
    ["HappyHorse-1.0/1.1", "阿里-ATH · 2026-04/06", "15B（40 层单流，8 步 DMD）", "未开放权重（官网称“完全开源”未兑现）", "T2V/I2V/编辑/7 语种口型", "1080p；5s", "不适用", "T2V 1033/1050", "无仓库", "定性为闭源托管"],
    ["Boreal", "Creatify · 2026-09", "未披露（基于开源音视频基座后训练）", "不开源", "广告专用", "未披露", "不适用", "T2V 830（#31）", "—", "基座未披露 ⚠️"],
]
make_sheet(wb, "开源模型", "表 3 · 开放权重/开源视频生成模型全景（截至 2026-11-03）", headers, rows,
           [24, 26, 18, 34, 28, 22, 22, 28, 24, 28],
           notes="注：开放权重第一为 MiniMax H3（T2V 1160），与闭源第一 Wan 3.0（1172）仅差 12 Elo；但 H3 有区域/营收许可限制。GitHub★/HF 下载为 2026-11-03 快照。")

# ---------------- 5. 平台对比 ----------------
headers = ["产品", "公司", "类型", "核心功能", "免费额度", "订阅/积分价格", "公开数据", "适合人群"]
rows = [
    ["即梦AI", "字节跳动/剪映", "国内综合", "文/图生视频、数字人、对口型、AI 音乐、故事创作、短剧工作室", "每日登录赠积分", "包月 69 元、包年 659 元；15 秒视频约 120 积分", "2026Q1 MAU 1,352.5 万、下载 558.9 万（赛道第一）", "个人创作者/小团队"],
    ["可灵AI", "快手", "国内综合", "文/图生视频、动作控制、主体参考、音画同出、Kling 4.0 30 秒/4K", "每日免费灵感值", "黄金 58 元/月（660 灵感值）至黑金 1,149 元/月（26,000）", "2026Q1 收入 6.5 亿+、Q2 8.5 亿+；ARR 近 5 亿美元；用户 1 亿", "进阶创作者/专业团队"],
    ["海螺AI", "MiniMax", "国内综合", "Hailuo H3、原生音频、主体参考", "有免费额度", "订阅 $9.99-199.99/月 ⚠️；API 768P $0.08/s", "MiniMax 港股上市（估值超 500 亿港元）；2026H1 AI 产品收入 4,264 万美元", "开发者/进阶创作者"],
    ["通义万相", "阿里", "国内综合", "文/图/参考生视频、视频编辑、Wan 3.0 30 秒/文档输入", "每日 50 灵感值（生图）", "百炼 720P 0.6 元/s、1080P 1 元/s（7 折 0.42/0.84）", "Wan 系列为国内开源主力；Wan 3.0 AA 双榜第一", "开发者/企业"],
    ["清影", "智谱", "国内综合", "文/图生视频，嵌入智谱清言", "免费排队", "付费加速 24 小时 5 元、一年 199 元（历史口径）", "智谱 2026-01 港股上市（市值超 511 亿港元）", "尝鲜用户"],
    ["Vidu", "生数科技", "国内垂直", "高一致性参考生视频、四参考、视频编辑、一键 MV", "免费版基础模型", "标准版 $8.25/月、专业版 $35.42/月", "近 20 亿元 B 轮、估值超 20 亿美元、拟港股 IPO", "短剧/动漫/参考一致性"],
    ["PixVerse", "爱诗科技", "国内垂直（海外为主）", "模板/特效/角色、PixVerse R1 实时世界模型", "免费额度+每日积分", "按积分订阅（多档）⚠️", "注册用户 1.5 亿、MAU 1,500 万、177 国；29.8 亿元 C 轮", "海外创作者/模板化内容"],
    ["剪映/CapCut", "字节跳动", "国内/海外工具", "剪辑+AI 成片、自动字幕、数字人、翻译、AI 特效", "免费版基础剪辑", "普通会员约 25 元/月；SVIP 79 元/月、758 元/年", "移动端 MAU 7.36 亿", "所有创作者（分发入口）"],
    ["快影", "快手", "国内工具", "快手官方剪辑+AI 视频/动漫/成片模板", "基础免费", "VIP 素材/高阶能力/云空间 3-30 元/月", "未披露独立 MAU ⚠️", "快手生态创作者"],
    ["豆包", "字节跳动", "国内助手", "通用 AI 助手，内嵌 Seedance 2.0 视频生成", "免费为主", "免费+订阅（豆包 Pro）", "2026Q1 MAU 3.45 亿、日活约 1.4 亿", "小白用户"],
    ["腾讯元宝/混元", "腾讯", "国内助手", "元宝 App 内 AI 视频（5 秒级）；混元视频模型开源", "免费资源包", "API/元宝计费；本地开源免费", "未披露视频功能独立数据 ⚠️", "腾讯生态用户"],
    ["腾讯智影", "腾讯", "国内数字人", "在线数字人/视频制作", "基础功能免费", "会员年费约 398 元起；定制数字人 3,999 元起", "未披露 ⚠️", "口播/培训/企业"],
    ["美图秀秀/WHEE", "美图", "国内工具", "轻量修图+AI 视频/图片", "免费额度", "WHEE 约 $2.5-4.99/月", "未披露视频 MAU ⚠️", "普通用户"],
    ["必剪", "B站", "国内工具", "B站创作者剪辑+AI 成片、数字分身口播", "免费为主", "免费/会员增值", "未披露 ⚠️", "B站 UP 主"],
    ["秒创/一帧秒创", "秒创", "国内垂直", "图文转视频、文生视频、电商主图视频", "有免费额度", "订阅制（多档）⚠️", "未披露 ⚠️", "电商商家"],
    ["万兴喵影/万兴剧厂", "万兴科技", "国内工具", "桌面剪辑；AI 影视创作平台（首批接入可灵 4.0）", "基础剪辑免费", "AI 功能/积分增值", "未披露 ⚠️", "影视/短剧团队"],
    ["硅基智能/闪剪", "硅基/闪剪", "国内数字人", "数字人短视频、直播、克隆", "试用额度", "数字人月卡 300-1,000 元；专业版按算力", "未披露 ⚠️", "直播/口播商家"],
    ["Sora App", "OpenAI", "海外综合（已停）", "社交化 AI 视频、cameo、remix", "已停服", "无当前订阅价；App 2026-04-26、API 2026-09-24 停服", "上线两天 16.4 万下载；日均成本约 1,500 万美元", "历史参考"],
    ["Google Flow / Gemini", "Google", "海外综合", "Flow AI 影视工作室；Gemini Omni、Veo 3.1、Nano Banana Pro", "Free 有限；AI Plus 200 积分", "AI Plus $4.99、AI Pro $19.99、AI Ultra $99.99/$199.99 每月", "未单独披露 Flow 用户数 ⚠️；覆盖 140-160+ 国家", "海外创作者/进阶用户"],
    ["Runway", "Runway", "海外专业", "Gen-4.5、Aleph 2.0、多模型聚合、Agentic 协同、Runway Ads", "Free 125 一次性积分", "Standard $15、Pro $35、Max $95/月", "6,000 万+创作者；E 轮 3.15 亿美元；估值 30-53 亿美元 ⚠️", "专业创作者/工作室"],
    ["Pika", "Pika", "海外聚合", "社交短视频、Pikaffects；API Club 100+ 模型；H3 Flex", "Free 80 积分（有水印）", "Starter $8-10、Pro $35、Fancy $95/月", "估值约 4.7 亿美元；累计融资 1.35 亿美元", "社交内容创作者"],
    ["Luma Dream Machine", "Luma AI", "海外综合", "高质量视频/世界模型；Ray3.14；聚合多模型", "有免费额度", "Agents Plus 约 $30/月（10,000 积分）", "C 轮 9 亿美元、估值 40 亿美元", "专业创作者"],
    ["Krea", "Krea", "海外聚合", "实时生成/编辑、多模型聚合、设计工具", "有免费档", "约 $9-60/月", "融资 8,300 万美元、估值约 5 亿美元、周活 75 万+", "设计师/创意团队"],
    ["Higgsfield", "Higgsfield", "海外聚合", "社交/UGC 爆款模板、多模型聚合（Seedance/Kling/MiniMax）", "有试用额度", "按模型/秒计费（Seedance 2.5 $0.2057/s、Kling 3.0 $0.084/s）", "B 轮 4 亿美元、估值 54 亿美元；ARR 约 10 亿美元量级 ⚠️", "UGC/广告创作者"],
    ["Meta Vibes", "Meta", "海外社交", "Meta AI 内 AI 视频生成+信息流；独立 App 试水", "免费", "免费", "未披露用户数据", "社交用户"],
    ["Grok Imagine", "xAI", "海外综合", "图生视频；Video 1.5（2026-06 GA）", "有免费额度", "X Premium/Grok 订阅及 API", "未单独披露 ⚠️", "X 生态用户"],
    ["Midjourney", "Midjourney", "海外工具", "图像+视频（V1）；图生 5 秒/480p，可延长 21 秒", "无免费额度", "基础 $10 起、Standard $30、Pro $60（GPU 分钟制）", "未披露视频用户数 ⚠️", "设计师/艺术创作者"],
    ["CapCut", "字节跳动", "海外工具", "剪辑+AI；Seedance 2.0/2.5 内置，AI 积分制", "免费版可用", "Pro 约 $19.99、Ultra 约 $79/月", "移动端 MAU 7.36 亿", "海外创作者"],
    ["InVideo", "InVideo", "海外工具", "文本到成片、模板化营销视频、多模型", "有免费额度", "约 $20/席位/月起，积分制", "未披露 ⚠️", "营销/中小企业"],
    ["HeyGen", "HeyGen", "海外数字人", "数字人/口播、翻译、Avatar", "免费试用", "Creator $29/月、Pro $49/月起", "ARR 2 亿美元（2026-06）、现金流盈亏平衡", "口播/跨境/培训"],
    ["Synthesia", "Synthesia", "海外数字人", "企业级数字人视频、模板、多语种", "免费计划有限", "Starter $29、Creator/Pro $89/月起", "融资 2 亿美元、估值 40 亿美元；ARR 约 1.5 亿美元", "企业培训/出海"],
    ["Hedra/D-ID/Captions", "各公司", "海外数字人", "肖像驱动口播/数字分身/竖屏短视频", "免费档", "Hedra 约 $15、Captions 约 $9.99、D-ID API 约 $5.90/月起", "未披露 ⚠️", "口播/短视频"],
    ["Descript/Opus Clip", "各公司", "海外工具", "播客/口播剪辑（文本编辑视频）；长视频切片", "Descript 免费 60 分钟；Opus 免费 60 积分/月", "Descript $24/$35/$65；Opus Starter 约 $15、Pro $29", "未披露 ⚠️", "播客/长视频创作者"],
    ["Adobe Firefly/Canva/Freepik", "各公司", "海外工具/聚合", "设计工作流内置视频生成；模型聚合", "Firefly 有限免费积分；Canva 免费视频生成 5 次", "Firefly Standard 2,000 积分/月；Canva Pro 50 次视频/月", "未披露视频付费数据 ⚠️", "设计/营销团队"],
]
make_sheet(wb, "平台对比", "表 4 · 国内外 C 端 AI 视频平台对比（截至 2026-11-03）", headers, rows,
           [18, 16, 14, 38, 20, 38, 40, 20],
           notes="注：价格为 2026-11 页面/公开资料口径，随区域/活动频繁变动；⚠️ 表示未交叉核实或口径存疑。")

# ---------------- 6. 价格对比 ----------------
headers = ["模型", "类型", "最低公开报价（折算）", "AA 折算 $/分钟", "分辨率/音频口径", "备注"]
rows = [
    ["HeyGen Video 1", "闭源", "$0.01/s（2026-10 促销）", "$2.40", "480p-2K/原生音频", "促销价与常规价口径矛盾 ⚠️"],
    ["Grok Imagine 1.5 Lite", "闭源", "$0.02/s 起", "$8.40", "480p-1080p", "分辨率越高越贵"],
    ["P-Video-2-Pro", "闭源", "$0.0375/s", "$2.25", "未完整披露", "Pruna API/Replicate"],
    ["Creatify Boreal-H3", "闭源", "$0.04/s", "$2.40-2.69", "广告专用", "上市优惠价"],
    ["Agnes Video 2.5", "闭源", "$0.04/s", "$2.40", "未披露", "API 曾宣布免费 ⚠️"],
    ["Vidu Q4 Preview", "闭源", "0.09 元/s 起（≈$0.013）", "—", "2K/4K", "首发优惠；未上 AA"],
    ["Wan 3.0", "闭源", "0.21 元/s（480P，≈$0.03）", "$12.00", "480P-1080P/原生音频", "1080P 0.84 元/s"],
    ["PixVerse V6", "闭源", "$0.041/s（720P 无音频）", "$6.90", "1080P/有音频", "1080P 有音频 $0.102/s"],
    ["MiniMax H3", "半开源", "$0.08/s（768P）", "$4.80", "768P-2K/32kHz 立体声", "2K $0.101/s"],
    ["Kling 3.0", "闭源", "$0.084/s（480P）", "$8.40（Omni）", "480P-4K", "Kling 4.0 $0.157/s（720P）"],
    ["Runway Gen-4.5", "闭源", "$0.12/s", "—", "720p/10s", "订阅折算约 $0.24-0.29/s"],
    ["Gemini Omni Flash 1.1", "闭源", "$0.101/s（720p）", "$9.12", "720p-4K/原生音频", "1080p $0.152/s；4K $0.304/s"],
    ["Luma Ray3.2", "闭源", "$0.24/s（1080p）", "—", "1080p/HDR", "HDR ×2、EXR ×3"],
    ["Veo 3.1", "闭源", "$0.40/s（720p/1080p 含音频）", "$24.00", "720p/1080p/4K/原生音频", "4K $0.60/s"],
    ["FLUX 3", "闭源", "$0.06-0.80/s（按分辨率）", "$17.40（标准）/$4.35（Max）", "HD-4K/原生音频", "Draft $0.06/s"],
    ["Seedance 2.5", "闭源", "¥70/百万 token（480/720P）", "$34.12", "480P-1080P/双声道", "高端档；字节内部按 token"],
    ["Seedance 2.0", "闭源", "约 1 元/s（720P）", "$22.45", "720P/双声道", "mini 约 0.5 元/s"],
    ["Kling 4.0", "闭源", "$0.157/s（720P）", "—", "1080P/4K 10bit HDR", "$0.235/s（1080P）"],
    ["HappyHorse 1.1", "闭源", "0.54 元/s（720P 优惠）", "$10.80", "720P/1080P", "1080P 0.72 元/s"],
    ["Wan 3.0 Prime（海外）", "闭源", "$0.0636/s（480P）", "—", "480P-1080P", "全球版定价"],
    ["LTX-2.5 Pro", "开源/API", "$0.17/s", "$10.20", "1080p/4K HDR/音频", "权重可免费本地部署"],
    ["MAGI-2（自托管）", "开源", "边际 0.5 元/10s vs AWS $25-42/10s ⚠️", "—", "1080p/10s", "需 8×H100；口径冲突"],
    ["Sora 2 / 2 Pro", "闭源（已停）", "$0.10 / $0.30-0.50/s", "—", "720p/1080p/原生音频", "仅历史参考；已停服"],
]
make_sheet(wb, "价格对比", "表 5 · 视频模型 API 价格对比（2026-11-03）", headers, rows,
           [24, 14, 34, 24, 30, 34],
           notes="注：AA 的 $/分钟为“1080p 基准 + 固定评测参数”下的 API 成本折算，不等于国内刊例价；比较时须统一分辨率/时长/是否带音频/重试率。")

# ---------------- 7. AA 榜单快照 ----------------
headers = ["榜单", "排名", "模型", "Elo", "发布日期", "AA 折算价格", "国别/开源"]
rows = []
t2v = [
    (1, "Wan 3.0", 1172, "2026-08", "$12.00/min", "中国/闭源"),
    (2, "Utopai X", 1169, "2026-09", "无 API", "美国/闭源"),
    (3, "MiniMax H3 (768p)", 1160, "2026-07", "$4.80/min", "中国/开放权重"),
    (4, "FLUX 3 Max", 1156, "2026-10", "$4.35/min", "德国/闭源"),
    (5, "Dreamina Seedance 2.5", 1155, "2026-07", "$34.12/min", "中国/闭源"),
    (6, "HeyGen Video 1", 1153, "2026-10", "$2.40/min", "美国/闭源"),
    (7, "MiniMax H3 Max", 1148, "2026-08", "$9.60/min", "中国/闭源"),
    (8, "FLUX 3", 1139, "2026-07", "$17.40/min", "德国/闭源"),
    (9, "Dreamina Seedance 2.0", 1136, "2026-03", "$22.45/min", "中国/闭源"),
    (10, "Gemini Omni Flash 1.1", 1129, "2026-08", "$9.12/min", "美国/闭源"),
    (11, "P-Video-2-Pro", 1127, "2026-09", "$5.70/min", "欧洲/闭源"),
    (14, "HappyHorse-1.1", 1050, "2026-06", "$10.80/min", "中国/闭源"),
    (15, "MAGI-2 Preview", 1041, "2026-09", "即将上线", "中国/开放权重"),
    (18, "Kling 3.0 Omni 1080p Pro", 1022, "2026-02", "$8.40/min", "中国/闭源"),
    (19, "Kling 3.0 1080p Pro（锚点）", 1000, "2026-02", "$10.08/min", "中国/闭源"),
    (21, "PixVerse V6", 981, "2026-03", "$6.90/min", "中国/闭源"),
    (22, "Veo 3.1", 961, "2026-01", "$24.00/min", "美国/闭源"),
    (27, "Vidu Q3 Pro", 938, "2026-01", "$7.20/min", "中国/闭源"),
    (31, "Boreal", 830, "2026-09", "$2.69/min", "美国/闭源"),
]
for r in t2v:
    rows.append(["T2V（带音频）v2.1", r[0], r[1], r[2], r[3], r[4], r[5]])
i2v = [
    (1, "Dreamina Seedance 2.5", 1157, "2026-07", "$34.12/min", "中国/闭源"),
    (2, "Utopai X", 1147, "2026-09", "无 API", "美国/闭源"),
    (3, "Dreamina Seedance 2.0", 1137, "2026-03", "$22.45/min", "中国/闭源"),
    (4, "MiniMax H3 (768p)", 1131, "2026-07", "$4.80/min", "中国/开放权重"),
    (5, "Hyperflow H3", 1124, "2026-09", "$9.00/min", "开源蒸馏"),
    (6, "HeyGen Video 1", 1122, "2026-10", "$2.40/min", "美国/闭源"),
    (7, "P-Video-2-Pro", 1119, "2026-09", "$5.70/min", "欧洲/闭源"),
    (8, "MiniMax H3 Max", 1118, "2026-08", "$9.60/min", "中国/闭源"),
    (9, "Wan 3.0", 1111, "2026-08", "$12.00/min", "中国/闭源"),
    (17, "Kling 3.0 Omni 1080p Pro", 1002, "2026-02", "$8.40/min", "中国/闭源"),
    (21, "Veo 3.1", 955, "2026-01", "$24.00/min", "美国/闭源"),
    (25, "LTX-2.5 Fast", 917, "2026-08", "$7.80/min", "以色列/开放权重"),
]
for r in i2v:
    rows.append(["I2V（带音频）v2.1", r[0], r[1], r[2], r[3], r[4], r[5]])
editing = [
    (1, "Wan 3.0", 1196, "2026-08", "—", "中国/闭源"),
    (2, "Dreamina Seedance 2.5", 1152, "2026-07", "—", "中国/闭源"),
    (3, "Hyperflow H3", 1151, "2026-09", "—", "开源蒸馏"),
    (4, "Gemini Omni 1.1 Flash", 1149, "2026-08", "—", "美国/闭源"),
    (5, "MiniMax H3", 1123, "2026-07", "—", "中国/开放权重"),
    (6, "HappyHorse-1.0", 1088, "2026-04", "—", "中国/闭源"),
    (7, "Dreamina Seedance 2.0", 1079, "2026-03", "—", "中国/闭源"),
    (8, "Wan 2.7", 1074, "2026-06", "—", "中国/闭源"),
    (9, "Runway Aleph 2.0", 1009, "2026-05", "—", "美国/闭源"),
    (10, "Kling 3.0 Omni（锚点）", 1000, "2026-02", "—", "中国/闭源"),
]
for r in editing:
    rows.append(["视频编辑 v1.1", r[0], r[1], r[2], r[3], r[4], r[5]])
make_sheet(wb, "AA榜单快照", "表 6 · Artificial Analysis 视频榜快照（2026-11-03）", headers, rows,
           [22, 8, 28, 10, 12, 16, 18],
           notes="注：AA 于 2026-09 重构榜单（拆分带音频/静音、新增编辑榜、锚点 Kling 3.0 1080p Pro=1000），新旧 Elo 不可比；FAQ 口径：T2V-Silent 第一 HeyGen Video 1（1143），I2V-Silent 第一 Utopai X（1154），开放权重 I2V-Silent 第一 Hyperflow H3（1118）。")

# ---------------- 8. 市场数据 ----------------
headers = ["类别", "指标", "数值", "来源/日期", "备注"]
rows = [
    ["市场规模", "全球 AI 视频生成器软件/服务市场", "2026 年 10.4 亿美元 → 2030 年 20.7 亿美元（CAGR 18.9%）", "Research and Markets / 2026-02", "窄口径：软件/订阅"],
    ["市场规模", "AI 视频模型行业收入（含 C 端+API+B 端）", "2025 年 12 亿美元 → 2026 年 77 亿美元 → 2030 年 827 亿美元", "国内券商研究所 / 2026-06", "宽口径，勿与窄口径混用"],
    ["市场规模", "中国 AI 视频生成工具市场", "2032 年 16.05 亿美元（CAGR 14.4%）", "QYR / 2026", "中国区域"],
    ["用户规模", "中国生成式 AI 用户", "超 7 亿、普及率超 50%（2026H1）", "CNNIC / 2026-09-29", "整体生成式 AI，非 AI 视频单列"],
    ["用户规模", "中国 AI 原生 App 月活", "5.46 亿（同比 +82.1%，2026-10）", "QuestMobile", "短剧/短视频贡献时长增长 111.5%"],
    ["用户规模", "全球 AI 图像视频 App", "2026Q1 下载 1.7 亿次（+12%）、内购 1.5 亿美元（+20%）", "Sensor Tower / 2026", ""],
    ["用户规模", "即梦 AI", "2026Q1 MAU 1,352.5 万、下载 558.9 万", "QuestMobile/媒体", "视频生成赛道第一"],
    ["用户规模", "可灵 AI", "2026-06 全球用户 1 亿、覆盖 224 国、企业客户近 5 万", "官方/媒体", ""],
    ["商业化", "可灵 AI 营收", "2026Q1 6.5 亿+（+300%）、Q2 8.5 亿+（+200%）；2025 年营收约 11 亿、净亏 19 亿", "快手财报/媒体", "ARR 2026-03 近 5 亿美元"],
    ["融资", "可灵 AI 首轮独立融资", "198.02 亿元（约 29.05 亿美元）、投后约 180 亿美元", "快手公告 / 2026-11", "设 2031-10-30 IPO 对赌"],
    ["融资", "Runway E 轮", "3.15 亿美元（英伟达、AMD 参投）", "媒体 / 2026-02", "估值 30 亿 vs 53 亿美元两说 ⚠️"],
    ["融资", "Luma AI C 轮", "9 亿美元、估值 40 亿美元", "媒体 / 2025-11", "沙特 HUMAIN/PIF 领投"],
    ["融资", "Synthesia", "2 亿美元、投后 40 亿美元；ARR 约 1.5 亿美元", "媒体 / 2026-01", "英伟达、谷歌参投"],
    ["融资", "HeyGen", "ARR 2 亿美元（2026-06）、现金流盈亏平衡", "媒体", "累计融资约 7,400 万美元"],
    ["融资", "Higgsfield", "B 轮 4 亿美元、估值 54 亿美元", "媒体 / 2026-08", "8 个月前估值 13 亿美元"],
    ["AI 短剧", "国内 AI 剧/漫剧市场", "2026 年预计 400 亿元（+138%）、用户超 6 亿", "DataEye / 2026", "微短剧整体 1,210 亿元"],
    ["AI 短剧", "抖音端 AI 剧/漫剧", "2026H1 新增 22.19 万部、破亿 1,055 部（0.48%）、98.7% 半年不回本", "DataEye（单一来源 ⚠️）", "达盈亏平衡线约 1.3%"],
    ["成本效率", "AI 漫剧单分钟成本", "最低 350 元、周期 90 天→约 10 天", "媒体 / 2026", "标准化报价半年跌超 90%"],
    ["成本效率", "AI 广告成本", "品牌视频广告降至 1-10 美元/条", "TikTok CEO 口径", ""],
    ["合规", "中国生成式 AI 备案", "988 款服务备案、598 款应用登记（截至 2026-06-30）", "网信办", ""],
]
make_sheet(wb, "市场数据", "表 7 · 市场、用户、融资与成本数据（截至 2026-11）", headers, rows,
           [16, 34, 44, 24, 30],
           notes="注：市场规模至少三套口径（软件 10.4 亿美元 / 模型产业 77 亿美元 / Precedence 2.96 亿美元），引用时必须注明统计边界。")

# ---------------- 9. 时间线 ----------------
headers = ["时间", "事件", "意义", "类别"]
rows = [
    ["2024-02", "OpenAI 发布 Sora 技术报告（最长 60 秒、多镜头）", "视频生成模型进入“世界模拟器”预期", "模型"],
    ["2024-06", "VBench 发布（CVPR 2024）", "首个系统化视频生成评测基准", "评测"],
    ["2024-12-10", "Sora 作为独立产品上线，向 ChatGPT Plus/Pro 开放", "视频生成首次进入主流订阅体系", "产品"],
    ["2025-02-25", "阿里开源 Wan2.1（14B/1.3B，Apache-2.0）", "开源视频模型进入“可用”阶段", "开源"],
    ["2025-05-19", "Google I/O 发布 Veo 3（原生音频）、Flow 上线", "音视频一体成为新一代标配", "模型"],
    ["2025-06", "Disney/Universal 起诉 Midjourney", "好莱坞首次集体诉讼生成式 AI 公司", "合规"],
    ["2025-07-28", "阿里开源 Wan2.2（27B 总参 MoE）", "开源旗舰进入 MoE 时代", "开源"],
    ["2025-09-04", "Warner Bros. 起诉 Midjourney（2:25-cv-08376）", "第三家好莱坞巨头加入诉讼", "合规"],
    ["2025-09-30", "OpenAI 发布 Sora 2 并上线 Sora App（美加邀请制）", "上线两天 16.4 万下载；cameo/remix 引爆社交", "产品"],
    ["2025-10-14", "Google 发布 Veo 3.1 / 3.1 Fast", "更强一致性与创意控制", "模型"],
    ["2025-11-04", "英国高等法院 Getty v Stability 判决", "驳回次级版权侵权、部分商标胜诉，训练数据版权主张受挫", "合规"],
    ["2025-11-20", "腾讯开源 HunyuanVideo 1.5（8.3B）", "14GB 可跑的轻量开源旗舰", "开源"],
    ["2025-12", "Disney 宣布向 OpenAI 投资 10 亿美元并授权 200+ 角色（3 年）", "版权授权化标志性交易", "合规"],
    ["2026-01-08", "MiniMax、智谱同日登陆港交所", "中国 AI 公司 IPO 窗口打开", "市场"],
    ["2026-01-26", "Luma Ray3.14 发布（原生 1080p、快 4 倍）", "HDR/影视调色路线", "模型"],
    ["2026-02-05", "可灵 3.0 系列全球上线", "国产模型进入“音画一体+影视级控制”", "模型"],
    ["2026-02-12", "字节 Seedance 2.0 发布", "统一多模态音视频、15 秒多镜头", "模型"],
    ["2026-03-24/25", "OpenAI 宣布关闭 Sora 业务", "4-26 App/网页停服；C 端烧钱换规模模式受挫", "产品"],
    ["2026-03", "即梦上调 15 秒视频积分（45→120）引发投诉后部分回调", "推理成本压力传导至 C 端定价", "市场"],
    ["2026-05-19", "Google I/O 发布 Gemini Omni Flash", "统一多模态、对话式视频编辑", "模型"],
    ["2026-05", "中央网信办要求短视频平台 6 类必选标签", "中国 AI 标识强执行", "合规"],
    ["2026-07-02", "快手公告可灵完成近 30 亿美元融资、投后 180 亿美元", "全球视频大模型最大单轮融资", "市场"],
    ["2026-07-31", "字节 Seedance 2.5 发布（30 秒/50 项参考）", "原生 30 秒+全模态参考", "模型"],
    ["2026-08-02", "欧盟 AI Act 第 50 条透明度义务适用", "全球最严 AI 内容标识制度落地", "合规"],
    ["2026-08-03", "MiniMax H3 开放权重（33B 全模态）", "开源画质追到闭源前沿 1-3 名", "开源"],
    ["2026-08-24", "阿里 Wan 3.0 正式发布（30 秒/文档输入）", "AA T2V/编辑双榜第一，但未开源", "模型"],
    ["2026-09-22", "Anthropic 发布 Claude Opus 5.5，带火 Vibe Video", "通用大模型用代码渲染视频", "技术"],
    ["2026-09-28", "OpenAI 发布 GPT-6 Astra", "可操作 Blender/Unreal，承担“导演+制片”", "技术"],
    ["2026-10-15", "可灵 4.0 上线（30 秒/4K/续拍 2 分钟）", "国产模型进入原生 4K+长镜头阶段", "模型"],
    ["2026-10-26", "OpenAI 洽谈将 Sora 转让给 Katzenberg 等新公司（未官宣）", "Sora 或以专业影视工具形态重生", "市场"],
    ["2026-11", "可灵完成 198.02 亿元增资交割", "国内 AI 视频最大单笔融资落地", "市场"],
]
make_sheet(wb, "时间线", "表 8 · AI 视频 C 端关键时间线（2024-02 — 2026-11）", headers, rows,
           [12, 58, 52, 10],
           notes="注：时间为关键节点，部分为月份精度；来源见主报告与分方向研究资料。")

# ---------------- 10. 选型矩阵 ----------------
headers = ["场景", "首选", "备选", "理由", "预算参考"]
rows = [
    ["中文短视频/UGC（日更、低成本）", "即梦 Seedance 2.0 Mini / Wan 3.0 480P", "Vidu Q4 / PixVerse V6", "0.2-0.5 元/秒档、中文语义好", "¥100-300/月"],
    ["电商商品/模特视频", "Seedance 2.5（50 项参考）/ Kling 4.0（15 项+关键帧）", "Vidu Q4、PixVerse V6", "多主体一致性、商品细节", "按量 ¥500-3,000/月"],
    ["广告/UGC 投放（批量）", "Creatify Boreal-H3 / HeyGen Video 1", "Pika H3 Flex、Kling Turbo", "广告后训练、$0.01-0.04/秒", "$50-500/月"],
    ["短剧/漫剧（多镜头叙事）", "Seedance 2.5 / Kling 4.0（30s+续拍 2min）", "Wan 3.0、Vidu Q4", "长镜头、多参考、原生音频", "数千-数万元/项目"],
    ["数字人口播/培训", "HeyGen Video 1 / Synthesia / Hedra", "腾讯智影、硅基智能、开源 LatentSync+Wan-S2V", "口型、多语言、2K", "$29-200/月"],
    ["影视预演/高画质", "FLUX 3 Max / Luma Ray3（HDR）/ Utopai X（PAI）", "Veo 3.1（4K）、Runway Gen-4.5", "20s/4K/HDR、电影感", "$100-1,000/项目"],
    ["视频编辑/局部重绘", "Wan 3.0 / Runway Aleph 2.0 / Gemini Omni 1.1", "Kling Omni、Wan 2.7-Edit", "编辑榜前列、保留音频", "按量"],
    ["本地私有化/合规", "Wan 2.1/2.2（Apache-2.0）/ H3（非美欧英韩）", "LTX-2.5（<$10M 营收）、MAGI-2（8×H100）", "许可与硬件权衡", "设备 ¥1.5-3 万 / 云 $0.34-4/时"],
    ["零成本学习/实验", "Wan2.2-TI2V-5B / LTX-2.5 / FramePack", "HunyuanVideo 1.5（14GB）", "24GB 甚至 6GB 可跑", "0（已有设备）"],
    ["实时/互动/世界模型", "Decart Lucy 2.5 / PixVerse R1 / Genie 4", "Marble、Runway GWM Worlds 2", "流式/交互优先", "按平台"],
    ["海外创作者（生态全）", "Google AI Pro（Flow）+ Runway", "Pika、CapCut", "模型+分发+订阅", "$20-95/月"],
    ["开发者集成", "火山方舟/百炼/可灵 API", "ComfyUI 本地 + Wan2.2/H3", "按秒计费、失败不计费、可私有化", "按量"],
]
make_sheet(wb, "选型矩阵", "表 9 · 按 C 端场景的模型/工具选型矩阵", headers, rows,
           [30, 40, 40, 34, 26],
           notes="注：选型需同时考虑任务成功率、单条成本、合规与团队技能；价格为经验区间，非精确报价。")

# ---------------- 11. 关键来源 ----------------
headers = ["类别", "来源", "标题", "URL", "日期"]
rows = [
    ["榜单", "Artificial Analysis", "AA-Video-T2V v2.1 Leaderboard", "https://artificialanalysis.ai/video/leaderboard/text-to-video", "2026-11-03 抓取"],
    ["榜单", "Artificial Analysis", "AA-Video-I2V v2.1 Leaderboard", "https://artificialanalysis.ai/video/leaderboard/image-to-video", "2026-11-03 抓取"],
    ["榜单", "AlphaSignal", "AA Rebuilds AA-Video to Rank Models by Real-World Jobs", "https://alphasignal.ai/news/artificial-analysis-rebuilds-aa-video-to-rank-models-by-real-world-jobs", "2026-09-29"],
    ["官方", "OpenAI Help Center", "What to know about the Sora discontinuation", "https://help.openai.com/ca-es/articles/20001152-what-to-know-about-the-sora-discontinuation", "2026"],
    ["官方", "OpenAI", "GPT-6 Astra", "https://openai.com/zh-Hant-HK/index/gpt-6-astra/", "2026-09-28"],
    ["官方", "Kuaishou IR", "Kling 4.0 上线公告", "https://ir.kuaishou.com/zh-hans/news-releases/news-release-details/kelingaixinyidaimoxing-klin1g-40zhengshishangxian", "2026-10-16"],
    ["官方", "MiniMax", "H3（HuggingFace 权重）", "https://huggingface.co/MiniMaxAI", "2026-08"],
    ["官方", "阿里 Wan", "Wan2.2 GitHub", "https://github.com/Wan-Video/Wan2.2", "2025-07-28"],
    ["官方", "Lightricks", "LTX-2.5（HuggingFace）", "https://huggingface.co/Lightricks", "2026-08-11"],
    ["官方", "腾讯混元", "HunyuanVideo 1.5（HuggingFace）", "https://huggingface.co/tencent/HunyuanVideo-1.5", "2025-11-20"],
    ["官方", "Runway", "Runway Pricing", "https://runwayml.com/pricing", "2026-11"],
    ["行业", "36Kr", "从英伟达到 Pika，硅谷巨头为何“反向借力”这个国产模型？", "https://eu.36kr.com/zh/p/4052671124575367", "2026-11-03"],
    ["行业", "DoNews", "AI 视频生成没有「终局」", "https://www.donews.com/article/detail/5450/109150.html", "2026-11-03"],
    ["行业", "证券时报", "AI 短剧的下半场：400 亿盛宴与 98.7% 的亏损面", "https://stcn.com/article/detail/4221237.html", "2026-10-14"],
    ["行业", "澎湃/DataEye", "AI 剧国内市场规模 400 亿、海外 6.5 亿美元", "https://m.thepaper.cn/newsDetail_forward_33503141", "2026-07-01"],
    ["行业", "Research and Markets", "AI Video Generator Market Report 2026", "https://www.researchandmarkets.com/reports/6227059/ai-video-generator-market-report", "2026-02"],
    ["市场", "新华网", "可灵 AI 落地近 30 亿美元融资，估值 180 亿美元", "http://www.xinhuanet.com/digital/20260703/bc3f78f1564842758c0cb82e9e4e8aa5/c.html", "2026-07-03"],
    ["工具", "ComfyUI", "ComfyUI GitHub", "https://github.com/comfyanonymous/ComfyUI", "2026-11"],
    ["工具", "Kijai", "ComfyUI-WanVideoWrapper", "https://github.com/kijai/ComfyUI-WanVideoWrapper", "2026-11"],
    ["工具", "ModelTC", "LightX2V", "https://github.com/ModelTC/LightX2V", "2026-11"],
]
ws = make_sheet(wb, "关键来源", "表 10 · 关键来源（完整 400+ 条见分方向研究资料）", headers, rows,
                [10, 22, 56, 70, 16],
                notes="注：完整编号来源见 研究资料/01-国际闭源模型.md、02-国内闭源模型.md、03-开源模型全景.md、04-技术与工具生态.md、05-平台市场趋势.md。")
for i in range(3, 3 + len(rows)):
    url = ws.cell(row=i, column=4).value
    if url and url.startswith("http"):
        ws.cell(row=i, column=4).hyperlink = url
        ws.cell(row=i, column=4).font = Font(name="微软雅黑", size=9, color="0563C1", underline="single")

# 保存
wb.save(OUT)
print("written:", OUT)
print("sheets:", wb.sheetnames)
