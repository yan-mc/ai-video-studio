/**
 * 3D 工作台节点：blueprintNode（导演台） / previzNode（白模预演） / poseStudioNode（姿势台）。
 *
 * 三者都是"把 3D 子应用嵌进画布"的入口节点。真跑 three.js 会让画布瞬间卡死
 * （多个 WebGL 上下文 + 60fps），所以节点内只渲染**入口卡 + 状态摘要**，
 * 点「打开」后由 CanvasArea 调用 openStudio（打开独立工作台窗口/面板）。
 *
 * 这符合报告 §4.8 的事实：导演台是懒加载 chunk（BlueprintScene），
 * 预演是独立 iframe，姿势台是 iframe 载入 freepose.html。
 */
import type { NodeProps } from '@xyflow/react';
import { Badge, Icon } from '../../ui';
import { getDefinition, selectLabelOf, selectOptionsOf } from '../nodeRegistry';
import { paramBool, paramNum, paramStr } from '../types';
import {
  NodeShell,
  ParamPanel,
  PreviewBox,
  HintLine,
  StatRow,
  nodeData,
} from './_shared';
import { useNodeActions } from '../nodeActions';

/* ---------------------------------------------------------------- 导演台 */

const DEF_BLUEPRINT = getDefinition('blueprintNode');

export function BlueprintNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_BLUEPRINT;
  const actions = useNodeActions();
  const sceneId = paramStr(data.params, 'sceneId');
  const camera = paramStr(data.params, 'camera', 'cam-main');
  const lighting = paramStr(data.params, 'lighting', 'day');
  const showFigures = paramBool(data.params, 'showFigures', true);

  const cameraLabel = selectLabelOf('blueprintNode', 'camera', camera);
  const lightLabel = selectLabelOf('blueprintNode', 'lighting', lighting);

  return (
    <NodeShell
      nodeId={props.id}
      type="blueprintNode"
      data={data}
      selected={props.selected}
      icon="cube"
      tone="info"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      headExtra={
        <span className="jz-node__meta-chips">
          <Badge>{cameraLabel}</Badge>
          <Badge>{lightLabel}</Badge>
        </span>
      }
      footer={
        <button
          type="button"
          className="jz-node__foot-btn nodrag"
          onClick={(e) => {
            e.stopPropagation();
            actions.openStudio(props.id);
          }}
        >
          <Icon name="external" size={11} /> 打开导演台
        </button>
      }
    >
      {/* 3D 舞台示意：等距网格 + 人物/机位标记，纯 CSS 不跑 WebGL */}
      <div className="jz-node__stage" aria-label="3D 站位示意">
        <div className="jz-node__stage-floor" style={{ background: showFigures ? undefined : 'var(--jz-bg-sunken)' }} />
        {showFigures ? (
          <>
            <span className="jz-node__stage-figure jz-node__stage-figure--a" />
            <span className="jz-node__stage-figure jz-node__stage-figure--b" />
          </>
        ) : null}
        <span className="jz-node__stage-cam">
          <Icon name="video" size={11} />
        </span>
      </div>
      <StatRow label="场景 ID" value={<span className="jz-mono">{sceneId || '—'}</span>} />
      {data.result?.url ? <PreviewBox data={data} kind="image" /> : null}
      <HintLine>BlueprintScene 懒加载；画布内只保留入口</HintLine>
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* -------------------------------------------------------------- 白模预演 */

const DEF_PREVIZ = getDefinition('previzNode');

export function PrevizNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_PREVIZ;
  const actions = useNodeActions();
  const mode = paramStr(data.params, 'mode', 'director');
  const fps = paramNum(data.params, 'fps', 24);
  const resolution = paramStr(data.params, 'resolution', '1280x720');
  const exportVideo = paramBool(data.params, 'exportVideo');

  const modeLabel = selectLabelOf('previzNode', 'mode', mode);

  return (
    <NodeShell
      nodeId={props.id}
      type="previzNode"
      data={data}
      selected={props.selected}
      icon="play"
      tone="info"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      canRun
      runLabel={exportVideo ? '导出 mp4' : '导出预演'}
      headExtra={
        <span className="jz-node__meta-chips">
          <Badge tone="accent">{modeLabel}</Badge>
          <Badge>{resolution}</Badge>
          <Badge>{fps}fps</Badge>
        </span>
      }
      footer={
        <button
          type="button"
          className="jz-node__foot-btn jz-node__foot-btn--ghost nodrag"
          onClick={(e) => {
            e.stopPropagation();
            actions.openStudio(props.id);
          }}
        >
          <Icon name="external" size={11} /> 预演引擎
        </button>
      }
    >
      {/* 6 模式小胶囊：一眼看出当前导出模式 */}
      <div className="jz-node__modes" aria-label="导出模式">
        {(selectOptionsOf('previzNode', 'mode') ?? []).map((o) => (
          <span key={o.value} className={o.value === mode ? 'jz-node__mode jz-node__mode--on' : 'jz-node__mode'}>
            {o.label}
          </span>
        ))}
      </div>
      <PreviewBox data={data} kind={exportVideo ? 'video' : 'image'} emptyHint="导出后在此预览" />
      {exportVideo ? <HintLine>mp4 导出依赖浏览器 WebCodecs</HintLine> : null}
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* --------------------------------------------------------------- 姿势台 */

const DEF_POSE = getDefinition('poseStudioNode');

export function PoseStudioNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_POSE;
  const actions = useNodeActions();
  const poseName = paramStr(data.params, 'poseName');
  const characterUrl = paramStr(data.params, 'characterUrl');
  const embedded = paramBool(data.params, 'embedded', true);

  return (
    <NodeShell
      nodeId={props.id}
      type="poseStudioNode"
      data={data}
      selected={props.selected}
      icon="cube"
      tone="info"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      headExtra={
        <span className="jz-node__meta-chips">
          {poseName ? <Badge tone="accent">{poseName}</Badge> : null}
          <Badge>{embedded ? '内嵌' : '独立窗口'}</Badge>
        </span>
      }
      footer={
        <button
          type="button"
          className="jz-node__foot-btn nodrag"
          onClick={(e) => {
            e.stopPropagation();
            actions.openStudio(props.id);
          }}
        >
          <Icon name="external" size={11} /> 打开姿势台
        </button>
      }
    >
      {/* 姿势台缩略：角色图 + 骨架示意（避免 iframe 占画布资源） */}
      <div className="jz-node__pose">
        {characterUrl ? (
          <img className="jz-node__pose-char" src={characterUrl} alt="角色" draggable={false} />
        ) : (
          <div className="jz-node__pose-empty">
            <Icon name="cube" size={16} />
            <span>未载入角色</span>
          </div>
        )}
        <svg className="jz-node__pose-skeleton" viewBox="0 0 60 90" aria-hidden="true">
          <circle cx="30" cy="12" r="7" />
          <path d="M30 19v30M30 26l-13 10M30 26l13 10M30 49l-9 22M30 49l9 22" />
        </svg>
      </div>
      {data.result?.url ? <PreviewBox data={data} kind="image" /> : null}
      <StatRow label="姿势" value={poseName || '—'} />
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}