# -*- coding: utf-8 -*-
"""向已有对比表追加 H3 输入、H3 部署、制作软件 3 个工作表。"""
import os
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

BASE = r"F:\AI视频"
XLSX = os.path.join(BASE, "数据表", "AI视频模型与平台对比表.xlsx")

TITLE_FILL = PatternFill("solid", fgColor="1F3864")
HEAD_FILL = PatternFill("solid", fgColor="2E5C8A")
ZEBRA_FILL = PatternFill("solid", fgColor="EEF3F8")
WHITE_BOLD = Font(name="微软雅黑", size=11, bold=True, color="FFFFFF")
TITLE_FONT = Font(name="微软雅黑", size=16, bold=True, color="FFFFFF")
BODY_FONT = Font(name="微软雅黑", size=10)
THIN = Side(style="thin", color="B4C6E7")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)


def add_sheet(wb, name, title, headers, rows, widths, notes=None):
    if name in wb.sheetnames:
        del wb[name]
    ws = wb.create_sheet()
    ws.title = name
    ncol = len(headers)
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=ncol)
    c = ws.cell(row=1, column=1, value=title)
    c.font = TITLE_FONT
    c.fill = TITLE_FILL
    c.alignment = CENTER
    ws.row_dimensions[1].height = 30
    for j, h in enumerate(headers, start=1):
        c = ws.cell(row=2, column=j, value=h)
        c.font = WHITE_BOLD
        c.fill = HEAD_FILL
        c.alignment = CENTER
        c.border = BORDER
    ws.row_dimensions[2].height = 24
    for i, row in enumerate(rows, start=3):
        for j, v in enumerate(row, start=1):
            c = ws.cell(row=i, column=j, value=v)
            c.font = BODY_FONT
            c.alignment = WRAP
            c.border = BORDER
            if i % 2 == 0:
                c.fill = ZEBRA_FILL
        ws.row_dimensions[i].height = 34
    for j, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(j)].width = w
    if notes:
        r = len(rows) + 3
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=ncol)
        c = ws.cell(row=r, column=1, value=notes)
        c.font = Font(name="微软雅黑", size=9)
        c.fill = PatternFill("solid", fgColor="D9E2F3")
        c.alignment = WRAP
    ws.freeze_panes = "A3"
    ws.auto_filter.ref = f"A2:{get_column_letter(ncol)}{len(rows) + 2}"
    return ws


wb = load_workbook(XLSX)

