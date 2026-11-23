/**
 * 南风 V15 参数定义 —— 从 ComfyUI object_info 实测导出
 *
 * 来源：vendor/nanfeng/h3_generator.py 的 INPUT_TYPES()
 * 参数总数：221
 *
 * ⚠️ 数值型 COMBO（如「尺寸倍数」[32]、「H3潜空间对齐」[2,4,8,16,32]）
 *    的 default 与 options 必须是**数字**，不能是字符串。
 *    ComfyUI 校验做严格类型比较：字符串 '32' 不等于整数 32，
 *    会报 value_not_in_list 导致整条生成失败。
 *
 * 分组：
 *   A  核心参数 —— 模型、VAE、采样、分辨率、提示词（29 个）
 *   B  素材槽位 —— 图片1-9 / 视频1-3 / 音频1-3（15 个）
 *   C  生成模式 —— 文生视频 / 图生视频 / 首尾帧（三选一）（3 个）
 *   D  二次采样 —— 潜空间放大 + 二采精修（23 个）
 *   E  显存控制 —— 分块处理、运行时预留（5 个）
 *   F  注意力与加速 —— SLA / SolAttn / T8 / Sigma 策略（37 个）
 *   G  LoRA —— 最多 8 组（25 个）
 *   H  小脸修复 —— 身份参考、全局修复（14 个）
 *   I  潜空间续写 —— 跨镜头 AV latent 续接（7 个）
 *   J  音频驱动 —— 锁音频、智能音频驱动（13 个）
 *   K  预览与超分 —— 实时预览 / RTX / DLSS / TRT（41 个）
 *   L  南风采样器 —— ER-SDE 求解器参数（5 个）
 *
 * ============================================================================
 * 参数的「人话说明」在 param-docs.js
 * ============================================================================
 *
 * 本文件只声明参数的**机读元信息**（分组 / 类型 / 默认值 / 候选值），
 * 面向用户的说明写在 `param-docs.js`，由 `enrichSchema()` 合并后下发前端。
 * 这样拆分的好处：schema 保持与 ComfyUI object_info 逐字段可 diff，
 * 文案可以独立迭代而不会碰坏类型约束。
 */
import { PARAM_DOCS, GROUP_DOCS } from './param-docs.js';

/** 分组元信息 */
export const GROUPS = Object.freeze({
  A: { id: 'A', name: '核心参数', desc: '模型、VAE、采样、分辨率、提示词', count: 29 },
  B: { id: 'B', name: '素材槽位', desc: '图片1-9 / 视频1-3 / 音频1-3', count: 15 },
  C: { id: 'C', name: '生成模式', desc: '文生视频 / 图生视频 / 首尾帧（三选一）', count: 3 },
  D: { id: 'D', name: '二次采样', desc: '潜空间放大 + 二采精修', count: 23 },
  E: { id: 'E', name: '显存控制', desc: '分块处理、运行时预留', count: 5 },
  F: { id: 'F', name: '注意力与加速', desc: 'SLA / SolAttn / T8 / Sigma 策略', count: 37 },
  G: { id: 'G', name: 'LoRA', desc: '最多 8 组', count: 25 },
  H: { id: 'H', name: '小脸修复', desc: '身份参考、全局修复', count: 14 },
  I: { id: 'I', name: '潜空间续写', desc: '跨镜头 AV latent 续接 + 换人抗漂移加噪', count: 11 },
  J: { id: 'J', name: '音频驱动', desc: '锁音频、智能音频驱动', count: 13 },
  K: { id: 'K', name: '预览与超分', desc: '实时预览 / RTX / DLSS / TRT', count: 41 },
  L: { id: 'L', name: '南风采样器', desc: 'ER-SDE 求解器参数', count: 5 },
});

