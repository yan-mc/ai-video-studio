/**
 * 占位后端（**仅用于测试/演示**，绝不可用于真实产出）。
 *
 * 它不做任何模型推理：用便携 ffmpeg 生成一张纯色卡片视频，把提示词文本
 * 直接烧录在画面中央，用来在没有显卡/没有 ComfyUI 的环境里跑通 UI 与任务
 * 流程（提交 → 轮询 → 产物回填 → 预览）。
 *
 * ⚠️ 它产出的不是"内容"，只是一个带提示词文字的色卡。任何真实交付都必须走
 *    H3 本地后端（h3-local / h3-image）。`PLACEHOLDER` 常量就是给上层做
 *    这种区分用的。
 */
import fs from 'node:fs';
import path from 'node:path';
import { toRel } from './comfy-client.js';
import { resolveFfmpeg, runProcess } from './ffmpeg-tools.js';

/** 标识：这个后端产出的是占位物，不是真实内容 */
export const PLACEHOLDER = true;

/**
 * Mock 后端：用便携 ffmpeg 生成占位视频，保证无 key 时全流程可测。
 * 与真实链路返回结构一致（outputs[{role,path}]）。
 */
export async function runMock({ cfg, job, shot, prompt }) {
  const dur = Math.max(1, Math.min(15, Number(shot?.durationSec) || 5));
  const dir = path.join(cfg.dataDir, 'outputs');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${job.id}.mp4`);
  const ffmpeg = resolveFfmpeg(cfg);

  const text = String(prompt || 'mock').slice(0, 40).replace(/[:\\/']/g, ' ');
  const args = [
    '-y', '-f', 'lavfi',
    '-i', `color=c=0x101418:s=960x540:d=${dur},drawtext=text='${text}':fontcolor=0xE8E4DC:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2`,
    '-f', 'lavfi', '-i', `anullsrc=r=32000:cl=stereo`,
    '-t', String(dur),
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '32k',
    '-shortest', dest,
  ];
  await runProcess(ffmpeg, args, 120000);
  const bytes = fs.statSync(dest).size;
  return { outputs: [{ role: 'video', path: dest, rel: toRel(cfg, dest), bytes, mime: 'video/mp4' }], remoteId: null };
}
