/**
 * 结构化提取节点：extractVoiceNode / extractCharacterNode / extractSceneNode / extractItemNode。
 *
 * 参考实现行为（报告 §4.1）：文本 → 结构化资产条目，节点里有「全部添加到资产库 / 全部生成到画布」。
 * 四个节点结构完全一致，只有"条目种类"不同，所以共用一个渲染器 + 四种条目预览。
 */
import type { NodeProps } from '@xyflow/react';
import { Badge } from '../../ui';
import { getDefinition } from '../nodeRegistry';
import { paramBool, paramStr } from '../types';
import {
  NodeShell,
  ParamPanel,
  PreviewBox,
  StatRow,
  HintLine,
  nodeData,
} from './_shared';

/** 提取条目（后端 generate_*_extract 的产物形状，这里只做展示） */
export interface ExtractedEntry {
  name: string;
  description?: string;
  count?: number;
}

/** 从 data.result 里读条目列表（脏数据安全） */
export function entriesOf(data: Record<string, unknown>): ExtractedEntry[] {
  const raw = (data as { result?: { entries?: unknown } }).result?.entries;
  if (!Array.isArray(raw)) return [];
  const out: ExtractedEntry[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.name !== 'string' || !rec.name) continue;
    out.push({
      name: rec.name,
      description: typeof rec.description === 'string' ? rec.description : undefined,
      count: typeof rec.count === 'number' ? rec.count : undefined,
    });
  }
  return out;
}

/* ------------------------------------------------------------ 提取音色 */

const DEF_EXTRACT_VOICE = getDefinition('extractVoiceNode');

export function ExtractVoiceNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_EXTRACT_VOICE;
  const entries = entriesOf(data as unknown as Record<string, unknown>);
  const bindExisting = paramBool(data.params, 'bindExistingAudio');
  return (
    <NodeShell
      nodeId={props.id}
      type="extractVoiceNode"
      data={data}
      selected={props.selected}
      icon="audio"
      tone="ok"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      canRun
      runLabel="提取音色"
      headExtra={entries.length > 0 ? <Badge tone="ok">{entries.length} 个音色</Badge> : null}
    >
      {entries.length > 0 ? (
        <div className="jz-node__entries nowheel">
          {entries.slice(0, 6).map((e) => (
            <div key={e.name} className="jz-node__entry">
              <span className="jz-node__entry-name">{e.name}</span>
              {e.description ? <span className="jz-node__entry-desc">{e.description}</span> : null}
            </div>
          ))}
        </div>
      ) : (
        <StatRow label="已提取" value="—" />
      )}
      <PreviewBox data={data} kind="audio" emptyHint="绑定音频后可试听" />
      {bindExisting ? <HintLine>可绑定已有音频作为参考音色</HintLine> : null}
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* ---------------------------------------------- 角色 / 场景 / 道具提取 */

type ExtractKind = 'character' | 'scene' | 'item';

const EXTRACT_DEFS: Record<
  ExtractKind,
  { def: ReturnType<typeof getDefinition>; icon: 'assets' | 'layers' | 'cube'; tone: 'accent' | 'info' | 'warn'; badgeTone: 'accent' | 'warn' | 'default'; unit: string }
> = {
  character: { def: getDefinition('extractCharacterNode'), icon: 'assets', tone: 'accent', badgeTone: 'accent', unit: '角色' },
  scene: { def: getDefinition('extractSceneNode'), icon: 'layers', tone: 'info', badgeTone: 'default', unit: '场景' },
  item: { def: getDefinition('extractItemNode'), icon: 'cube', tone: 'warn', badgeTone: 'warn', unit: '道具' },
};

function ExtractNodeImpl({ props, kind }: { props: NodeProps; kind: ExtractKind }) {
  const spec = EXTRACT_DEFS[kind];
  const data = nodeData(props.data);
  const def = spec.def;
  const entries = entriesOf(data as unknown as Record<string, unknown>);
  const autoAssets = paramBool(data.params, 'autoAddToAssets', true);
  const autoCanvas = paramBool(data.params, 'autoGenerateToCanvas', false);
  const styleHint = paramStr(data.params, 'styleHint');

  return (
    <NodeShell
      nodeId={props.id}
      type={spec.def?.type ?? 'extractCharacterNode'}
      data={data}
      selected={props.selected}
      icon={spec.icon}
      tone={spec.tone}
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      canRun
      runLabel={`提取${spec.unit}`}
      headExtra={
        entries.length > 0 ? <Badge tone={spec.badgeTone}>{entries.length} 个{spec.unit}</Badge> : null
      }
    >
      {entries.length > 0 ? (
        <div className="jz-node__entries nowheel">
          {entries.slice(0, 8).map((e) => (
            <div key={e.name} className="jz-node__entry">
              <span className="jz-node__entry-name">{e.name}</span>
              {e.count !== undefined ? <span className="jz-node__entry-count">×{e.count}</span> : null}
              {e.description ? <span className="jz-node__entry-desc">{e.description}</span> : null}
            </div>
          ))}
          {entries.length > 8 ? <div className="jz-node__entry-more">还有 {entries.length - 8} 条…</div> : null}
        </div>
      ) : (
        <StatRow label={`已提取${spec.unit}`} value="—" />
      )}
      <div className="jz-node__bulk">
        <span className={autoAssets ? 'jz-node__bulk-chip jz-node__bulk-chip--on' : 'jz-node__bulk-chip'}>
          加资产库
        </span>
        <span className={autoCanvas ? 'jz-node__bulk-chip jz-node__bulk-chip--on' : 'jz-node__bulk-chip'}>
          生成到画布
        </span>
        {styleHint ? <span className="jz-node__bulk-chip">{styleHint}</span> : null}
      </div>
      <PreviewBox data={data} kind="image" emptyHint="提取后可在此预览代表图" />
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/** 角色提取 */
export function ExtractCharacterNode(props: NodeProps) {
  return <ExtractNodeImpl props={props} kind="character" />;
}

/** 场景提取 */
export function ExtractSceneNode(props: NodeProps) {
  return <ExtractNodeImpl props={props} kind="scene" />;
}

/** 道具提取 */
export function ExtractItemNode(props: NodeProps) {
  return <ExtractNodeImpl props={props} kind="item" />;
}

/* ----------------------------------------------------------- 全景图生成 */

const PANORAMA_DEF = getDefinition('panoramaNode');

/** 全景图生成节点（放在本文件末尾便于与"结构化提取"对照：同为"文本→产物"型） */
export function PanoramaNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = PANORAMA_DEF;
  const template = paramStr(data.params, 'template', 'builtin');
  return (
    <NodeShell
      nodeId={props.id}
      type="panoramaNode"
      data={data}
      selected={props.selected}
      icon="eye"
      tone="accent"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      canRun
      runLabel="生成全景"
      headExtra={<Badge>{template === 'relay' ? 'relay' : '内置'}</Badge>}
    >
      <PreviewBox data={data} kind="panorama" emptyHint="生成后在此预览 equirect 全景" />
      <HintLine>2:1 / 4:1 equirect 投影；可直接连「全景图 A/B」查看</HintLine>
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}