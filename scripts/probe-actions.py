import sys
sys.path.insert(0, r'F:\AI视频\工作室\dsh-jiuzhang-studio\host\blender')
import actions as A

FRAMES = 10
END = 9
dur_sec = (END - 0 + 1) / 24.0
print('dur_sec', dur_sec)
for f in range(FRAMES):
    u = f / float(max(1, END - 0))
    r = A.action_curve('walk', u, dur_sec, 1.0, 1.0)
    hip = r.get('hipL', (0, 0, 0))
    knee = r.get('kneeL', (0, 0, 0))
    sh = r.get('shoulderL', (0, 0, 0))
    print('f=%d u=%.3f hipL_x=%7.2f kneeL_x=%7.2f shoulderL_x=%7.2f' % (f, u, hip[0], knee[0], sh[0]))
