/**
 * 文本类节点：aiTextNode（AI 文本生成） + textAnnotationNode（Markdown 注释）。
 *
 * 两者都要"编辑大段文本"，但一个是参数面板里的提示词，一个是节点正文本身，
 * 所以注释节点把 Markdown 直接渲染成可读文本（不引 markdown 库，只处理标题/列表/加粗三种高频语法）。
 */
import { useMemo } from 'react';
import { Badge } from '../../ui';
import type { NodeProps } from '@xyflow/react';
import { getDefinition } from '../nodeRegistry';
import { paramStr } from '../types';
import {
  NodeShell,
  ParamPanel,
  PreviewBox,
  nodeData,
} from './_shared';

/* ------------------------------------------------------------- AI 文本 */

const DEF_AI_TEXT = getDefinition('aiTextNode');

export function AiTextNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_AI_TEXT;
  const model = paramStr(data.params, 'model');
  const maxTokens = Number(data.params?.maxTokens ?? 2048);
  const temperature = Number(data.params?.temperature ?? 0.7);

  return (
    <NodeShell
      nodeId={props.id}
      type="aiTextNode"
      data={data}
      selected={props.selected}
      icon="text"
      tone="info"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      canRun={Boolean(data.params?.prompt) || Boolean(data.result?.text)}
      runLabel="生成"
      headExtra={
        <span className="jz-node__meta-chips">
          <Badge>{model}</Badge>
          <Badge>{temperature.toFixed(1)}</Badge>
          <Badge>{maxTokens} tok</Badge>
        </span>
      }
    >
      <PreviewBox data={data} kind="text" emptyHint="尚无文本输出" />
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* ------------------------------------------------------------ 文本注释 */

const DEF_ANNOTATION = getDefinition('textAnnotationNode');

/** 极简 Markdown → 行（只支持 # 标题 / - 列表 / **加粗** / 空行） */
interface MdLine {
  kind: 'h1' | 'h2' | 'h3' | 'li' | 'p' | 'blank';
  text: string;
}

export function parseMarkdownLite(source: string): MdLine[] {
  const out: MdLine[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      out.push({ kind: 'blank', text: '' });
    } else if (line.startsWith('### ')) {
      out.push({ kind: 'h3', text: line.slice(4) });
    } else if (line.startsWith('## ')) {
      out.push({ kind: 'h2', text: line.slice(3) });
    } else if (line.startsWith('# ')) {
      out.push({ kind: 'h1', text: line.slice(2) });
    } else if (/^[-*+]\s+/.test(line)) {
      out.push({ kind: 'li', text: line.replace(/^[-*+]\s+/, '') });
    } else {
      out.push({ kind: 'p', text: line });
    }
  }
  return out;
}

/** 文本注释节点：无端口，不参与连线（与参考实现一致） */
export function TextAnnotationNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_ANNOTATION;
  const markdown = typeof data.markdown === 'string' ? data.markdown : paramStr(data.params, 'markdown');
  const align = paramStr(data.params, 'align', 'left');
  const lines = useMemo(() => parseMarkdownLite(markdown), [markdown]);

  return (
    <NodeShell
      nodeId={props.id}
      type="textAnnotationNode"
      data={data}
      selected={props.selected}
      icon="file"
      tone="neutral"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      headExtra={<Badge>注释</Badge>}
    >
      <div
        className="jz-node__markdown nowheel"
        style={{ textAlign: align === 'center' ? 'center' : 'left' }}
      >
        {lines.length === 0 || (lines.length === 1 && lines[0]?.kind === 'blank') ? (
          <span className="jz-node__markdown-empty">在右侧参数区写 Markdown 注释</span>
        ) : (
          lines.map((line, i) => {
            if (line.kind === 'blank') return <div key={i} className="jz-node__md-gap" />;
            if (line.kind === 'li') {
              return (
                <div key={i} className="jz-node__md-li">
                  <span className="jz-node__md-dot" aria-hidden="true">•</span>
                  <span>{renderEmphasis(line.text)}</span>
                </div>
              );
            }
            return (
              <div key={i} className={`jz-node__md-${line.kind}`}>
                {renderEmphasis(line.text)}
              </div>
            );
          })
        )}
      </div>
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/** 把 **加粗** 拆成 span；不做完整 Markdown，避免引库 */
function renderEmphasis(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="jz-node__md-strong">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}