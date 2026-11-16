"""五组对照的客观画质指标。"""
import os
import subprocess

import numpy as np

FFMPEG = r'F:\AI视频\工作室\tools\ffmpeg\bin\ffmpeg.exe'
DIR = r'F:\AI视频\ai-runtime\ComfyUI\output\dmad_test'
W, H = 864, 480

FILES = [
    ('A-lx-euler(基线)', 'A-lightx2v-4step_00001_.mp4'),
    ('D2-lx-lcm', 'D2-lx-lcm_00001_.mp4'),
    ('D3-dmad-euler', 'D3-dmad-euler_00001_.mp4'),
    ('C-dmad-lcm', 'C-dmad-4step_00001_.mp4'),
    ('B-dmad8-lcm', 'B-dmad-8step_00001_.mp4'),
]


def decode_gray(path):
    cmd = [FFMPEG, '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'gray', '-']
    p = subprocess.run(cmd, capture_output=True)
    n = len(p.stdout) // (W * H)
    if n == 0:
        return None
    return np.frombuffer(p.stdout[: n * W * H], dtype=np.uint8).reshape(n, H, W)


def sharpness(frame):
    f = frame.astype(np.float32)
    out = np.zeros_like(f)
    out[1:-1, 1:-1] = (
        f[:-2, 1:-1] + f[1:-1, :-2] - 4 * f[1:-1, 1:-1] + f[1:-1, 2:] + f[2:, 1:-1]
    )
    return float(out[1:-1, 1:-1].var())


rows = []
for key, fn in FILES:
    p = os.path.join(DIR, fn)
    if not os.path.exists(p):
        print(f'{key}: MISSING {fn}')
        continue
    fr = decode_gray(p)
    if fr is None:
        print(f'{key}: decode fail')
        continue
    n = fr.shape[0]
    sh = [sharpness(fr[i]) for i in range(0, n, max(1, n // 10))]
    diffs = [float(np.abs(fr[i].astype(np.int16) - fr[i - 1].astype(np.int16)).mean()) for i in range(1, n)]
    rows.append(dict(key=key, n=n, sharp=sum(sh) / len(sh),
                     ydif=sum(diffs) / len(diffs), lum=float(fr.mean()),
                     mb=os.path.getsize(p) / 1024 / 1024))

print('=' * 78)
print(f'{"方案":<22} {"帧":>4} {"清晰度":>9} {"帧间差":>8} {"亮度":>7} {"MB":>6}')
print('-' * 78)
for r in rows:
    print(f'{r["key"]:<22} {r["n"]:>4} {r["sharp"]:>9.1f} {r["ydif"]:>8.3f} {r["lum"]:>7.1f} {r["mb"]:>6.2f}')

if rows:
    base = rows[0]
    print()
    print('相对基线 A（LightX2V + euler）:')
    for r in rows[1:]:
        print(f'  {r["key"]:<22} 清晰度 {r["sharp"] / base["sharp"] * 100:>5.1f}%')
