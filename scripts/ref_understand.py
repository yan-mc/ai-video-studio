"""量化"视频理解"：四组产物在多大程度上执行了提示词里的动作与运镜。

提示词里的可验证要素：
  1. 浅绿色比基尼 —— 唯一的彩色元素，且**被脱下并甩到地上**
  2. 推进镜头（dolly in）—— 画面尺度应随时间增大
  3. 纯黑剪影 + 金色描边 —— 高对比、极暗主体、金色边缘
  4. 克隆列队 —— 沿直线向纵深退去

测法：
  - 绿色像素（HSV 里的绿）逐帧面积与质心 → 判断是否被脱掉/位移
  - 画面"主体占比"逐帧变化 → 判断推进
  - 暗像素比例 → 剪影是否纯黑
  - 金色像素比例 → 描边是否存在
"""
import os
import subprocess

import numpy as np

FFMPEG = r'F:\AI视频\工作室\tools\ffmpeg\bin\ffmpeg.exe'
DIR = r'F:\AI视频\ai-runtime\ComfyUI\output\refcmp'
W, H = 864, 480

FILES = [
    ('R1 LightX2V+euler', 'R1-lx-euler_00001_.mp4'),
    ('R2 LightX2V+lcm', 'R2-lx-lcm_00001_.mp4'),
    ('R3 DMAD 8step', 'R3-dmad8_00001_.mp4'),
    ('R4 DMAD 4step', 'R4-dmad4_00001_.mp4'),
]


def decode_rgb(path):
    cmd = [FFMPEG, '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    p = subprocess.run(cmd, capture_output=True)
    n = len(p.stdout) // (W * H * 3)
    if n == 0:
        return None
    return np.frombuffer(p.stdout[: n * W * H * 3], dtype=np.uint8).reshape(n, H, W, 3)


def green_mask(f):
    """浅绿：G 明显高于 R 和 B。"""
    r = f[:, :, 0].astype(np.int16)
    g = f[:, :, 1].astype(np.int16)
    b = f[:, :, 2].astype(np.int16)
    return (g > 110) & (g - r > 45) & (g - b > 25)


def gold_mask(f):
    """金色描边：R,G 高且接近，B 低。"""
    r = f[:, :, 0].astype(np.int16)
    g = f[:, :, 1].astype(np.int16)
    b = f[:, :, 2].astype(np.int16)
    return (r > 165) & (g > 125) & (b < 115) & (abs(r - g) < 75)


def dark_ratio(f):
    lum = f.mean(axis=2)
    return float((lum < 32).sum()) / lum.size


def sharpness(f):
    g = f.mean(axis=2).astype(np.float32)
    o = np.zeros_like(g)
    o[1:-1, 1:-1] = g[:-2, 1:-1] + g[1:-1, :-2] - 4 * g[1:-1, 1:-1] + g[1:-1, 2:] + g[2:, 1:-1]
    return float(o[1:-1, 1:-1].var())


print('=' * 92)
print(f'{"方案":<20}{"绿均":>7}{"绿峰":>7}{"绿帧变":>8}{"金均":>7}{"暗占比":>8}{"清晰度":>8}{"推进%":>8}')
print('-' * 92)

report = []
for key, fn in FILES:
    p = os.path.join(DIR, fn)
    if not os.path.exists(p):
        print(key, 'MISSING')
        continue
    fr = decode_rgb(p)
    if fr is None:
        print(key, 'DECODE FAIL')
        continue
    n = fr.shape[0]

    g_areas, g_cy, g_cx = [], [], []
    gold_areas, darks, sharps = [], [], []
    for i in range(n):
        f = fr[i]
        gm = green_mask(f)
        g_areas.append(int(gm.sum()))
        if gm.sum() > 30:
            ys, xs = np.nonzero(gm)
            g_cy.append(float(ys.mean()))
            g_cx.append(float(xs.mean()))
        gold_areas.append(int(gold_mask(f).sum()))
        darks.append(dark_ratio(f))
        if i % 20 == 0:
            sharps.append(sharpness(f))

    ga = np.array(g_areas)
    # 绿色面积相对起始的波动（脱下/位移会让它剧变）
    base = max(1, ga[0])
    g_var = float(ga.max() - ga.min()) / base
    # 绿块质心位移（脱下后会被甩走）
    if len(g_cy) >= 2:
        disp = float(np.hypot(np.diff(g_cy), np.diff(g_cx)).sum())
    else:
        disp = 0.0

    # 推进：用绿色块（贴在主体上）包围盒尺寸变化，或整体暗区变化
    # 更稳的做法：主体（暗像素）占比变化
    dk = np.array(darks)
    push = float((dk[-10:].mean() - dk[:10].mean()) / max(1e-6, dk[:10].mean())) * 100

    report.append(dict(
        key=key, g_mean=float(ga.mean()), g_peak=int(ga.max()), g_var=g_var,
        g_disp=disp, gold=float(np.mean(gold_areas)), dark=float(np.mean(darks)),
        sharp=float(np.mean(sharps)), push=push,
    ))

for r in report:
    print(f'{r["key"]:<20}{r["g_mean"]:>7.0f}{r["g_peak"]:>7d}{r["g_var"]:>8.2f}'
          f'{r["gold"]:>7.0f}{r["dark"]:>8.3f}{r["sharp"]:>8.1f}{r["push"]:>+8.1f}')

print()
print('说明：')
print('  绿均/绿峰 = 浅绿像素数（比基尼）。峰值远大于均值 → 中途改变，可能被脱下')
print('  绿帧变   = (峰-谷)/起始，越大说明绿色元素变动越剧烈')
print('  金均     = 金色描边像素数')
print('  暗占比   = 亮度<32 的像素比例（纯黑剪影应很高）')
print('  推进%    = 暗区占比相对前 10 帧的变化，正数=主体变大=推近')
