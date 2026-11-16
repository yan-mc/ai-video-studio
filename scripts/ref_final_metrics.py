"""最终量化：推镜、动态幅度、时间连贯性、音频包络。

针对提示词里的关键要求：
  - "Dolly in (camera pushing straight forward)"  → 主体应逐帧变大
  - "one continuous take"                          → 不应出现跳切（帧差不应有尖峰）
  - "0.5x slow motion"                             → 动作应平缓
  - "Drums + the sound of the underwear dropping"  → 音频应有包络起伏
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


def decode_gray(path):
    p = subprocess.run(
        [FFMPEG, '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
        capture_output=True)
    n = len(p.stdout) // (W * H)
    if n == 0:
        return None
    return np.frombuffer(p.stdout[: n * W * H], dtype=np.uint8).reshape(n, H, W)


def audio_env(path, nb=16):
    """把音频切成 nb 段，返回每段 RMS（dB）。"""
    p = subprocess.run(
        [FFMPEG, '-v', 'error', '-i', path, '-ac', '1', '-ar', '8000',
         '-f', 'f32le', '-'],
        capture_output=True)
    a = np.frombuffer(p.stdout, dtype=np.float32)
    if len(a) < nb * 2:
        return None
    seg = len(a) // nb
    out = []
    for i in range(nb):
        chunk = a[i * seg:(i + 1) * seg]
        rms = float(np.sqrt(np.mean(chunk ** 2)))
        out.append(20 * np.log10(max(rms, 1e-8)))
    return out


print('=' * 104)
print(f'{"方案":<16}{"主体起始":>9}{"主体末尾":>9}{"推近%":>8}'
      f'{"帧差均值":>9}{"帧差峰":>8}{"尖峰数":>7}{"音频动态":>9}')
print('-' * 104)

rows = []
for key, fn in FILES:
    p = os.path.join(DIR, fn)
    if not os.path.exists(p):
        continue
    fr = decode_gray(p)
    if fr is None:
        continue
    n = fr.shape[0]

    # 1) 主体面积（暗区，<40 视为剪影本体 + 其内部）
    #    用中心区域避免背景色块干扰
    cy0, cy1 = int(H * 0.15), int(H * 0.92)
    cx0, cx1 = int(W * 0.18), int(W * 0.82)
    areas = []
    for i in range(n):
        sub = fr[i, cy0:cy1, cx0:cx1]
        areas.append(int((sub < 45).sum()))
    a = np.array(areas, dtype=float)
    a0 = a[:10].mean()
    a1 = a[-10:].mean()
    push = (a1 - a0) / max(1.0, a0) * 100

    # 2) 帧差
    d = np.array([np.abs(fr[i].astype(np.int16) - fr[i - 1].astype(np.int16)).mean()
                  for i in range(1, n)])
    dmean = float(d.mean())
    dpeak = float(d.max())
    # 尖峰：超过均值 3 倍视为跳切
    spikes = int((d > dmean * 3).sum())

    # 3) 音频动态（每段 RMS 的极差）
    env = audio_env(p)
    aud_dyn = (max(env) - min(env)) if env else float('nan')

    rows.append(dict(key=key, a0=a0, a1=a1, push=push, dmean=dmean,
                     dpeak=dpeak, spikes=spikes, aud=aud_dyn))

for r in rows:
    print(f'{r["key"]:<16}{r["a0"]:>9.0f}{r["a1"]:>9.0f}{r["push"]:>+8.1f}'
          f'{r["dmean"]:>9.2f}{r["dpeak"]:>8.1f}{r["spikes"]:>7d}{r["aud"]:>9.1f}')

print()
print('解读：')
print('  推近%     >0 表示主体在画面中变大 = dolly in 生效')
print('  帧差均值  越大动作越剧烈')
print('  尖峰数    帧差 >3倍均值的次数，越多越像跳切（提示词要求 one continuous take）')
print('  音频动态  分段 RMS 的极差(dB)，越大说明有鼓点/事件起伏')
