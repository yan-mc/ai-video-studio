"""把 actions.py 的清单导出成 JSON，供 JS / 前端消费。

用法：
    python host/blender/dump_catalog.py            # 打印
    python host/blender/dump_catalog.py out.json   # 写文件

由 tests/verify-all.mjs 调用，校验 JS 侧的枚举与 Python 实现一致。
"""
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import actions  # noqa: E402


def main():
    data = actions.catalog()
    text = json.dumps(data, ensure_ascii=False, indent=2)
    if len(sys.argv) > 1:
        path = sys.argv[1]
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with io.open(path, "w", encoding="utf-8") as f:
            f.write(text + "\n")
        print("wrote {} ({} actions)".format(path, len(data["actions"])))
    else:
        print(text)


if __name__ == "__main__":
    main()
