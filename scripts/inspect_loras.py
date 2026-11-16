"""读取 safetensors 头部元数据，看 LoRA 自己声明了什么推荐参数。"""
import json
import os
import struct
import sys


def read_header(path):
    with open(path, 'rb') as f:
        n = struct.unpack('<Q', f.read(8))[0]
        raw = f.read(n)
    return json.loads(raw.decode('utf-8'))


LORA_DIR = r'F:\AI视频\ai-runtime\ComfyUI\models\loras'
for name in sorted(os.listdir(LORA_DIR)):
    if not name.endswith('.safetensors'):
        continue
    p = os.path.join(LORA_DIR, name)
    print('=' * 70)
    print(name, f'{os.path.getsize(p)/1024**3:.2f} GB')
    try:
        h = read_header(p)
    except Exception as e:
        print('  header read failed:', e)
        continue
    meta = h.get('__metadata__', {})
    if meta:
        print('  --- __metadata__ ---')
        for k, v in meta.items():
            print(f'    {k} = {v}')
    else:
        print('  (no __metadata__)')
    tensors = [k for k in h if k != '__metadata__']
    print(f'  tensor count: {len(tensors)}')
    print('  sample keys:')
    for k in tensors[:4]:
        print('   ', k)
