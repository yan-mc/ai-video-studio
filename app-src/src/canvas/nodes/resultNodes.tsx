/**
 * 结果节点：exportImageNode / exportVideoNode。
 *
 * 参考实现里结果节点是"回流"的：既显示上游产物，又能把产物继续递给下游，
 * 所以两者都有输入口 + 输出口（见 portTypes.ts）。
 *
 * 结果视频额外显示：任务 ID / 等待中 / 尾帧（可继承给下一镜）。
 */
import type { NodeProps } from '@xyflow/react';
import { Badge, Icon, useToast } from '../../ui';
import { getDefinition } from '../nodeRegistry';
import { paramBool, paramStr } from '../types';
import { useNodeActions } from '../nodeActions';
import {
  NodeShell,
  ParamPanel,
  PreviewBox,
  HintLine,
  nodeData,
} from './_shared';

/* --------------------------------------------------------------- 结果图片 */

const DEF_EXPORT_IMAGE = getDefinition('exportImageNode');

export function ExportImageNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_EXPORT_IMAGE;
  const actions = useNodeActions();
  const toast = useToast();
  const hasResult = Boolean(data.result?.url);
  const removeWatermark = paramBool(data.params, 'removeWatermark');

  return (
    <NodeShell
      nodeId={props.id}
      type="exportImageNode"
      data={data}
      selected={props.selected}
      icon="image"
      tone="neutral"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      headExtra={removeWatermark ? <Badge tone="danger">去水印</Badge> : null}
      footer={
        <button
          type="button"
          className="jz-node__foot-btn nodrag"
          disabled={!hasResult}
          onClick={(e) => {
            e.stopPropagation();
            if (!hasResult) {
              toast.info('还没有可下载的图片');
              return;
            }
            actions.download(props.id);
          }}
        >
          <Icon name="download" size={11} /> 下载
        </button>
      }
    >
      <PreviewBox data={data} kind="image" emptyHint="等待上游图片" />
      <HintLine>结果回流：可继续连给下游节点</HintLine>
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* --------------------------------------------------------------- 结果视频 */

const DEF_EXPORT_VIDEO = getDefinition('exportVideoNode');

export function ExportVideoNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_EXPORT_VIDEO;
  const actions = useNodeActions();
  const runStatus = data.status ?? 'idle';
  const taskId = data.result?.taskId;
  const lastFrame = data.result?.lastFrameUrl;
  const keepLastFrame = paramBool(data.params, 'keepLastFrame', true);
  const openInDirector = paramBool(data.params, 'openInDirector');

  const statusText =
    runStatus === 'queued'
      ? '等待中'
      : runStatus === 'running'
        ? `生成中 ${Math.round((data.progress ?? 0) * 100)}%`
        : runStatus === 'done'
          ? '已完成'
          : runStatus === 'failed'
            ? '失败'
            : '待生成';

  return (
    <NodeShell
      nodeId={props.id}
      type="exportVideoNode"
      data={data}
      selected={props.selected}
      icon="video"
      tone="neutral"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      headExtra={<Badge tone={runStatus === 'failed' ? 'danger' : runStatus === 'done' ? 'ok' : 'default'}>{statusText}</Badge>}
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
            <Icon name="download" size={11} /> 下载
          </button>
          <button
            type="button"
            className="jz-node__foot-btn jz-node__foot-btn--ghost nodrag"
            title="在总导演台中打开"
            onClick={(e) => {
              e.stopPropagation();
              actions.openStudio(props.id);
            }}
          >
            <Icon name="external" size={11} /> 导演台
          </button>
        </span>
      }
    >
      <PreviewBox data={data} kind="video" emptyHint="等待上游视频" />

      <div className="jz-node__kvline">
        <span className="jz-node__kvline-k">任务</span>
        <span className="jz-node__kvline-v jz-mono">{taskId ?? '—'}</span>
      </div>

      {keepLastFrame && lastFrame ? (
        <div className="jz-node__lastframe">
          <img src={lastFrame} alt="尾帧" draggable={false} />
          <span className="jz-node__lastframe-tag">
            <Icon name="image" size={10} /> 尾帧可继承下一镜
          </span>
        </div>
      ) : null}

      {openInDirector ? <HintLine>完成后将在总导演台打开</HintLine> : null}
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/** 结果视频的 resultKind（供画布层判断是否可继承尾帧） */
export function resultKindOf(data: Record<string, unknown>): string {
  const params = (data as { params?: Record<string, unknown> }).params;
  return paramStr(params, 'resultKind', 'generic');
}