# ---------- H3 输入规格 ----------
headers = ["项目", "规格/上限", "说明/来源"]
rows = [
    ["任务模式", "T2VA / I2VA / L2VA / FL2VA / Ref2VA", "一次请求只能选一种；首尾帧模式与参考模式互斥"],
    ["参考图", "≤9 张", "短边按 2048px 处理；不要 3×3 网格三视图，用 2—4 张独立高清图"],
    ["参考视频", "≤3 段，每段 2—15s，合计 ≤15s", "必须 24fps；不带声轨视为无声"],
    ["参考音频", "≤3 段，每段 2—15s，合计 ≤15s", "不能作为 Ref2VA 唯一参考（需至少 1 图/视频）"],
    ["混合文件总数", "≤12 个", "图+视频+音频合计；请求体 ≤64MB"],
    ["图片文件", "≤30MB/张；边长 256—5760；比例 0.4—2.5", "官方 API 限制"],
    ["视频文件", "≤50MB；MP4/MOV；H.264/265 + AAC/MP3；23.976—60fps", "官方 API 限制"],
    ["音频文件", "≤15MB；WAV/MP3", "官方 API 限制"],
    ["提示词长度", "≤7,000 字符（再生成接口 ≤40,000）", "正文英文；台词/歌词/画面文字保留原语言；11 语种"],
    ["输出规格", "4—15s；短边 768p（1344×768 原生）；24fps；32kHz 立体声", "2K 需 H3-Regenerate-2K（官方 API）"],
    ["帧网格", "17k+5：107—362 帧 ≈ 4.46—15.08s", "124 帧 ≈ 5.17s；4 秒会吸附到 107 帧"],
    ["分辨率预设", "0.98MP（1344×768）；不要用 1.0MP（1376×768 超上限）", "宽高必须为 32 的倍数"],
    ["基础提示词结构", "integrated_multimodal_description / overall_soundscape / non_diegetic_music", "关键帧模式需加 # I2VA/# FL2VA/# L2VA 对齐指令"],
    ["参考提示词结构", "subject_definitions / summary / retention_analysis / detailed_description / overall_soundscape / non_diegetic_music", "六段固定顺序；正文 350—500 英文词；无负向提示词"],
    ["素材标签", "<Picture N> / <Video N> / <Audio N> / <Subject N>", "按模态独立编号、按槽位顺序；前端 @图片1 为别名"],
    ["保留强度（视觉）", "fully_preserved / partially_preserved / attribute_transfer / weak_reference", ""],
    ["保留强度（音频）", "fully_copy / partially_copy / reference / weak_reference", ""],
    ["本地结构控制", "ComfyUI Fun-ControlNet-Union 2.0：8 条件（Canny/Depth/HED/MLSD/Pose/Scribble/Layout/Gray）+ inpaint", "官方 API 无 depth/pose/seg/相机参数输入；法线不可用"],
    ["2K 再生成", "POST /v2/video_regeneration；源视频需 768P 规格 + 原最终提示词", "本地开源不含 Context-IR/Regenerate-2K"],
]
add_sheet(wb, "H3输入规格", "表 11 · MiniMax H3 输入素材与提示词规格（2026-11-03）", headers, rows,
          [20, 60, 60],
          notes="来源：MiniMax 官方部署文档/模型卡/API 参考、ComfyUI 官方 H3 教程、社区 prompt guide；详见 研究资料/07-H3输入素材与提示词规范.md。")

# ---------- H3 部署档位 ----------
headers = ["显存档位", "代表硬件", "能跑什么（口径）", "5 秒视频体感速度", "备注"]
rows = [
    ["8GB", "RTX 3060/4060", "Q2_K GGUF（约 6.7GB）+ 极限 offload + 480p/5s", "分钟级", "仅能出片验证"],
    ["12GB", "RTX 4070/5070", "480P 可跑（约 16.8—18.7s/步）；4 步 Turbo + Latent Upscaler", "3—8 分钟", "需 low_vram 配置"],
    ["16GB", "RTX 4080/5070Ti", "社区验证“稳定制作”（峰值约 11GiB、约 65s/条）", "1—5 分钟", "16GB+32GB 内存；社区口径"],
    ["24GB", "RTX 4090", "int8 + 尾部 block 流式；768p/20 步约 6.8 分钟；int8 约 5 分钟；int8+Spectrum 50 步约 2.7 分钟", "2—7 分钟", "能出 768p 正片"],
    ["32GB", "RTX 5090", "int8 常驻；480P/20 步约 112 秒", "1—3 分钟", "FP8 原生加速（cc≥8.9）"],
    ["48GB", "RTX 6000 Ada / 双 4090", "更高分辨率/更长时长/并行任务", "1—3 分钟", "小团队单机"],
    ["80GB", "A100/H100 单卡", "基本可常驻（FP8 更省）；4×H100 FL2VA 约 13s/条", "十几秒级", "服务化起点"],
    ["8×B300", "数据中心节点", "FL2VA BF16 19.04s / FP8 18.03s；Ref2VA BF16 29.12s", "18—19 秒/条", "8×B200 官方未公布延迟/显存"],
    ["2×RTX 5090", "家用/小团队", "768p/50 步约 9 分 20 秒；系统内存约 377GiB", "约 9 分钟", "双卡 offload"],
    ["Apple Silicon", "M4 Pro 24GB", "BF16 1344×768/5s≈48 分钟；INT8+Turbo 768×448/5s≈23 分钟", "很慢", "只适合验证"],
    ["DGX Spark GB10", "128GB 统一内存", "INT8+NVFP4：608×352/4s≈97s；864×480/5s≈256s", "可用但慢", "低功耗离线批量"],
]
add_sheet(wb, "H3部署档位", "表 12 · H3 本地部署硬件档位与速度（2026-11）", headers, rows,
          [16, 24, 60, 20, 40],
          notes="来源：MiniMax 官方部署文档、SGLang H3 Cookbook、ComfyUI/DiffSynth 官方文档、社区实测；8×B300 数据为上游 benchmark，8×B200 官方未公布。详见 研究资料/06-H3部署实操.md。")

