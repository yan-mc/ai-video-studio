/**
 * 3D 导演台控制器 —— 把预演引擎的 15 个 director_* 命令接到插件 API。
 *
 * 引擎能力（已实测）：
 *  - 58 个动作模板 / 28 个运镜 / 7 个人物 / 10 个道具 / 8 个表演风格
 *  - 15 个命令：状态 / 建项目 / 选镜头 / 增改元素 / 应用动作 /
 *    动作关键帧 / 应用运镜 / 机位关键帧 / 镜头管理 / 锁定 / 删除 / 撤销 / 重做 / 校验
 *  - 24fps 整数帧时间轴
 *
 * 设计：插件不重新实现 3D，只做**编排层** —— 把画布/镜头卡/剧本转成导演台工程，
 * 再把导演台的机位数据回填给 H3 的运镜提示词。这是洛书 3D 导演台的核心价值：
 * **预演 → 控制信号**，而不是一张参考图。
 */
import path from 'node:path';
import fs from 'node:fs';

const DEFAULT_BASE = process.env.PREVIZ_URL || 'http://127.0.0.1:4318';

/** 15 个导演命令的元信息（与引擎实测一致） */
export const DIRECTOR_COMMANDS = Object.freeze([
  { name: 'director_get_state', desc: '读完整工程 + 当前帧 + ID + 模板 + 健康问题', args: [] },
  { name: 'director_create_project', desc: '建干净工程（2 演员 / 4 镜头 / 15 秒）', args: ['name'] },
  { name: 'director_select', desc: '选镜头或跳到指定帧', args: ['shot_id', 'frame'] },
  { name: 'director_add_element', desc: '加人物/动物/群演/灰盒道具到所有镜头', args: ['kind', 'preset', 'name', 'color', 'identity_source', 'character_id', 'performance_profile_id'] },
  { name: 'director_update_element', desc: '移动/旋转/缩放/改名/改色', args: ['element_id', 'shot_id', 'shot_only', 'name', 'target_element_id', 'facing', 'color', 'visible', 'height_m', 'pose_id', 'performance_profile_id'] },
  { name: 'director_apply_action', desc: '应用动作模板并生成可编辑动作关键帧', args: ['element_id', 'shot_id', 'action', 'start_frame', 'duration_frames', 'target_element_id', 'facing', 'proximity_m', 'emotion', 'intensity', 'locked', 'source'] },
  { name: 'director_set_motion_keyframe', desc: '加改动作关键帧（含贝塞尔手柄/关节）', args: ['shot_id', 'action_id', 'keyframe_id', 'frame', 'path_mode', 'joints', 'interpolation', 'note', 'locked', 'source', 'override_locked'] },
  { name: 'director_apply_camera', desc: '应用运镜模板并生成可编辑机位关键帧', args: ['shot_id', 'move', 'override_locked'] },
  { name: 'director_set_camera_keyframe', desc: '加改机位关键帧（帧/位置/朝向/FOV/滚转）', args: ['shot_id', 'keyframe_id', 'frame', 'fov', 'roll_deg', 'interpolation', 'note', 'locked', 'source', 'override_locked'] },
  { name: 'director_manage_shot', desc: '增/复制/重命名/重排/删镜头', args: ['operation', 'shot_id', 'name', 'duration_frames', 'index'] },
  { name: 'director_set_lock', desc: '锁定/解锁已确认的动作或关键帧', args: ['target', 'id', 'shot_id', 'locked'] },
  { name: 'director_delete', desc: '删元素/动作/关键帧', args: ['target', 'id', 'shot_id', 'override_locked'] },
  { name: 'director_undo', desc: '撤销一步（历史 50 快照）', args: [] },
  { name: 'director_redo', desc: '重做一步', args: [] },
  { name: 'director_validate', desc: '校验碰撞/重叠/断裂/路径/范围/机位', args: [] },
]);

/** 24fps 帧率 */
export const DIRECTOR_FPS = 24;

