"""核对 DMAD 参数的真实语义（用 ComfyUI 自己的代码算，不靠猜）。"""
import sys

sys.path.insert(0, r'F:\AI视频\ai-runtime\ComfyUI')
import comfy.samplers as S
import comfy.model_sampling as MS


class AV(MS.ModelSamplingAV, MS.CONST):
    pass


av = AV(None)

print('=== 1. audio_shift 到底影响什么 ===')
print('ModelSamplingAV.audio_scale = shift / audio_shift')
print('它只缩放 audio latent，不改变 sigma schedule。但它会被传给 DiT。')
print()
sigs = {}
for sh in (2.0, 3.0):
    av.set_parameters(shift=12.0, audio_shift=sh)
    sg = S.calculate_sigmas(av, 'simple', 8)
    sigs[sh] = [round(x, 4) for x in sg.tolist()]
    print(f'audio_shift={sh}: audio_scale={av.audio_scale:.4f}')
    print('   video sigmas(8):', sigs[sh])
print()
print('视频 sigma 完全一致:', sigs[2.0] == sigs[3.0])
print('唯一差别是 audio_scale 这个标量:', 12 / 2.0, 'vs', 12 / 3.0)
print()

print('=== 2. 16 步 vs 8 步 ===')
av.set_parameters(shift=12.0, audio_shift=2.0)
s8 = [round(x, 4) for x in S.calculate_sigmas(av, 'simple', 8).tolist()]
s16 = [round(x, 4) for x in S.calculate_sigmas(av, 'simple', 16).tolist()]
print(' 8步:', s8)
print('16步:', s16)
print()
print('16 步里是否包含 8 步的所有取值?', all(any(abs(a - b) < 1e-3 for b in s16) for a in s8))
print('=> 训练点是 q_i=(N-i)/N，N 变了整条曲线就变。16 步不是"8步更精细"')
print()

print('=== 3. 官方说的"re-noise step rule"和 lcm+simple 关系 ===')
print('DMAD 官方的 MCP/CLI 采样器是自定义的重加噪规则；')
print('ComfyUI 转换版用 **stock lcm + simple** 来近似它（官方 README 原文）。')
print()

print('=== 4. lcm 采样器在本机的实现 ===')
print('lcm in SAMPLER_NAMES:', 'lcm' in S.SAMPLER_NAMES)
