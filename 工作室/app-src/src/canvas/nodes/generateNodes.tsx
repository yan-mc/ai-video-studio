/**
 * 生成类节点：agentGenNode / imageNode / aiVoiceGenerationNode / backgroundMusicNode。
 *
 * 共同点：都是"填参数 → 点运行 → 出产物"，所以统一用：
 *   参数面板（schema 驱动） + 预览区 + 运行按钮 + 状态徽标
 * 差异化部分（智能体的模板提示、图片节点的参考图计数、音乐的 AutoPrompt 提示）就地渲染。
 */
import type { NodeProps } from '@xyflow/react';
import { Badge } from '../../ui';
import { getDefinition, selectLabelOf } from '../nodeRegistry';
import { paramBool, paramList, paramStr } from '../types';
import {
  NodeShell,
  ParamPanel,
  PreviewBox,
  PreviewEmpty,
  HintLine,
  nodeData,
} from './_shared';

/* ------------------------------------------------------------ 智能体生成 */

const DEF_AGENT = getDefinition('agentGenNode');

export function AgentGenNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_AGENT;
  const target = paramStr(data.params, 'target', 'image');
  const template = paramStr(data.params, 'template', 'auto');
  const templateLabel = selectLabelOf('agentGenNode', 'template', template);

  return (
    <NodeShell
      nodeId={props.id}
      type="agentGenNode"
      data={data}
      selected={props.selected}
      icon="spark"
      tone="accent"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      canRun
      runLabel="执行"
      headExtra={<Badge tone="accent">{templateLabel}</Badge>}
    >
      <div className="jz-node__flow">
        <HintLine>图片分析 → 提示词 → 生成{target === 'video' ? '视频' : target === 'text' ? '文本' : '图片'}</HintLine>
        {paramStr(data.params, 'prompt') ? (
          <div className="jz-node__quote nowheel">{paramStr(data.params, 'prompt')}</div>
        ) : null}
      </div>
      {target === 'text' ? (
        <PreviewBox data={data} kind="text" emptyHint="尚无提示词输出" />
      ) : (
        <PreviewBox data={data} kind={target === 'video' ? 'video' : 'image'} emptyHint="尚无产物" />
      )}
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* --------------------------------------------------------------- AI 图片 */

const DEF_IMAGE = getDefinition('imageNode');

export function ImageNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_IMAGE;
  const refs = paramList(data.params, 'referenceImages');
  const ratio = paramStr(data.params, 'aspectRatio', '16:9');
  const size = paramStr(data.params, 'size', '1024');
  const model = paramStr(data.params, 'model', '');
  const shortModel = model.split('/').pop() ?? model;

  return (
    <NodeShell
      nodeId={props.id}
      type="imageNode"
      data={data}
      selected={props.selected}
      icon="image"
      tone="accent"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      canRun
      runLabel="生成图片"
      headExtra={
        <span className="jz-node__meta-chips">
          <Badge>{ratio}</Badge>
          <Badge>{size}</Badge>
          {refs.length > 0 ? <Badge tone="accent">参考 {refs.length}</Badge> : null}
        </span>
      }
    >
      <div className="jz-node__model-line" title={model}>
        {shortModel || '未选模型'}
      </div>
      <PreviewBox data={data} kind="image" emptyHint="生成后在此预览" />
      {refs.length > 0 ? (
        <div className="jz-node__refstrip">
          {refs.slice(0, 4).map((src, i) => (
            <img key={`${src}-${i}`} src={src} alt={`参考 ${i + 1}`} draggable={false} />
          ))}
          {refs.length > 4 ? <span className="jz-node__refmore">+{refs.length - 4}</span> : null}
        </div>
      ) : null}
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* --------------------------------------------------------------- AI 音色 */

const DEF_VOICE_GEN = getDefinition('aiVoiceGenerationNode');

export function AiVoiceGenerationNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_VOICE_GEN;
  const voiceName = paramStr(data.params, 'voiceName');
  return (
    <NodeShell
      nodeId={props.id}
      type="aiVoiceGenerationNode"
      data={data}
      selected={props.selected}
      icon="audio"
      tone="ok"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      canRun
      runLabel="生成音色"
      headExtra={voiceName ? <Badge tone="ok">{voiceName}</Badge> : null}
    >
      <PreviewBox data={data} kind="audio" emptyHint="生成后可在此试听" />
      <HintLine>产物自动收入「音色」资产库</HintLine>
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* ------------------------------------------------------------- 背景音乐 */

const DEF_BGM = getDefinition('backgroundMusicNode');

export function BackgroundMusicNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_BGM;
  const autoPrompt = paramBool(data.params, 'autoPrompt', true);
  const duration = Number(data.params?.durationSec ?? 60);
  return (
    <NodeShell
      nodeId={props.id}
      type="backgroundMusicNode"
      data={data}
      selected={props.selected}
      icon="audio"
      tone="ok"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      canRun
      runLabel="生成音乐"
      headExtra={
        <span className="jz-node__meta-chips">
          <Badge>{duration}s</Badge>
          {autoPrompt ? <Badge tone="accent">自动提示词</Badge> : null}
        </span>
      }
    >
      {data.result?.url ? (
        <PreviewBox data={data} kind="audio" />
      ) : (
        <div className="jz-node__wave" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              className="jz-node__wave-bar"
              style={{ height: `${20 + ((i * 37) % 60)}%` }}
            />
          ))}
        </div>
      )}
      {autoPrompt ? <HintLine>由剧本自动生成音乐提示词（Suno 通道）</HintLine> : null}
      {!data.result?.url ? <PreviewEmpty hint="尚无音频产物" /> : null}
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}