export function createDirectorController({ cfg, root }) {
  const state = {
    running: false,
    pid: null,
    base: DEFAULT_BASE,
    lastError: '',
    startedAt: 0,
  };

  /** 低层调用：POST /api/command */
  async function command(name, args = {}, { timeoutMs = 20000 } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(`${state.base}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, arguments: args }),
        signal: ctrl.signal,
      });
      const text = await r.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { ok: false, raw: text }; }
      if (!r.ok || json.ok === false) {
        throw new Error(json.error || json.message || `DIRECTOR_${r.status}`);
      }
      return json.result ?? json;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 读工程状态（含 catalog / runtime / health） */
  async function getState() {
    const r = await fetch(`${state.base}/api/project`);
    if (!r.ok) throw new Error(`DIRECTOR_HTTP_${r.status}`);
    return await r.json();
  }

  /** 健康探测 */
  async function health() {
    try {
      const r = await fetch(`${state.base}/api/health`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
      const j = await r.json();
      return { ok: Boolean(j.ok), base: state.base, detail: j.service ?? '' };
    } catch (e) {
      return { ok: false, detail: String(e?.message ?? e) };
    }
  }

  /** 启动引擎（复用 previz-controller 的 spawn 逻辑） */
  async function start() {
    if (state.running) return { ok: true, ...state };
    // 委托给 previz-controller 启动（同一份引擎）
    const previz = await import('./previz-controller.js');
    const pc = previz.createPrevizController({ root, cfg });
    const r = await pc.start();
    state.running = Boolean(r?.running ?? true);
    state.pid = r?.pid ?? null;
    state.startedAt = Date.now();
    return { ok: true, ...state, ...r };
  }

  async function stop() {
    const previz = await import('./previz-controller.js');
    const pc = previz.createPrevizController({ root, cfg });
    await pc.stop?.();
    state.running = false;
    state.pid = null;
    return { ok: true };
  }

  /* --------------------------------------------------- 编排层（插件价值所在） */

  /**
   * 把镜头卡转成导演台工程。
   * 这是「预演 → 控制信号」的入口。
   */
  async function buildFromShot(shot, opts = {}) {
    const name = opts.name || shot?.title || '未命名镜头';
    await command('director_create_project', { name });

    // 引擎默认 4 个镜头；把第一镜改名并设时长
    // 镜头时长（帧）
    const durFrames = Math.max(
      DIRECTOR_FPS,
      Math.round((Number(shot?.durationSec) || 5) * DIRECTOR_FPS),
    );
    await command('director_manage_shot', {
      operation: 'rename',
      shot_id: opts.shotId,
      name,
      duration_frames: durFrames,
    }).catch(() => { /* 首镜可能已是目标镜头 */ });

    // 运镜：从 shot.camera 文本映射到引擎 move
    if (shot?.camera) {
      const move = mapCameraText(String(shot.camera));
      if (move) {
        await command('director_apply_camera', { shot_id: opts.shotId, move }).catch(() => {});
      }
    }
    return await getState();
  }

  /**
   * 把导演台的机位关键帧转成 H3 运镜提示词。
   * 这是「控制信号 → 提示词」的出口。
   *
   * 实测结构：project.plans[].shots[]，
   * shot 字段：id/name/fov/durationSec/startSec/cameraMove/cameraKeyframes[]
   * keyframe 字段：timeSec/position{x,y,z}/target{x,y,z}/fov/rollDeg/interpolation
   */
  async function toCameraPrompt(shotId) {
    const st = await getState();
    const shots = (st?.project?.plans ?? []).flatMap((p) => p.shots ?? []);
    if (!shots.length) throw new Error('DIRECTOR_NO_SHOTS: 导演台工程里还没有镜头');

    const shot = shotId ? shots.find((s) => s.id === shotId) : shots.find((s) => s.id === st?.project?.activeShotId) ?? shots[0];
    if (!shot) throw new Error('DIRECTOR_SHOT_NOT_FOUND');

    const kfs = Array.isArray(shot.cameraKeyframes) ? shot.cameraKeyframes : [];
    const moveId = shot.cameraMove ?? 'static';
    const moveLabel = CAMERA_MOVES.find((m) => m.id === moveId)?.label ?? moveId;
    const lines = [];

    // 运镜模板本身（引擎已标注，直接可用）
    lines.push(moveLabel);

    // 起止机位差 → 更细的运动描述
    const first = kfs[0];
    const last = kfs[kfs.length - 1];
    if (first && last && kfs.length > 1) {
      const dx = (last.position?.x ?? 0) - (first.position?.x ?? 0);
      const dy = (last.position?.y ?? 0) - (first.position?.y ?? 0);
      const dz = (last.position?.z ?? 0) - (first.position?.z ?? 0);
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 2) lines.push(`位移 ${dist.toFixed(1)}m`);
      if (Math.abs(dz) > 1.5 && Math.abs(dz) >= Math.abs(dx)) {
        lines.push(dz < 0 ? '机位前移' : '机位后撤');
      } else if (Math.abs(dx) > 1.5) {
        lines.push(dx > 0 ? '机位右移' : '机位左移');
      }
      if (Math.abs(dy) > 1.2) lines.push(dy > 0 ? '机位升高' : '机位降低');

      const fov0 = first.fov ?? shot.fov ?? 50;
      const fov1 = last.fov ?? shot.fov ?? 50;
      if (fov1 < fov0 - 5) lines.push(`FOV ${fov0}→${fov1}（收紧）`);
      else if (fov1 > fov0 + 5) lines.push(`FOV ${fov0}→${fov1}（放宽）`);
      else lines.push(`FOV ${fov0}`);

      const roll = (last.rollDeg ?? 0) - (first.rollDeg ?? 0);
      if (Math.abs(roll) > 5) lines.push(`${roll > 0 ? '右' : '左'}倾 ${Math.abs(roll).toFixed(0)}°`);
    }

    const durationSec = Number(shot.durationSec ?? 3.75);
    return {
      shotId: shot.id,
      shotName: shot.name,
      durationSec,
      fov: shot.fov,
      cameraMove: moveId,
      cameraMoveLabel: moveLabel,
      keyframes: kfs.length,
      motion: lines.join('，'),
      promptFragment: `运镜：${lines.join('，')}`,
      raw: { first, last },
    };
  }

  /** 列出导演台工程里所有镜头（供前端选择） */
  async function listShots() {
    const st = await getState();
    return (st?.project?.plans ?? []).flatMap((p) =>
      (p.shots ?? []).map((s) => ({
        id: s.id, name: s.name, fov: s.fov,
        durationSec: s.durationSec, startSec: s.startSec,
        cameraMove: s.cameraMove ?? 'static',
        keyframes: (s.cameraKeyframes ?? []).length,
        actions: (s.actions ?? []).length,
        planId: p.id, planName: p.name,
      })),
    );
  }

  /**
   * 校验并返回可读的问题清单。
   */
  async function validate() {
    const r = await command('director_validate');
    return r;
  }

  /** 把 catalog 转成前端友好的结构 */
  async function catalog() {
    const st = await getState();
    return st.catalog ?? {};
  }

  return {
    command, getState, health, start, stop,
    buildFromShot, toCameraPrompt, listShots, validate, catalog,
    state,
  };
}

/**
 * 把中文运镜文本映射到引擎的 move id。
 * ID 与引擎 catalog.cameras 实测一致（28 个）。
 */
export function mapCameraText(text) {
  const t = String(text || '');
  if (/锁定|固定|静止|不动|static/i.test(t)) return 'static';
  if (/希区柯克|dolly.?zoom|滑动变焦/i.test(t)) return 'dolly-zoom';
  if (/变焦.*推|zoom.?in/i.test(t)) return 'zoom-in';
  if (/变焦.*拉|zoom.?out/i.test(t)) return 'zoom-out';
  if (/推近|推进|前进|push|dolly.?in/i.test(t)) return 'push';
  if (/拉远|后退|pull|dolly.?out/i.test(t)) return 'pull';
  if (/左横移|左平移|truck.?left/i.test(t)) return 'truck-left';
  if (/右横移|右平移|truck.?right/i.test(t)) return 'truck-right';
  if (/左摇|pan.?left/i.test(t)) return 'pan-left';
  if (/右摇|pan.?right/i.test(t)) return 'pan-right';
  if (/上摇|仰|tilt.?up/i.test(t)) return 'tilt-up';
  if (/下摇|俯|tilt.?down/i.test(t)) return 'tilt-down';
  if (/左甩|whip.?pan.?left/i.test(t)) return 'whip-pan-left';
  if (/右甩|whip.?pan.?right/i.test(t)) return 'whip-pan-right';
  if (/升镜|升高|crane.?up/i.test(t)) return 'crane-up';
  if (/降镜|下降|crane.?down/i.test(t)) return 'crane-down';
  if (/摇臂.*升|jib.?up/i.test(t)) return 'jib-up';
  if (/摇臂.*降|jib.?down/i.test(t)) return 'jib-down';
  if (/环绕|半环绕|orbit/i.test(t)) return 'orbit';
  if (/左弧|arc.?left/i.test(t)) return 'arc-left';
  if (/右弧|arc.?right/i.test(t)) return 'arc-right';
  if (/跟拍|跟随|follow/i.test(t)) return 'follow';
  if (/侧跟|tracking/i.test(t)) return 'tracking';
  if (/稳定器|steadicam/i.test(t)) return 'steadicam';
  if (/强手持|晃/i.test(t)) return 'handheld-intense';
  if (/手持|handheld/i.test(t)) return 'handheld';
  if (/左倾|roll.?left/i.test(t)) return 'roll-left';
  if (/右倾|roll.?right/i.test(t)) return 'roll-right';
  return null;
}

/** 引擎 catalog 的演示用快照（引擎不可达时前端仍能展示选项） */
export const CAMERA_MOVES = Object.freeze([
  ['static', '锁定机位'], ['push', '轨道推近'], ['pull', '轨道拉远'],
  ['zoom-in', '光学变焦推近'], ['zoom-out', '光学变焦拉远'], ['dolly-zoom', '希区柯克变焦'],
  ['truck-left', '左横移'], ['truck-right', '右横移'],
  ['pan-left', '向左摇摄'], ['pan-right', '向右摇摄'],
  ['tilt-up', '向上摇摄'], ['tilt-down', '向下摇摄'],
  ['whip-pan-left', '左甩镜'], ['whip-pan-right', '右甩镜'],
  ['crane-up', '升镜头'], ['crane-down', '降镜头'],
  ['jib-up', '摇臂升起'], ['jib-down', '摇臂落下'],
  ['orbit', '半环绕'], ['arc-left', '左弧线'], ['arc-right', '右弧线'],
  ['follow', '后方跟拍'], ['tracking', '侧向跟拍'], ['steadicam', '稳定器跟拍'],
  ['handheld', '轻手持'], ['handheld-intense', '强手持'],
  ['roll-left', '左倾揭示'], ['roll-right', '右倾揭示'],
].map(([id, label]) => ({ id, label })));

export { DIRECTOR_COMMANDS as DIRECTOR_CMD_LIST };
