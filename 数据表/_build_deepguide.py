# -*- coding: utf-8 -*-
"""合并深度指南分节，并校验 JSON 模板。"""
import io, json, os

BASE = r"F:\AI视频"
SEC = os.path.join(BASE, "研究资料", "深度指南分节")
OUT = os.path.join(BASE, "AI视频制作软件与H3本地部署深度指南.md")

ORDER = [
    "00-摘要与链路.md",
    "01-模型输入总表.md",
    "02-H3输入与素材.md",
    "03-Blender预演接法.md",
    "04-H3部署.md",
    "05-制作软件盘点.md",
    "06-DSH自建方案.md",
    "07-落地方案.md",
    "08-附录.md",
]
parts = []
for name in ORDER:
    p = os.path.join(SEC, name)
    parts.append(io.open(p, encoding="utf-8").read().strip())

full = "\n\n".join(parts) + "\n"
io.open(OUT, "w", encoding="utf-8", newline="\n").write(full)
print("written:", OUT)
print("chars:", len(full), "lines:", full.count("\n") + 1)

# 校验 JSON schema
sp = os.path.join(BASE, "模板", "H3镜头输入包.schema.json")
schema = json.load(io.open(sp, encoding="utf-8"))
print("schema ok:", schema["title"], "| properties:", len(schema.get("properties", {})))
