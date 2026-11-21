"""换人效果客观评估 —— 用 InsightFace 人脸相似度量化"身份漂移"。

==========================================================================
为什么需要它
==========================================================================

上一轮所有关于"漂没漂"的结论都是**肉眼看截图**得出的：
"段2 段中漂成金发 ✗"。这有两个问题：

  1. 无法比较不同参数之间的强弱（"缓解了"到底缓解了多少？）
  2. 无法定位漂移的精确帧（"第 5 帧就翻车"是估的）

锥形加噪这条路线要证明有效，必须有可复现的数字。

==========================================================================
指标定义
==========================================================================

对每一帧，检测画面里的人脸，取 512 维 ArcFace embedding，
分别与两张锚脸算余弦相似度：

    sim_target  —— 与「目标角色」参考图的相似度  （希望它高）
    sim_source  —— 与「源角色」参考图的相似度    （希望它低）

判据不是单看 sim_target 的绝对值（不同图之间基准不同），
而是看**相对优势**：

    margin = sim_target - sim_source

    margin > 0   → 这一帧更像目标角色（换人成功）
    margin < 0   → 这一帧回退成源角色（漂移）

这样即使两张锚脸的 embedding 本身很接近，也能给出方向性判断。

==========================================================================
输出
==========================================================================

  · 逐帧 CSV（frame, sim_target, sim_source, margin, face_found）
  · 汇总：均值 / 中位数 / 负 margin 帧占比（= 漂移帧率）
  · 分段汇总：每 N 帧一档，看漂移集中在哪个区间

用法：
  python eval_replace.py --video <成片> --target <目标参考图> --source <源角色参考图>
                         [--stride 1] [--csv out.csv] [--max-frames 0]
"""

import argparse
import csv
import os
import sys

import numpy as np


def load_app(det_size=640):
    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=-1, det_size=(det_size, det_size))
    return app


def biggest_face(app, bgr):
    """取画面里面积最大的人脸 —— 换人任务的主角通常就是最大的那个。"""
    faces = app.get(bgr)
    if not faces:
        return None
    return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))


def embed_image(app, path):
    """读一张图并返回最大人脸的归一化 embedding。"""
    import cv2
    # 中文路径下 cv2.imread 会静默失败，必须用 imdecode
    img = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f'无法读取图片：{path}')
    face = biggest_face(app, img)
    if face is None:
        raise SystemExit(f'图里没检测到人脸：{path}')
    v = face.normed_embedding
    return v / (np.linalg.norm(v) + 1e-12)


def cosine(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))


def iter_frames(path, stride=1, max_frames=0):
    """逐帧读视频，产出 (frame_index, bgr)。"""
    import cv2
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise SystemExit(f'无法打开视频：{path}')
    idx = 0
    emitted = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % stride == 0:
            yield idx, frame
            emitted += 1
            if max_frames and emitted >= max_frames:
                break
        idx += 1
    cap.release()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--video', required=True)
    ap.add_argument('--target', required=True, help='目标角色参考图')
    ap.add_argument('--source', required=True, help='源角色参考图（用于算「回退」）')
    ap.add_argument('--stride', type=int, default=1)
    ap.add_argument('--max-frames', type=int, default=0)
    ap.add_argument('--csv', default='')
    ap.add_argument('--bucket', type=int, default=24, help='分段汇总的桶大小（帧）')
    args = ap.parse_args()

    app = load_app()
    v_target = embed_image(app, args.target)
    v_source = embed_image(app, args.source)

    base = cosine(v_target, v_source)
    print(f'锚脸互相相似度（基准）：{base:.4f}')
    print('  注意：两张锚脸越像，margin 的绝对值越不可靠；看趋势与符号即可。')
    print()

    rows = []
    for fi, frame in iter_frames(args.video, args.stride, args.max_frames):
        face = biggest_face(app, frame)
        if face is None:
            rows.append((fi, None, None, None, 0))
            print(f'  frame {fi:5d}  [NOFACE]')
            continue
        v = face.normed_embedding
        v = v / (np.linalg.norm(v) + 1e-12)
        st = cosine(v, v_target)
        ss = cosine(v, v_source)
        margin = st - ss
        rows.append((fi, st, ss, margin, 1))
        flag = '[OK]' if margin > 0 else '[DRIFT]'
        print(f'  frame {fi:5d}  sim_target={st:.4f}  sim_source={ss:.4f}  '
              f'margin={margin:+.4f}  {flag}')

    found = [r for r in rows if r[4]]
    if not found:
        print('\n没有任何一帧检出人脸，无法评估。')
        return 2

    margins = np.array([r[3] for r in found])
    targets = np.array([r[1] for r in found])
    sources = np.array([r[2] for r in found])
    neg = int((margins < 0).sum())

    print()
    print('=' * 60)
    print(f'总帧数 {len(rows)}，检出人脸 {len(found)}（{len(found)/len(rows)*100:.1f}%）')
    print(f'sim_target  均值 {targets.mean():.4f}  中位 {np.median(targets):.4f}  最小 {targets.min():.4f}')
    print(f'sim_source  均值 {sources.mean():.4f}  中位 {np.median(sources):.4f}  最大 {sources.max():.4f}')
    print(f'margin      均值 {margins.mean():+.4f}  中位 {np.median(margins):+.4f}  最小 {margins.min():+.4f}')
    print(f'回退帧（margin<0）：{neg} / {len(found)} = {neg/len(found)*100:.1f}%')
    print('=' * 60)

    # 分段汇总：看漂移是否集中在某些区间
    print()
    print(f'分段趋势（每 {args.bucket} 帧一桶）：')
    for start in range(0, len(rows), args.bucket):
        chunk = [r for r in rows[start:start + args.bucket] if r[4]]
        if not chunk:
            continue
        m = np.array([r[3] for r in chunk])
        negc = int((m < 0).sum())
        bar = '#' * int(max(0, (m.mean() + 0.2)) * 50)
        print(f'  {start:5d}-{start+len(chunk)-1:5d}  '
              f'margin均值 {m.mean():+.4f}  回退 {negc:2d}/{len(chunk):2d}  {bar}')

    if args.csv:
        os.makedirs(os.path.dirname(args.csv) or '.', exist_ok=True)
        with open(args.csv, 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            w.writerow(['frame', 'sim_target', 'sim_source', 'margin', 'face_found'])
            for r in rows:
                w.writerow(['' if v is None else (f'{v:.6f}' if isinstance(v, float) else v)
                            for v in r])
        print(f'\n逐帧 CSV 已写入：{args.csv}')

    return 0


if __name__ == '__main__':
    sys.exit(main())
