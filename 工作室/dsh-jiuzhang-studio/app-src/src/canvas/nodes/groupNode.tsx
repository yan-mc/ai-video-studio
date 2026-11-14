/**
 * 分组节点 —— React Flow 的 group 能力 + 参考实现的 Ctrl+G 行为。
 *
 * 与普通节点的三点不同：
 *   1. 它是**父节点**：子节点用 parentId 指向它，一起拖动；
 *   2. 没有端口（portTypes 里 groupNode 是 NO_PORTS）；
 *   3. 可自由改尺寸（用 NodeResizer），标题条是"组名 + 色块"。
 *
 * 子节点必须限定在父容器内，否则拖出去会"飘"。React Flow 的做法是
 * 给子节点设 `extent: 'parent'`，这一步由 CanvasArea 在成组/解组时统一处理。
 */
import type { NodeProps } from '@xyflow/react';
import { NodeResizer } from '@xyflow/react';
import { getDefinition, toneVar } from '../nodeRegistry';
import { paramStr } from '../types';
import type { CanvasTone } from '../types';
import { NodeShell, ParamPanel, nodeData } from './_shared';

const DEF = getDefinition('groupNode');

/** 允许的分组色调白名单（脏数据回退 neutral） */
const TONES: readonly CanvasTone[] = ['accent', 'ok', 'warn', 'danger', 'info', 'neutral'];

function toneOf(data: ReturnType<typeof nodeData>): CanvasTone {
  const raw = paramStr(data.params, 'tone', 'neutral');
  return (TONES as readonly string[]).includes(raw) ? (raw as CanvasTone) : 'neutral';
}

export function GroupNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF;
  const tone = toneOf(data);

  return (
    <>
      <NodeResizer
        isVisible={Boolean(props.selected)}
        minWidth={200}
        minHeight={120}
        lineClassName="jz-node__resize-line"
        handleClassName="jz-node__resize-handle"
        color={toneVar(tone, 'text')}
      />
      <NodeShell
        nodeId={props.id}
        type="groupNode"
        data={data}
        selected={props.selected}
        icon="grid"
        tone={tone}
        variant="group"
        collapsed={Boolean(data.collapsed)}
      >
        <div className="jz-node__group-body nowheel">
          {data.collapsed ? null : (
            <ParamPanel
              nodeId={props.id}
              fields={def?.fields ?? []}
              params={data.params}
              collapsed={false}
            />
          )}
        </div>
      </NodeShell>
    </>
  );
}