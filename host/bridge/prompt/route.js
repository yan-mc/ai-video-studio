/**
 * 模式路由 —— 唯一的格式路由器。优先级：有视频/音频 → ref；声明 ref2va 且有图 →
 * ref；关键帧模式 → base（图是帧锚点）；有图未声明 → ref；纯文本 → base。
 * @module prompt/route
 */
import { normalizeMode } from '../../store/models.js';
import { normalizeRefs } from './text-utils.js';

/** @returns {{mode: string, format: 'base'|'ref', reason: string}} */
export function routeFormat(input = {}) {
  const refs = normalizeRefs(input.references ?? input.refs ?? {});
  const declared = normalizeMode(input.mode ?? 'ref2va');
  const imgCount = refs.images.length;
  const vidCount = refs.videos.length;
  const audCount = refs.audios.length;

  // 关键帧模式互斥：官方明确 首尾帧 ⊥ 全参考
  const isKeyframe = declared === 'i2va' || declared === 'fl2va' || declared === 'l2va';
  const hasMedia = vidCount > 0 || audCount > 0;
  const hasAnnouncedFrames = Boolean(refs.firstFrame || refs.lastFrame);
  const wantsFrames = isKeyframe || hasAnnouncedFrames;

  // 只传 subjects（每卡带 pictureIndex）也必须算"有参考素材"，
  // 否则会误判成无素材 → `<Picture N>` 与 retention_analysis 全部消失。
  const subjects = Array.isArray(input.subjects ?? input.characters) ? (input.subjects ?? input.characters) : [];
  const declaredPics = subjects.filter((s) => s && s.pictureIndex != null && s.hasImage !== false).length;

  if (hasMedia) {
    return {
      mode: 'ref2va',
      format: 'ref',
      reason: `有 ${vidCount} 段参考视频 / ${audCount} 段参考音频 —— 基础格式没有 <Video>/<Audio> 概念，必须走 Ref2VA`,
    };
  }

  if (declared === 'ref2va' && (imgCount > 0 || declaredPics > 0)) {
    return {
      mode: 'ref2va',
      format: 'ref',
      reason: imgCount > 0
        ? `声明 Ref2VA 且有 ${imgCount} 张参考图`
        : `声明 Ref2VA 且有 ${declaredPics} 个角色声明了参考图编号`,
    };
  }

  if (wantsFrames) {
    const mode = isKeyframe ? declared : (hasAnnouncedFrames ? 'fl2va' : 't2va');
    return {
      mode,
      format: 'base',
      reason: '关键帧模式：图片是首/尾帧锚点，走基础格式的对齐指令',
    };
  }

  if (imgCount > 0 || declaredPics > 0) {
    return {
      mode: 'ref2va',
      format: 'ref',
      reason: imgCount > 0
        ? `有 ${imgCount} 张参考图但未声明模式 —— 按 Ref2VA 处理（图是外观参考，不是帧锚点）`
        : `有 ${declaredPics} 个角色声明了参考图编号但未声明模式 —— 按 Ref2VA 处理`,
    };
  }

  return { mode: 't2va', format: 'base', reason: '没有任何参考素材，走基础格式的文生视频' };
}