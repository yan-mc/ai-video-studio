/**
 * 分镜类节点：storyboardGenNode（分镜生成） / storyboardNode（切割结果） / episodeSubCanvasNode（剧集画布）。
 *
 * 三者是"一条线"上的三步，所以放在同一文件里便于对照：
 *   分镜生成 → 一张网格图 → 切割结果 → 逐格图 → 剧集画布 → 逐镜视频
 *
 * 切割结果节点额外有"网格导出设置"（背景色/间距/字号/序号/描述位置/图片填充），
 * 这些参数在注册表里已声明，这里负责把它们的效果**可视化**（预览网格示意）。
 */
import type { NodeProps } from '@xyflow/react';
import { Badge, Icon } from '../../ui';
import { getDefinition } from '../nodeRegistry';
import { paramBool, paramNum, paramStr } from '../types';
import {
  NodeShell,
  ParamPanel,
  PreviewBox,
  PreviewEmpty,
  StatRow,
  HintLine,
  nodeData,
} from './_shared';
import { useNodeActions } from '../nodeActions';

/* -------------------------------------------------------------- 分镜生成 */

const DEF_GEN = getDefinition('storyboardGenNode');

export function StoryboardGenNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_GEN;
  const rows = paramNum(data.params, 'rows', 2);
  const cols = paramNum(data.params, 'cols', 3);
  const cellAspect = paramStr(data.params, 'cellAspect', '16:9');
  const sheetAspect = paramStr(data.params, 'sheetAspect', '16:9');

  return (
    <NodeShell
      nodeId={props.id}
      type="storyboardGenNode"
      data={data}
      selected={props.selected}
      icon="grid"
      tone="accent"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      canRun
      runLabel="生成分镜"
      headExtra={
        <span className="jz-node__meta-chips">
          <Badge>
            {rows} × {cols}
          </Badge>
          <Badge>{cellAspect}</Badge>
          <Badge>{sheetAspect}</Badge>
        </span>
      }
    >
      {/* 网格示意：直观表达 行×列 */}
      <div
        className="jz-node__grid-preview"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, cols)}, 1fr)` }}
        aria-label={`${rows} 行 ${cols} 列分镜`}
      >
        {Array.from({ length: Math.max(1, Math.min(rows * cols, 24)) }, (_, i) => (
          <span key={i} className="jz-node__grid-cell">
            {i + 1}
          </span>
        ))}
      </div>
      <PreviewBox data={data} kind="image" emptyHint="生成后在此预览分镜网格" />
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* -------------------------------------------------------------- 切割结果 */

const DEF_SPLIT = getDefinition('storyboardNode');

const BG_TOKEN: Record<string, string> = {
  'layer-1': 'var(--jz-bg-layer-1)',
  sunken: 'var(--jz-bg-sunken)',
  inverse: 'var(--jz-bg-inverse)',
};

export function StoryboardNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_SPLIT;
  const actions = useNodeActions();
  const rows = Math.max(1, paramNum(data.params, 'rows', 2));
  const cols = Math.max(1, paramNum(data.params, 'cols', 2));
  const gap = paramNum(data.params, 'gap', 8);
  const labelSize = paramNum(data.params, 'labelSize', 14);
  const labelPos = paramStr(data.params, 'labelPosition', 'bottom');
  const fill = paramStr(data.params, 'imageFill', 'contain');
  const bg = paramStr(data.params, 'exportBg', 'layer-1');

  const total = rows * cols;

  return (
    <NodeShell
      nodeId={props.id}
      type="storyboardNode"
      data={data}
      selected={props.selected}
      icon="grid"
      tone="warn"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      headExtra={
        <span className="jz-node__meta-chips">
          <Badge tone="warn">{total} 格</Badge>
          <Badge>{fill === 'cover' ? '填满' : fill === 'stretch' ? '拉伸' : '完整'}</Badge>
        </span>
      }
      footer={
        <span className="jz-node__foot-btns">
          <button
            type="button"
            className="jz-node__foot-btn nodrag"
            disabled={!data.result?.url}
            onClick={(e) => {
              e.stopPropagation();
              actions.download(props.id);
            }}
          >
            <Icon name="download" size={11} /> 导出分镜
          </button>
        </span>
      }
    >
      {/* 分割结果示意：按当前网格设置画出来，参数改了立刻能看到 */}
      <div
        className="jz-node__split"
        style={{ background: BG_TOKEN[bg] ?? 'var(--jz-bg-layer-1)', gap: `${Math.min(gap, 24)}px` }}
        aria-label={`切割为 ${rows}×${cols}`}
      >
        {Array.from({ length: Math.min(total, 24) }, (_, i) => (
          <span key={i} className="jz-node__split-cell">
            {labelPos !== 'none' ? (
              <span className="jz-node__split-label" style={{ fontSize: `${Math.min(labelSize, 22)}px` }}>
                {i + 1}
              </span>
            ) : null}
          </span>
        ))}
      </div>
      {data.result?.url ? <PreviewBox data={data} kind="image" /> : <PreviewEmpty hint="等待上游分镜图" />}
      <StatRow label="网格" value={`${rows} 行 × ${cols} 列`} />
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* -------------------------------------------------------------- 剧集画布 */

const DEF_EPISODE = getDefinition('episodeSubCanvasNode');

/** 镜头状态机（报告 §4.1 canvas.shot.*） */
export type ShotState = 'pending' | 'review' | 'generating' | 'done' | 'failed';

const SHOT_STATE_META: Record<ShotState, { label: string; tone: 'default' | 'accent' | 'ok' | 'warn' | 'danger' }> = {
  pending: { label: '待创建', tone: 'default' },
  review: { label: '待审核', tone: 'warn' },
  generating: { label: '生成中', tone: 'accent' },
  done: { label: '已完成', tone: 'ok' },
  failed: { label: '失败', tone: 'danger' },
};

/** 镜头表行（后端 shot 资产的展示子集） */
export interface ShotRow {
  shotIndex: number;
  title: string;
  state: ShotState;
  durationSec: number;
}

/** 从 data.result.shots 读镜头表（脏数据安全） */
export function shotRowsOf(data: Record<string, unknown>): ShotRow[] {
  const raw = (data as { result?: { shots?: unknown } }).result?.shots;
  if (!Array.isArray(raw)) return [];
  const out: ShotRow[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const state = (rec.state as ShotState) ?? 'pending';
    if (!(state in SHOT_STATE_META)) continue;
    out.push({
      shotIndex: Number(rec.shotIndex) || out.length + 1,
      title: typeof rec.title === 'string' ? rec.title : `镜头 ${out.length + 1}`,
      state,
      durationSec: Number(rec.durationSec) || 5,
    });
  }
  return out;
}

export function EpisodeSubCanvasNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_EPISODE;
  const episode = paramNum(data.params, 'episode', 1);
  const boardView = paramStr(data.params, 'boardView', 'table');
  const inherit = paramBool(data.params, 'inheritLastFrame', true);
  const rows = shotRowsOf(data as unknown as Record<string, unknown>);
  const done = rows.filter((r) => r.state === 'done').length;

  return (
    <NodeShell
      nodeId={props.id}
      type="episodeSubCanvasNode"
      data={data}
      selected={props.selected}
      icon="canvas"
      tone="accent"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      canRun
      runLabel="串行生成"
      headExtra={
        <span className="jz-node__meta-chips">
          <Badge tone="accent">第 {episode} 集</Badge>
          <Badge>
            {done}/{rows.length || 0} 镜
          </Badge>
        </span>
      }
    >
      {rows.length === 0 ? (
        <StatRow label="镜头表" value="尚未导入" />
      ) : boardView === 'board' ? (
        <div className="jz-node__board">
          {rows.slice(0, 9).map((r) => (
            <span key={r.shotIndex} className={`jz-node__board-cell jz-node__board-cell--${r.state}`}>
              P{String(r.shotIndex).padStart(2, '0')}
            </span>
          ))}
        </div>
      ) : (
        <div className="jz-node__shotlist nowheel">
          <div className="jz-node__shotlist-head">
            <span>镜</span>
            <span>标题</span>
            <span>状态</span>
            <span>时长</span>
          </div>
          {rows.slice(0, 6).map((r) => {
            const meta = SHOT_STATE_META[r.state];
            return (
              <div key={r.shotIndex} className="jz-node__shotrow">
                <span className="jz-mono">P{String(r.shotIndex).padStart(2, '0')}</span>
                <span className="jz-node__shotrow-title">{r.title}</span>
                <span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </span>
                <span className="jz-mono">{r.durationSec}s</span>
              </div>
            );
          })}
          {rows.length > 6 ? <div className="jz-node__shotrow-more">还有 {rows.length - 6} 镜…</div> : null}
        </div>
      )}
      {inherit ? <HintLine>前一镜尾帧将作为下一镜参考图传入</HintLine> : null}
      <PreviewBox data={data} kind="video" emptyHint="暂无成片" />
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}