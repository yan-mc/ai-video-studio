"""逐帧追踪浅绿元素（比基尼）—— 判断"脱下并甩到地上"这个关键动作。

提示词明确要求：
  1. 浅绿比基尼是**唯一彩色元素**
  2. 双手到背后解扣 -> 肩带滑落 -> 从胸前拉下并甩到一侧
  3. 落地

所以：绿色像素应该【集中在上半身】→【数量变化】→【转移到地面（y 变大）】
"""
import os
import subprocess

import numpy as np

FFMPEG = r'F:\AI视频\工作室\tools\ffmpeg\bin\ffmpeg.exe'
DIR = r'F:\AI视频\ai-runtime\ComfyUI\output\refcmp'
W, H = 864, 480

FILES = [
    ('R1 LX+euler', 'R1-lx-euler_00001_.mp4'),
    ('R2 LX+lcm', 'R2-lx-lcm_00001_.mp4'),
    ('R3 DMAD8', 'R3-dmad8_00001_.mp4'),
    ('R4 DMAD4', 'R4-dmad4_00001_.mp4'),
]


def decode_rgb(path):
    p = subprocess.run(
        [FFMPEG, '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        capture_output=True)
    n = len(p.stdout) // (W * H * 3)
    if n == 0:
        return None
    return np.frombuffer(p.stdout[: n * W * H * 3], dtype=np.uint8).reshape(n, H, W, 3)


def green(f):
    r = f[:, :, 0].astype(np.int16)
    g = f[:, :, 1].astype(np.int16)
    b = f[:, :, 2].astype(np.int16)
    return (g > 105) & (g - r > 40) & (g - b > 20)


for key, fn in FILES:
    p = os.path.join(DIR, fn)
    if not os.path.exists(p):
        continue
    fr = decode_rgb(p)
    if fr is None:
        continue
    n = fr.shape[0]
    print('=' * 78)
    print(f'{key}  （共 {n} 帧）')
    areas, cys = [], []
    for i in range(n):
        m = green(fr[i])
        areas.append(int(m.sum()))
        if m.sum() > 50:
            ys, _ = np.nonzero(m)
            cys.append(float(ys.mean()))
        else:
            cys.append(float('nan'))

    # 每 12 帧采样打印
    idx = list(range(0, n, 12))
    if n - 1 not in idx:
        idx.append(n - 1)
    print('  帧  绿面积  绿质心y   ← y 变大 = 往画面下方（地面）')
    for i in idx:
        cy = cys[i]
        cys_s = f'{cy:7.1f}' if not np.isnan(cy) else '   —   '
        bar = '#' * min(40, areas[i] // 120)
        print(f'  {i:3d} {areas[i]:7d} {cys_s}  {bar}')

    a = np.array(areas, dtype=float)
    live = a[a > 50]
    print(f'  统计: 起始={a[0]:.0f} 峰值={a.max():.0f} 末帧={a[-1]:.0f} '
          f'均值={live.mean() if len(live) else 0:.0f}')
    # 质心是否下移（落地）
    valid = [(i, c) for i, c in enumerate(cys) if not np.isnan(c)]
    if len(valid) >= 4:
        first = np.mean([c for i, c in valid[:5]])
        last = np.mean([c for i, c in valid[-5:]])
        print(f'  质心: 前5帧均值={first:.1f}  后5帧均值={last:.1f}  '
              f'位移={last - first:+.1f}  {"↓ 下移（落地）" if last - first > 8 else "→ 基本不动"}')
    print()
