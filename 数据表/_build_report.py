# -*- coding: utf-8 -*-
"""把分节 Markdown 合并为最终调研报告。"""
import io
import os

BASE = r"F:\AI视频"
SEC_DIR = os.path.join(BASE, "研究资料", "报告分节")
OUT = os.path.join(BASE, "AI视频C端制作全景调研报告.md")

ORDER = [
    "00-封面与执行摘要.md",
    "01a-调研说明.md",
    "01b-行业全景.md",
    "02-技术篇.md",
    "03-模型篇.md",
    "04-工具篇.md",
    "05-平台篇.md",
    "06-市场商业化.md",
    "07-风险合规.md",
    "08-趋势展望.md",
    "09-结论建议与附录.md",
]

parts = []
for name in ORDER:
    path = os.path.join(SEC_DIR, name)
    with io.open(path, "r", encoding="utf-8") as f:
        text = f.read().strip()
    parts.append(text)

full = "\n\n".join(parts) + "\n"
with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write(full)

print("written:", OUT)
print("chars:", len(full))
print("lines:", full.count("\n") + 1)
print("sections:", len(parts))
