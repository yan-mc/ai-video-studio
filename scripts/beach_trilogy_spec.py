"""海滩三镜 · 10 秒全链路测试 —— 三镜头布景与机位定义。

================================ 设计依据 ================================
全部来自本机实测探针（不是猜的）：

1) **朝向**（读 .blend 关节世界坐标反推）：
     rotationDeg=0   → 面朝 Blender +Y
     rotationDeg=90  → 面朝 -X
     即标准逆时针。0=+Y / 90=-X / 180=-Y / 270=+X

2) **sit 姿态**（读 sit / sit-kiss 的 root_drop 与关节高度）：
     髋部落到 z≈0.141m，脚踝 z≈0.073m —— 这是**席地而坐**，
     不是坐高椅。所以长椅必须做成矮台（座面 ≈0.16m），
     否则人偶悬空（椅子太高）或陷进椅面（椅子太矮）。

3) **坐标系**：
     镜头卡/前端： (x, y=高度, z=深度)
     Blender：    (x, y=深度, z=高度)
     本脚本写的是**镜头卡坐标**，由 buildSceneSpec 的 toBlenderVec 换算。
     （直接喂 render_shot.py 时必须自己换算，否则相机埋地里 → 纯灰）

================================ 场景设定 ================================
    海在 -z 侧，岸在 +z 侧。沙滩沿 x 轴延伸。
    丰川祥子（祥子）：金/暖色，靠岸，走在外侧
    三角初华（初华）：冷色，靠海，走在内侧

  镜头 1  沿海岸跟随，视野垂直海岸线朝海
     两人手拉手并排沿 +x 走。相机在 -z（海那侧？不，相机要在岸边一侧才能
     越过两人看到海）—— 见下方"机位推理"。

================================ 机位推理（逐镜） ==========================
【镜 1】"摄像机视线垂直于海岸线并且朝向大海，跟随人物移动"
   海岸线沿 x 延伸；"垂直于海岸线且朝向大海" = 相机朝 **-z** 看。
   要朝 -z 看，相机必须站在 **+z（岸边侧）**，位于人物后面，
   越过人物看到海。人物在相机与海之间 → 画面前景是两人的背影/侧影，
   远景是海。这符合"跟随人物一起移动"。
   人物沿 +x 走 → 相机同步 +x 平移（跟拍）。

【镜 2】"摄像机朝向岸边，面对一个长椅，长椅面朝大海，
        两人走到长椅前坐下，一起面朝大海"
   相机朝 **+z**（岸边）看。长椅在相机前方，椅面朝 -z（海）。
   两人从 -x 侧走到长椅前，坐下，面朝 -z。
   要面朝 -z，rotationDeg = 180。

【镜 3】"坐在长椅上的两人各自把脸转向对方并亲在一起"
   继续镜 2 的机位（朝岸边），两人已在椅上，转头相向 → sit-kiss。
   为了让"转向对方"看得清，机位略微侧移成 3/4 角。

================================ 时长与帧数 ================================
    H3 单段最短 124 帧 ≈ 5.17 秒（17k+5 网格 + 训练区间下限 124–362）。
    三镜 × 5.17s = 15.5s > 10s。
    做法：每镜按 124 帧生成，成片剪辑时各取约 3.33s 拼成 10s。
    多出的帧是剪辑余量（也让模型有更长的动作发展空间）。
"""

import json
import os

OUT = os.path.join(os.environ.get('TEMP', '.'), 'jz-beach')
os.makedirs(OUT, exist_ok=True)

# --------------------------------------------------------------- 共用常量
FRAMES = 124          # 17k+5 网格上的最短合法值 ≈5.17s @24fps
COLOR_XIANGZI = '#d97757'   # 丰川祥子 —— 暖橘
COLOR_CHUHUA = '#4a7fc1'    # 三角初华 —— 冷蓝

# 长椅尺寸（米）。座面高度必须匹配 sit 姿态的髋高 0.141m。
BENCH_SEAT_H = 0.16
BENCH_LEN = 1.80
BENCH_DEPTH = 0.55

# 镜头卡坐标（x, y=高度, z=深度）；海在 -z，岸在 +z
BENCH_POS = [0, 0, 4.0]     # 长椅中心（岸边侧）


def bench_props():
    """矮长椅：座面 + 靠背 + 四条腿。全部用 box 拼。"""
    cx, _, cz = BENCH_POS
    props = []
    # 座面（横向较长，朝 -z 方向有深度）
    props.append({
        "kind": "box", "name": "BenchSeat",
        "position": [cx, BENCH_SEAT_H / 2, cz],
        "scale": [BENCH_LEN, BENCH_SEAT_H, BENCH_DEPTH],
        "color": "#8a7355",
    })
    # 靠背（在 +z 侧，即靠岸那侧 —— 人面朝 -z 坐着时背对岸边）
    props.append({
        "kind": "box", "name": "BenchBack",
        "position": [cx, BENCH_SEAT_H + 0.28, cz + BENCH_DEPTH / 2 - 0.04],
        "scale": [BENCH_LEN, 0.56, 0.08],
        "color": "#7a6448",
    })
    # 四条腿
    for sx in (-1, 1):
        for sz in (-1, 1):
            props.append({
                "kind": "box", "name": f"BenchLeg{sx}{sz}",
                "position": [
                    cx + sx * (BENCH_LEN / 2 - 0.12),
                    BENCH_SEAT_H / 2 - 0.08,
                    cz + sz * (BENCH_DEPTH / 2 - 0.08),
                ],
                "scale": [0.08, 0.16, 0.08],
                "color": "#6b5740",
            })
    return props