# ---------- 制作软件对比 ----------
headers = ["工具/方案", "开源/闭源", "类型", "核心能力", "外部 LLM 依赖", "成熟度/备注"]
rows = [
    ["ComfyUI + H3 节点", "开源", "生成工作流", "H3 T2V/I2V/FL2VA/Ref2VA、AddGuide、latent 重绘；Wan/LTX 混排", "否", "事实标准；缺项目/角色/QC/协作"],
    ["ComfyUI_MiniMaxH3_Director", "开源", "H3 导演台插件", "多段时间轴、首尾帧组、参考素材组、二采/放大", "否", "制作层在 ComfyUI 内生长"],
    ["DiffSynth-Studio", "开源", "推理+训练", "H3 NF4 最低约 7GB、LoRA/全参训练、retake/control", "否", "脚本化/训练"],
    ["Wan2GP", "开源", "低显存 WebUI", "Wan/Hunyuan/LTX/Flux；内置离线 Deepy Agent", "否", "8GB 可跑"],
    ["OpenCinema", "开源（MIT）", "本地 AI 工作室", "画布+Blockout（RGB/Depth/Normal/animatic）+MCP Agent+审片/编辑计划", "是（Agent/MCP）", "0.4 预览、未正式发布、Windows 不支持 ⚠️"],
    ["Timeline Studio", "开源", "白模预演原型", "Three.js 视口、走位/切镜/剧本共时间轴、AI 结构化修改", "是（Agent）", "原型；白模→成片未打通"],
    ["Frametell", "开源", "本地 AI 工作室", "导演 Agent 先出分镜待批准→旁白/字幕", "是", "2026-10 活跃"],
    ["Storyboarder", "开源", "传统分镜", "速写分镜、Shot Generator", "否", "v3.0 后维护停滞"],
    ["Kitsu", "开源", "制作管理", "镜头/资产/任务/审片；MCP/剧本分析试水", "部分", "成熟，团队协作层"],
    ["OpenTimelineIO", "开源", "时间线格式", "剪辑/轨道/片段可交换模型", "否", "基础件，不是应用"],
    ["BlenderMCP", "开源", "Blender 桥接", "LLM 操作 Blender：建模/材质/相机/截图", "是", "约 3 万 stars；需 Agent Host"],
    ["Runway", "闭源", "制作平台", "Workflows/Edit Studio/Aleph 2.0/Agent/多模型", "部分", "$12—76/月"],
    ["LTX Studio", "闭源", "故事板→视频", "剧本/分镜/角色一致性/时间线", "是", "$15/35/125 月"],
    ["预演软件", "闭源", "本地 AI 影视工作台", "3D 导演台/取景器/白模预演/演员库/H3 流水线", "是（Codex MCP）", "内测；公开功能已核实，截图功能未公开 ⚠️"],
    ["Unreal Engine 5.8", "闭源", "虚拟制片", "实时预演/LED 虚拟制片", "否", "UE5 最后大版本"],
    ["DaVinci Resolve 21.1", "闭源", "剪辑/调色", "剪辑/调色/混音；接 Claude/Codex 助手", "部分", "免费版可用"],
    ["DSH 自建", "开源/自建", "编排层", "Agent/工具/MCP/多智能体/审批/任务中心 + Client UI", "可选", "省 3—5 人月底座；媒体资产/时间线需自建"],
]
add_sheet(wb, "制作软件对比", "表 13 · 本地/桌面 AI 视频制作软件对比（2026-11）", headers, rows,
          [24, 14, 20, 60, 18, 40],
          notes="来源：各项目官方仓库/官网、08-本地制作软件与Blender工作流.md；标 ⚠️ 为未完全核实。")

wb.save(XLSX)
print("saved:", XLSX)
print("sheets:", wb.sheetnames)