/** 全部参数定义：name → { group, type, default, options } */
export const PARAMS = Object.freeze({
  '模型': { group: 'A', type: 'COMBO', default: 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors', options: ['minimax_h3_fl2va_pruned_fp8_scaled.safetensors', 'minimax_h3_fl2va_pruned_int8_convrot.safetensors', 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors'] },
  '文本编码器': { group: 'A', type: 'COMBO', default: 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors', options: ['qwen3vl_32b_minimax_h3_int8_convrot.safetensors'] },
  '文本编码器类型': { group: 'A', type: 'COMBO', default: 'minimax', options: ['minimax'] },
  '文本编码器设备': { group: 'A', type: 'COMBO', default: 'default', options: ['default', 'cpu'] },
  '视频VAE': { group: 'A', type: 'COMBO', default: 'minimax_h3_video_vae_fp16.safetensors', options: ['minimax_h3_video_vae_fp16.safetensors'] },
  '音频VAE': { group: 'A', type: 'COMBO', default: 'minimax_h3_audio_vae_fp32.safetensors', options: ['minimax_h3_audio_vae_fp32.safetensors'] },
  '模型权重精度': { group: 'A', type: 'COMBO', default: 'default', options: ['default', 'fp8_e4m3fn', 'fp8_e5m2'] },
  'SageAttention': { group: 'A', type: 'COMBO', default: 'auto', options: ['disabled', 'auto', 'sageattn_qk_int8_pv_fp16_cuda', 'sageattn_qk_int8_pv_fp16_triton', 'sageattn_qk_int8_pv_fp8_cuda', 'sageattn_qk_int8_pv_fp8_cuda++', 'sageattn3', 'sageattn3_per_block_mean'] },
  '允许编译': { group: 'A', type: 'BOOLEAN', default: false },
  '画面比例': { group: 'A', type: 'COMBO', default: '16:9 (Widescreen)', options: ['原图比例', '1:1 (Square)', '2:3 (Portrait Photo)', '3:2 (Photo)', '3:4 (Portrait Standard)', '4:3 (Standard)', '9:16 (Portrait Widescreen)', '16:9 (Widescreen)', '21:9 (Ultrawide)'] },
  '百万像素': { group: 'A', type: 'COMBO', default: 0.4, options: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.98, 1.0, 1.2, 1.5, 1.8, 2.0] },
  '尺寸倍数': { group: 'A', type: 'COMBO', default: 32, options: [32] },
  '时长秒': { group: 'A', type: 'FLOAT', default: 5.0 },
  '提示词': { group: 'A', type: 'STRING', default: '' },
  '随机种子': { group: 'A', type: 'INT', default: 470115107471061 },
  '调度器': { group: 'A', type: 'COMBO', default: 'simple', options: ['simple', 'sgm_uniform', 'karras', 'exponential', 'ddim_uniform', 'beta', 'normal', 'linear_quadratic', 'kl_optimal'] },
  '采样步数': { group: 'A', type: 'INT', default: 20 },
  '降噪强度': { group: 'A', type: 'FLOAT', default: 1.0 },
  '参考图尺寸': { group: 'A', type: 'COMBO', default: 'match', options: ['match', 'max'] },
  '固定随机种子': { group: 'A', type: 'BOOLEAN', default: false },
  '每区间细分': { group: 'A', type: 'INT', default: 2 },
  '加密曲线': { group: 'A', type: 'COMBO', default: 'cosine', options: ['cosine', 'linear', 'sine'] },
  '启用双采样': { group: 'A', type: 'BOOLEAN', default: false },
  '双采后段比例': { group: 'A', type: 'FLOAT', default: 0.5 },
  '双采后段采样器': { group: 'A', type: 'COMBO', default: 'res_multistep', options: ['res_multistep', 'euler'] },
  '一采步数': { group: 'A', type: 'INT', default: 20 },
  '启动准备': { group: 'A', type: 'COMBO', default: '关闭（原始输出）', options: ['关闭（原始输出）'] },
  'H3一采步数': { group: 'A', type: 'INT', default: 6 },
  '参考图最长边': { group: 'A', type: 'COMBO', default: 1920, options: [1280, 1536, 1920, 2560, 3072, 3840] },
  '图片1': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '图片2': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '图片3': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '图片4': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '图片5': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '图片6': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '图片7': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '图片8': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '图片9': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '视频1': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '视频2': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '视频3': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '音频1': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '音频2': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '音频3': { group: 'B', type: 'COMBO', default: '未选择', options: ['未选择', '3d'] },
  '文生视频': { group: 'C', type: 'BOOLEAN', default: false },
  '图生视频': { group: 'C', type: 'BOOLEAN', default: false },
  '首尾帧': { group: 'C', type: 'BOOLEAN', default: false },
  '启用高清二采': { group: 'D', type: 'BOOLEAN', default: false },
  '二采百万像素': { group: 'D', type: 'COMBO', default: 1.0, options: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.98, 1.0, 1.2, 1.5, 1.8, 2.0] },
  '二采放大方法': { group: 'D', type: 'COMBO', default: 'lanczos', options: ['lanczos', 'bicubic', 'bilinear', 'nearest-exact'] },
  '二采步数': { group: 'D', type: 'INT', default: 6 },
  '二采降噪': { group: 'D', type: 'FLOAT', default: 0.2 },
  '二采采样器': { group: 'D', type: 'COMBO', default: 'res_multistep', options: ['res_multistep', 'euler'] },
  '二采调度器': { group: 'D', type: 'COMBO', default: 'simple', options: ['simple', 'beta'] },
  '二采模型': { group: 'D', type: 'COMBO', default: '跟随一采模型（质量优先）', options: ['跟随一采模型（质量优先）', '自动轻量模型（Ref / FL匹配）', 'minimax_h3_fl2va_pruned_fp8_scaled.safetensors', 'minimax_h3_fl2va_pruned_int8_convrot.safetensors', 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors'] },
  '二采起始Sigma': { group: 'D', type: 'FLOAT', default: 0.2 },
  '启用H3潜空间放大二采': { group: 'D', type: 'BOOLEAN', default: false },
  'H3潜空间放大模型': { group: 'D', type: 'COMBO', default: 'minimax_h3_latent_upscaler_3d_conv_v1_fp16.safetensors', options: ['minimax_h3_latent_upscaler_3d_conv_v1_fp16.safetensors'] },
  'H3潜空间目标百万像素': { group: 'D', type: 'FLOAT', default: 1.0 },
  'H3潜空间对齐': { group: 'D', type: 'COMBO', default: 2, options: [2, 4, 8, 16, 32] },
  'H3潜空间精度': { group: 'D', type: 'COMBO', default: 'fp16', options: ['fp16', 'bf16', 'fp32'] },
  'H3二采Sigma': { group: 'D', type: 'STRING', default: '0.35, 0.22, 0.12, 0.05, 0' },
  'H3二采LoRA模式': { group: 'D', type: 'COMBO', default: '继承一采LoRA', options: ['继承一采LoRA'] },
  'H3二采LoRA': { group: 'D', type: 'STRING', default: '' },
  'H3二采LoRA强度': { group: 'D', type: 'FLOAT', default: 0.6 },
  'H3二采步数': { group: 'D', type: 'INT', default: 4 },
  'H3完整Sigma序列': { group: 'D', type: 'STRING', default: '' },
  'V81一采使用手动Sigma': { group: 'D', type: 'BOOLEAN', default: false },
  '启用潜空间续写': { group: 'D', type: 'BOOLEAN', default: false },
  '潜空间续写任务': { group: 'D', type: 'STRING', default: '' },
  '分块处理（节约显存）': { group: 'E', type: 'COMBO', default: '关闭', options: ['关闭'] },
  '分块卸载层数': { group: 'E', type: 'INT', default: 50 },
  '低显存注意力分头数': { group: 'E', type: 'INT', default: 10 },
  '运行时预留显存GB': { group: 'E', type: 'FLOAT', default: 0.6 },
  '启用运行时预留显存': { group: 'E', type: 'BOOLEAN', default: false },
  '启用SolAttn': { group: 'F', type: 'BOOLEAN', default: false },
  'SolAttn_tau': { group: 'F', type: 'FLOAT', default: 1.2 },
  'SolAttn阈值类型': { group: 'F', type: 'COMBO', default: 'diag', options: ['diag', 'exact'] },
  'SolAttn精确模式': { group: 'F', type: 'COMBO', default: 'exact_kv', options: ['off', 'exact_kv', 'exact_kv_and_rows'] },
  'SolAttn完整末步': { group: 'F', type: 'INT', default: 1 },
  'SolAttn末段比例': { group: 'F', type: 'FLOAT', default: 0.0 },
  'SolAttn前缀Token': { group: 'F', type: 'INT', default: 0 },
  '启用T8缓存': { group: 'F', type: 'BOOLEAN', default: false },
  'T8残差阈值': { group: 'F', type: 'FLOAT', default: 0.12 },
  'T8开始比例': { group: 'F', type: 'FLOAT', default: 0.08 },
  'T8结束比例': { group: 'F', type: 'FLOAT', default: 0.95 },
  'T8连续命中': { group: 'F', type: 'INT', default: 2 },
  'T8缓存设备': { group: 'F', type: 'COMBO', default: 'cpu', options: ['cpu', 'gpu'] },
  'T8指标步幅': { group: 'F', type: 'INT', default: 8 },
  'T8详细日志': { group: 'F', type: 'BOOLEAN', default: false },
  '启用西格玛调节': { group: 'F', type: 'BOOLEAN', default: false },
  '视频西格玛偏移': { group: 'F', type: 'FLOAT', default: 12.0 },
  '音频西格玛偏移': { group: 'F', type: 'FLOAT', default: 3.0 },
  '西格玛模式': { group: 'F', type: 'COMBO', default: '低西格玛加密', options: ['低西格玛加密', '手动序列'] },
  '低西格玛开始': { group: 'F', type: 'FLOAT', default: 0.8 },
  '低西格玛结束': { group: 'F', type: 'FLOAT', default: 0.0 },
  '手动西格玛': { group: 'F', type: 'STRING', default: '1, 0.988235, 0.972973, 0.952381, 0.923077, 0.878049, 0.8, 0.631579, 0' },
  'H3专用注意力': { group: 'F', type: 'COMBO', default: 'H3专用Sage加速', options: ['关闭', '自动', 'sageattn_qk_int8_pv_fp16_cuda', 'sageattn_qk_int8_pv_fp16_triton', 'sageattn_qk_int8_pv_fp8_cuda', 'sageattn_qk_int8_pv_fp8_cuda++', 'H3专用Sage加速'] },
  'Sigma策略': { group: 'F', type: 'COMBO', default: '原生轨迹（不加步）', options: ['原生轨迹（不加步）', '面板Sigma轨迹', '最终区间增加1步'] },
  '全局修复Sigma策略': { group: 'F', type: 'COMBO', default: '最终区间增加1步', options: ['原生修复轨迹', '最终区间增加1步', '低Sigma加密'] },
  '启用UniBlockSwap': { group: 'F', type: 'BOOLEAN', default: false },
  'UniBlockSwap常驻块数': { group: 'F', type: 'INT', default: 1 },
  '启用H3 SLA': { group: 'F', type: 'BOOLEAN', default: false },
  'SLA稀疏率': { group: 'F', type: 'FLOAT', default: 0.9 },
  'SLA块大小': { group: 'F', type: 'COMBO', default: '64', options: ['64', '128'] },
  'SLA最短序列': { group: 'F', type: 'INT', default: 4096 },
  'SLA末尾稠密步数': { group: 'F', type: 'INT', default: 1 },
  'SLA保护音频': { group: 'F', type: 'BOOLEAN', default: true },
  'SLA指定稠密步': { group: 'F', type: 'STRING', default: '0' },
  'SLA稠密后端': { group: 'F', type: 'COMBO', default: 'comfy_kitchen', options: ['comfy_kitchen', 'pytorch', 'sage:auto', 'sage:qk_int8_pv_fp16_cuda', 'sage:qk_int8_pv_fp16_triton', 'sage:qk_int8_pv_fp8_cuda', 'sage:qk_int8_pv_fp8_cuda++', 'auto'] },
  'SLA关闭FP16累加': { group: 'F', type: 'BOOLEAN', default: true },
  'SLA稳定运动': { group: 'F', type: 'BOOLEAN', default: true },
  '启用LoRA': { group: 'G', type: 'BOOLEAN', default: false },
  'LoRA1': { group: 'G', type: 'COMBO', default: '未选择', options: ['未选择', 'dmad_minimax_h3_4step_full_critic_comfyui.safetensors', 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors'] },
  'LoRA1强度': { group: 'G', type: 'FLOAT', default: 1.0 },
  'LoRA2': { group: 'G', type: 'COMBO', default: '未选择', options: ['未选择', 'dmad_minimax_h3_4step_full_critic_comfyui.safetensors', 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors'] },
  'LoRA2强度': { group: 'G', type: 'FLOAT', default: 1.0 },
  'LoRA3': { group: 'G', type: 'COMBO', default: '未选择', options: ['未选择', 'dmad_minimax_h3_4step_full_critic_comfyui.safetensors', 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors'] },
  'LoRA3强度': { group: 'G', type: 'FLOAT', default: 1.0 },
  'LoRA1启用': { group: 'G', type: 'BOOLEAN', default: true },
  'LoRA2启用': { group: 'G', type: 'BOOLEAN', default: true },
  'LoRA3启用': { group: 'G', type: 'BOOLEAN', default: true },
  'LoRA4': { group: 'G', type: 'COMBO', default: '未选择', options: ['未选择', 'dmad_minimax_h3_4step_full_critic_comfyui.safetensors', 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors'] },
  'LoRA4强度': { group: 'G', type: 'FLOAT', default: 1.0 },
  'LoRA4启用': { group: 'G', type: 'BOOLEAN', default: false },
  'LoRA5': { group: 'G', type: 'COMBO', default: '未选择', options: ['未选择', 'dmad_minimax_h3_4step_full_critic_comfyui.safetensors', 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors'] },
  'LoRA5强度': { group: 'G', type: 'FLOAT', default: 1.0 },
  'LoRA5启用': { group: 'G', type: 'BOOLEAN', default: false },
  'LoRA6': { group: 'G', type: 'COMBO', default: '未选择', options: ['未选择', 'dmad_minimax_h3_4step_full_critic_comfyui.safetensors', 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors'] },
  'LoRA6强度': { group: 'G', type: 'FLOAT', default: 1.0 },
  'LoRA6启用': { group: 'G', type: 'BOOLEAN', default: false },
  'LoRA7': { group: 'G', type: 'COMBO', default: '未选择', options: ['未选择', 'dmad_minimax_h3_4step_full_critic_comfyui.safetensors', 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors'] },
  'LoRA7强度': { group: 'G', type: 'FLOAT', default: 1.0 },
  'LoRA7启用': { group: 'G', type: 'BOOLEAN', default: false },
  'LoRA8': { group: 'G', type: 'COMBO', default: '未选择', options: ['未选择', 'dmad_minimax_h3_4step_full_critic_comfyui.safetensors', 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors'] },
  'LoRA8强度': { group: 'G', type: 'FLOAT', default: 1.0 },
  'LoRA8启用': { group: 'G', type: 'BOOLEAN', default: false },
  '单人小脸修复': { group: 'H', type: 'BOOLEAN', default: false },
  '多人小脸修复': { group: 'H', type: 'BOOLEAN', default: false },
  '人物1身份参考': { group: 'H', type: 'COMBO', default: '图片1', options: ['图片1', '图片2', '图片3', '图片4', '图片5', '图片6', '图片7', '图片8', '图片9'] },
  '人物2身份参考': { group: 'H', type: 'COMBO', default: '图片2', options: ['图片1', '图片2', '图片3', '图片4', '图片5', '图片6', '图片7', '图片8', '图片9'] },
  '人物1图中位置': { group: 'H', type: 'COMBO', default: '自动（最大脸）', options: ['自动（最大脸）', '最左人物', '左起第2人', '左起第3人', '最右人物'] },
  '人物2图中位置': { group: 'H', type: 'COMBO', default: '自动（最大脸）', options: ['自动（最大脸）', '最左人物', '左起第2人', '左起第3人', '最右人物'] },
  '全局修复': { group: 'H', type: 'BOOLEAN', default: false },
  '全局修复倍率': { group: 'H', type: 'COMBO', default: 1.5, options: [1.25, 1.5, 1.75, 2.0] },
  '全局修复LoRA模式': { group: 'H', type: 'COMBO', default: '专用4步LoRA', options: ['专用4步LoRA', '继承主生成LoRA', '不使用LoRA'] },
  '全局修复LoRA': { group: 'H', type: 'COMBO', default: '自动选择4步LoRA', options: ['自动选择4步LoRA'] },
  '全局修复LoRA强度': { group: 'H', type: 'FLOAT', default: 0.75 },
  '全局修复步数': { group: 'H', type: 'INT', default: 4 },
  '全局修复降噪': { group: 'H', type: 'FLOAT', default: 0.28 },
  '全局修复范围': { group: 'H', type: 'COMBO', default: '全画面双区', options: ['全画面双区', '仅第一区（横图左/竖图上）', '仅第二区（横图右/竖图下）'] },
  'context_length': { group: 'I', type: 'COMBO', default: '22', options: ['22', '5', '39', '56'] },
  'audio_context_length': { group: 'I', type: 'INT', default: 24 },
  /**
   * 换人续写链的抗身份漂移：给上下文注入锥形噪声。
   *
   * 默认关闭 —— 叙事续写（非换人）需要干净上下文来保持画面质感，
   * 换人线才会在 overrides 里把它打开。
   * 机制与出处见 vendor/nanfeng/context_taper_noise.py。
   */
  '启用续写上下文加噪': { group: 'I', type: 'BOOLEAN', default: false },
  '续写加噪强度': { group: 'I', type: 'FLOAT', default: 0.45 },
  '续写加噪末档强度': { group: 'I', type: 'FLOAT', default: 0.1 },
  '续写加噪斜坡步数': { group: 'I', type: 'INT', default: 2 },
  '启用续写音频精修': { group: 'I', type: 'BOOLEAN', default: false },
  '续写音频降噪强度': { group: 'I', type: 'FLOAT', default: 0.3 },
  '续写音频精修步数': { group: 'I', type: 'INT', default: 4 },
  '续写音频采样器': { group: 'I', type: 'COMBO', default: 'euler', options: ['euler', 'euler_cfg_pp', 'euler_ancestral', 'euler_ancestral_cfg_pp', 'heun', 'heunpp2', 'exp_heun_2_x0', 'exp_heun_2_x0_sde', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpm_fast', 'dpm_adaptive', 'dpmpp_2s_ancestral', 'dpmpp_2s_ancestral_cfg_pp', 'dpmpp_sde', 'dpmpp_sde_gpu', 'dpmpp_2m', 'dpmpp_2m_cfg_pp', 'dpmpp_2m_sde', 'dpmpp_2m_sde_gpu', 'dpmpp_2m_sde_heun', 'dpmpp_2m_sde_heun_gpu', 'dpmpp_3m_sde', 'dpmpp_3m_sde_gpu', 'ddpm', 'lcm', 'ipndm', 'ipndm_v', 'deis', 'cfgpp_ud10_ab', 'res_multistep', 'res_multistep_cfg_pp', 'res_multistep_ancestral', 'res_multistep_ancestral_cfg_pp', 'gradient_estimation', 'gradient_estimation_cfg_pp', 'er_sde', 'seeds_2', 'seeds_3', 'sa_solver', 'sa_solver_pece', 'ddim', 'uni_pc', 'uni_pc_bh2'] },
  '续写音频调度器': { group: 'I', type: 'COMBO', default: 'simple', options: ['simple', 'sgm_uniform', 'karras', 'exponential', 'ddim_uniform', 'beta', 'normal', 'linear_quadratic', 'kl_optimal'] },
  '启用锁音频': { group: 'J', type: 'BOOLEAN', default: false },
  '开启音频驱动模式': { group: 'J', type: 'BOOLEAN', default: false },
  '音频驱动文件': { group: 'J', type: 'STRING', default: '' },
  '音频驱动打点': { group: 'J', type: 'STRING', default: '[]' },
  '音频驱动分段图片': { group: 'J', type: 'STRING', default: '{}' },
  '音频驱动分段分镜': { group: 'J', type: 'STRING', default: '{}' },
  '音频驱动创意': { group: 'J', type: 'STRING', default: '' },
  '音频驱动排除范围': { group: 'J', type: 'STRING', default: '{}' },
  '音频驱动当前起点': { group: 'J', type: 'FLOAT', default: 0.0 },
  '音频驱动当前终点': { group: 'J', type: 'FLOAT', default: 0.0 },
  '恒定触发词': { group: 'J', type: 'STRING', default: '' },
  '空5分钟时间轴模式': { group: 'J', type: 'BOOLEAN', default: false },
  '启用TAEH3彩色预览': { group: 'J', type: 'BOOLEAN', default: false },
  '启用实时预览': { group: 'K', type: 'BOOLEAN', default: true },
  '实时预览最长边': { group: 'K', type: 'INT', default: 512 },
  '实时预览帧数': { group: 'K', type: 'INT', default: 12 },
  '实时预览帧率': { group: 'K', type: 'INT', default: 8 },
  '实时预览JPEG质量': { group: 'K', type: 'INT', default: 75 },
  '启用RTX视频超分': { group: 'K', type: 'BOOLEAN', default: false },
  'RTX缩放方式': { group: 'K', type: 'COMBO', default: '倍数缩放', options: ['倍数缩放', '目标尺寸'] },
  'RTX缩放倍数': { group: 'K', type: 'FLOAT', default: 2.0 },
  'RTX目标宽度': { group: 'K', type: 'INT', default: 1920 },
  'RTX目标高度': { group: 'K', type: 'INT', default: 1080 },
  'RTX质量': { group: 'K', type: 'COMBO', default: 'ULTRA', options: ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] },
  '启用TRT视频VAE': { group: 'K', type: 'BOOLEAN', default: false },
  'TRT视频解码引擎': { group: 'K', type: 'COMBO', default: null, options: ['None'] },
  'TRT视频编码引擎': { group: 'K', type: 'COMBO', default: null, options: ['None'] },
  'DLSS超分模式': { group: 'K', type: 'COMBO', default: '关闭', options: ['关闭', '图像批次超分', '视频超分'] },
  '启用DLSS补帧': { group: 'K', type: 'BOOLEAN', default: false },
  'DLSS_video_upscale_mode': { group: 'K', type: 'COMBO', default: '1.5× (Quality)', options: ['1× (DLAA / native)', '1.5× (Quality)', '1.724× (Balanced)', '2× (Performance)', '3× (Ultra Performance)'] },
  'DLSS_video_require_neural_upscaling': { group: 'K', type: 'BOOLEAN', default: false },
  'DLSS_video_nr_preset': { group: 'K', type: 'COMBO', default: 'Default', options: ['Default', 'Preset #1', 'Preset #2', 'Preset #3'] },
  'DLSS_video_nr_style': { group: 'K', type: 'COMBO', default: 'Default', options: ['Default', 'Natural', 'Cinematic'] },
  'DLSS_video_nr_intensity': { group: 'K', type: 'FLOAT', default: 1.0 },
  'DLSS_video_local_tone_strength': { group: 'K', type: 'FLOAT', default: 1.0 },
  'DLSS_video_local_structure_strength': { group: 'K', type: 'FLOAT', default: 1.0 },
  'DLSS_video_skin_structure_strength': { group: 'K', type: 'FLOAT', default: -1.0 },
  'DLSS_video_automatic_mask': { group: 'K', type: 'BOOLEAN', default: false },
  'DLSS_video_dlss_model_preset': { group: 'K', type: 'COMBO', default: 'Default', options: ['Default', 'J', 'K', 'L', 'M'] },
  'DLSS_video_encoding_quality': { group: 'K', type: 'COMBO', default: 'Max', options: ['Auto (Default)', 'Max', 'Best', 'Good'] },
  'DLSS_video_video_codec': { group: 'K', type: 'COMBO', default: 'H.264', options: ['H.264', 'H.264 (NVIDIA NVENC)', 'H.265', 'H.265 (NVIDIA NVENC)', 'AV1', 'AV1 (NVIDIA NVENC)', 'ProRes Proxy'] },
  'DLSS_video_container': { group: 'K', type: 'COMBO', default: 'MP4', options: ['MP4', 'MKV', 'MOV'] },
  'DLSS_video_rename': { group: 'K', type: 'COMBO', default: 'Auto', options: ['Auto', 'Copy', 'Custom'] },
  'DLSS_video_custom_suffix': { group: 'K', type: 'STRING', default: '_DLSS5' },
  'DLSS_video_hdr_mode': { group: 'K', type: 'BOOLEAN', default: false },
  'DLSS_video_output_detail_strength': { group: 'K', type: 'FLOAT', default: 1.0 },
  'DLSS_fg_output_fps': { group: 'K', type: 'COMBO', default: '60', options: ['23.976', '25', '29.97', '30', '50', '59.94', '60', '90', '120'] },
  'DLSS_fg_dlss_engine': { group: 'K', type: 'COMBO', default: 'Auto', options: ['Auto', 'Native DLSSG', 'Cascade'] },
  'DLSS_fg_encoding_quality': { group: 'K', type: 'COMBO', default: 'Max', options: ['Auto (Default)', 'Max', 'Best', 'Good'] },
  'DLSS_fg_video_codec': { group: 'K', type: 'COMBO', default: 'H.264', options: ['H.264', 'H.264 (NVIDIA NVENC)', 'H.265', 'H.265 (NVIDIA NVENC)', 'AV1', 'AV1 (NVIDIA NVENC)', 'ProRes Proxy'] },
  'DLSS_fg_container': { group: 'K', type: 'COMBO', default: 'MP4', options: ['MP4', 'MKV', 'MOV'] },
  'DLSS_fg_rename': { group: 'K', type: 'COMBO', default: 'Auto', options: ['Auto', 'Copy', 'Custom'] },
  'DLSS_fg_custom_suffix': { group: 'K', type: 'STRING', default: '_DLSSFG' },
  'DLSS_fg_hdr_mode': { group: 'K', type: 'BOOLEAN', default: false },
  '采样器': { group: 'L', type: 'COMBO', default: 'er_sde', options: ['euler', 'euler_cfg_pp', 'euler_ancestral', 'euler_ancestral_cfg_pp', 'heun', 'heunpp2', 'exp_heun_2_x0', 'exp_heun_2_x0_sde', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpm_fast', 'dpm_adaptive', 'dpmpp_2s_ancestral', 'dpmpp_2s_ancestral_cfg_pp', 'dpmpp_sde', 'dpmpp_sde_gpu', 'dpmpp_2m', 'dpmpp_2m_cfg_pp', 'dpmpp_2m_sde', 'dpmpp_2m_sde_gpu', 'dpmpp_2m_sde_heun', 'dpmpp_2m_sde_heun_gpu', 'dpmpp_3m_sde', 'dpmpp_3m_sde_gpu', 'ddpm', 'lcm', 'ipndm', 'ipndm_v', 'deis', 'cfgpp_ud10_ab', 'res_multistep', 'res_multistep_cfg_pp', 'res_multistep_ancestral', 'res_multistep_ancestral_cfg_pp', 'gradient_estimation', 'gradient_estimation_cfg_pp', 'er_sde', 'seeds_2', 'seeds_3', 'sa_solver', 'sa_solver_pece', 'ddim', 'uni_pc', 'uni_pc_bh2', '南风采样器'] },
  '南风ER_solver_type': { group: 'L', type: 'COMBO', default: 'ER-SDE', options: ['ER-SDE', 'Reverse-time SDE', 'ODE'] },
  '南风ER_max_stage': { group: 'L', type: 'INT', default: 3 },
  '南风ER_eta': { group: 'L', type: 'FLOAT', default: 1.0 },
  '南风ER_s_noise': { group: 'L', type: 'FLOAT', default: 1.0 },
});

/** 按组取参数名列表 */
export function paramsOfGroup(groupId) {
  return Object.entries(PARAMS).filter(([, d]) => d.group === groupId).map(([k]) => k);
}

/** 取默认值全集（用于构造请求） */
export function defaults() {
  const out = {};
  for (const [k, d] of Object.entries(PARAMS)) out[k] = d.default;
  return out;
}

export const PARAM_COUNT = Object.keys(PARAMS).length;

/* ==========================================================================
 * 面向用户的 schema（带说明文案）
 * ========================================================================== */

/**
 * 把 param-docs.js 的文案合并进 schema，供前端渲染。
 *
 * 输出结构（每个参数）：
 *   { group, type, default, options?, zh?, hint?, flag? }
 * 其中 flag 的语义见 param-docs.js：
 *   dead   = 上游硬编码关闭，调了完全没反应
 *   banned = 上游缺失依赖/主动禁用，开了会报错
 *
 * 为什么不直接改 PARAMS：PARAMS 是**机读约束**（graph.js 用它做类型强制、
 * 测试用它做 object_info 逐字段比对）。把文案混进去会让 diff 变脏。
 */
export function enrichSchema() {
  const params = {};
  for (const [key, def] of Object.entries(PARAMS)) {
    const doc = PARAM_DOCS[key];
    params[key] = {
      ...def,
      ...(doc?.zh ? { zh: doc.zh } : {}),
      ...(doc?.hint ? { hint: doc.hint } : {}),
      ...(doc?.flag ? { flag: doc.flag } : {}),
    };
  }

  const groups = {};
  for (const [id, g] of Object.entries(GROUPS)) {
    const gd = GROUP_DOCS[id];
    groups[id] = {
      ...g,
      ...(gd?.zh ? { zh: gd.zh } : {}),
      // 每组的死参数/禁用参数个数，前端据此显示角标
      dead: params && Object.entries(params).filter(
        ([, d]) => d.group === id && (d.flag === 'dead' || d.flag === 'banned'),
      ).length,
    };
  }

  return { paramCount: PARAM_COUNT, groups, params };
}

/** 全量死参数 / 禁用参数名单（供 UI 与测试使用） */
export function inertParams() {
  return Object.entries(PARAM_DOCS)
    .filter(([, d]) => d.flag === 'dead' || d.flag === 'banned')
    .map(([name, d]) => ({ name, flag: d.flag, zh: d.zh, hint: d.hint ?? '' }));
}