# =============================================================== 镜头 1
# 沿海岸跟随，视线垂直海岸线朝海。
# 相机在 +z（岸边侧）朝 -z 看；人物在其前方（-z 侧）沿海岸 +x 移动。
SHOT1 = {
    "name": "镜1-牵手漫步",
    "width": 864, "height": 480, "fps": 24, "frames": FRAMES,
    "ground": True, "groundSpan": 20,
    "camera": {
        # 高 1.35m，位于岸边侧 +z=+2.2，朝 -z 看
        "position": [0.0, 1.35, 2.2],
        "target": [0.0, 1.05, -3.0],
        "fov": 46,
    },
    "actors": [
        # 祥子：靠岸侧（z 略大），从左往右走
        {
            "name": "Xiangzi", "heightM": 1.66, "color": COLOR_XIANGZI,
            "position": [-1.6, 0, 0.55], "rotationDeg": 270,
            "action": "walk", "startFrame": 0, "durationFrames": FRAMES,
            "from": [-1.6, 0, 0.55], "to": [1.9, 0, 0.55],
        },
        # 初华：靠海侧（z 略小），并肩
        {
            "name": "Chuhua", "heightM": 1.68, "color": COLOR_CHUHUA,
            "position": [-1.6, 0, -0.10], "rotationDeg": 270,
            "action": "walk", "startFrame": 0, "durationFrames": FRAMES,
            "from": [-1.6, 0, -0.10], "to": [1.9, 0, -0.10],
        },
    ],
    "props": [],
}
# 镜 1 机位也要跟着人物 +x 平移 —— 用 camera keys 做跟拍
SHOT1["camera"]["keys"] = [
    {"frame": 0, "position": [-1.6, 1.35, 2.2], "target": [-1.6, 1.05, -3.0]},
    {"frame": FRAMES - 1, "position": [1.9, 1.35, 2.2], "target": [1.9, 1.05, -3.0]},
]

# =============================================================== 镜头 2
# 朝岸边，面对长椅；长椅面朝海；两人从 -x 侧走到椅前坐下，一起面朝海。
SHOT2 = {
    "name": "镜2-坐下",
    "width": 864, "height": 480, "fps": 24, "frames": FRAMES,
    "ground": True, "groundSpan": 20,
    "camera": {
        # 相机在海侧 -z，朝 +z（岸边）看，把长椅与两人框进去
        "position": [0.0, 1.30, -1.9],
        "target": [0.0, 0.85, 4.0],
        "fov": 48,
    },
    "actors": [
        # 两人从画面左（-x）走向长椅，坐下面朝 -z（海）→ rotationDeg 180
        {
            "name": "Xiangzi", "heightM": 1.66, "color": COLOR_XIANGZI,
            "position": [-2.6, 0, 2.6], "rotationDeg": 180,
            "action": "sit-down", "startFrame": 0, "durationFrames": FRAMES,
            "from": [-2.6, 0, 2.6], "to": [-0.42, 0, 4.0],
        },
        {
            "name": "Chuhua", "heightM": 1.68, "color": COLOR_CHUHUA,
            "position": [-2.6, 0, 3.4], "rotationDeg": 180,
            "action": "sit-down", "startFrame": 0, "durationFrames": FRAMES,
            "from": [-2.6, 0, 3.4], "to": [0.42, 0, 4.0],
        },
    ],
    "props": bench_props(),
}

# =============================================================== 镜头 3
# 两人已在长椅上，各自转头相向并亲吻。3/4 侧机位，看得清两侧脸。
SHOT3 = {
    "name": "镜3-亲吻",
    "width": 864, "height": 480, "fps": 24, "frames": FRAMES,
    "ground": True, "groundSpan": 20,
    "camera": {
        # 3/4 侧、略低，便于看清两张脸的靠近
        "position": [-1.85, 1.22, -0.9],
        "target": [0.0, 0.72, 4.0],
        "fov": 44,
    },
    "actors": [
        # 已在椅上 → 用 sit-kiss；从坐姿微微转向 → sit-kiss 曲线本身含转头
        {
            "name": "Xiangzi", "heightM": 1.66, "color": COLOR_XIANGZI,
            "position": [-0.34, 0, 4.0], "rotationDeg": 180,
            "action": "sit-kiss", "startFrame": 0, "durationFrames": FRAMES,
        },
        {
            "name": "Chuhua", "heightM": 1.68, "color": COLOR_CHUHUA,
            "position": [0.34, 0, 4.0], "rotationDeg": 180,
            "action": "sit-kiss", "startFrame": 0, "durationFrames": FRAMES,
        },
    ],
    "props": bench_props(),
}

SHOTS = [SHOT1, SHOT2, SHOT3]

for i, s in enumerate(SHOTS, 1):
    p = os.path.join(OUT, f'shot{i}.json')
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(s, f, ensure_ascii=False, indent=2)
    print(f'SHOT{i}={p}')
    print(f'  name={s["name"]} frames={s["frames"]} actors={len(s["actors"])} props={len(s["props"])}')
    print(f'  cam pos(镜头卡坐标)={s["camera"]["position"]} target={s["camera"]["target"]}')
