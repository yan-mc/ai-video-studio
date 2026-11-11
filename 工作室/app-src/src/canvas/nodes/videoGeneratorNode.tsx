/**
 * videoGeneratorNode —— 26 个节点里最复杂的一个（报告 §4.1 / §8.3）。
 *
 * 它的参数面板必须覆盖：
 *   1. **模型选择**：H3 19 档（含 5SEG 五段流）+ Seedance 4 档，按后端分组
 *   2. **首尾帧**：首帧 / 尾帧（FL2V 模式必需），既可从连线来，也可手填地址
 *   3. **参考图**：最多 9 张（后端 validateShot 的硬约束）
 *   4. **五段流**：段数 1~5，每段独立提示词 + 起点图 + 时长；段间尾接头
 *   5. **步数**：总步数 / 一采步数（H3 双采样）
 *   6. **动作 LoRA 强度**：0~2，横滑条
 *
 * 布局取舍：节点很高（620px）但不给滚动条 —— 画布上滚轮要用于缩放，
 * 节点内滚动会抢事件。改成分区折叠：模型区常显，其余按需展开，
 * 面板内所有输入都带 `nodrag`/`nowheel` 类，避免拖动节点时误触。
 */
import { useMemo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Badge, Icon, Field, Select } from '../../ui';
import {
  getDefinition,
  paramGroupsFor,
  VIDEO_MODEL_OPTIONS,
  SEEDANCE_MODEL_OPTIONS,
} from '../nodeRegistry';
import { paramList, paramNum, paramSegments, paramStr } from '../types';
import {
  DEFAULT_VIDEO_SEGMENTS,
  MODE_REQUIREMENTS,
  modelOptionsForBackend,
  validateVideoParams,
} from '../videoParams';
import {
  NodeShell,
  ParamPanel,
  PreviewBox,
  HintLine,
  nodeData,
} from './_shared';
import { useNodeActions } from '../nodeActions';

const DEF = getDefinition('videoGeneratorNode');

/** 模型下拉分组：H3 在前、Seedance 在后，各带分组标题 */
const MODEL_GROUPS = [
  { title: 'H3 本地（19 档）', options: VIDEO_MODEL_OPTIONS.filter((o) => o.value.startsWith('h3:')) },
  { title: 'Seedance 云端（4 档）', options: SEEDANCE_MODEL_OPTIONS.map((o) => ({ value: `seedance:${o.value}`, label: o.label })) },
];

/* ========================================================================== */
/* 主组件                                                                      */
/* ========================================================================== */

export function VideoGeneratorNode(props: NodeProps) {
  const data = nodeData(props.data);
  const actions = useNodeActions();
  const def = DEF;

  const backend = paramStr(data.params, 'backend', 'h3-local');
  const model = paramStr(data.params, 'model', 'h3:T2V');
  const mode = paramStr(data.params, 'mode', 't2v');
  const segments = paramSegments(data.params, 'segments', DEFAULT_VIDEO_SEGMENTS);
  const refImages = paramList(data.params, 'referenceImages');
  const steps = paramNum(data.params, 'steps', 4);
  const firstPassSteps = paramNum(data.params, 'firstPassSteps', 4);
  const lora = paramNum(data.params, 'motionLoraStrength', 1);
  const duration = paramNum(data.params, 'durationSec', 5);
  const ratio = paramStr(data.params, 'aspectRatio', '16:9');
  const firstFrame = paramStr(data.params, 'firstFrameUrl');
  const lastFrame = paramStr(data.params, 'lastFrameUrl');

  const warnings = useMemo(() => validateVideoParams(data.params), [data.params]);
  const groups = useMemo(() => paramGroupsFor('videoGeneratorNode'), []);

  /** 展开哪一个折叠区（默认只展开"五段流"，其余收起以控制高度） */
  const [open, setOpen] = useState<Record<string, boolean>>({
    '后端 · 模型': true,
    '画面 · 时长': true,
    '首尾帧 · 参考': false,
    '五段流': mode === '5seg',
    '采样 · 动作': false,
    '提示词': false,
    '开关': false,
  });

  const backendLabel = backend === 'seedance-cloud' ? 'Seedance' : 'H3';
  const slotLabel =
    MODEL_GROUPS.flatMap((g) => g.options).find((o) => o.value === model)?.label ?? model;

  const setBackend = (next: string) => {
    // 切后端时同步挑一个该后端的档位，避免出现"后端=Seedance 但模型=h3:xxx"的非法组合
    const options = modelOptionsForBackend(next);
    const keep = options.some((o) => o.value === model) ? model : (options[0]?.value ?? 'h3:T2V');
    actions.patchParams(props.id, { backend: next, model: keep });
  };

  return (
    <NodeShell
      nodeId={props.id}
      type="videoGeneratorNode"
      data={data}
      selected={props.selected}
      icon="video"
      tone="warn"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      canRun
      runLabel={mode === '5seg' ? '生成五段流' : '生成视频'}
      headExtra={
        <span className="jz-node__meta-chips">
          <Badge tone="warn">{backendLabel}</Badge>
          <Badge>{ratio}</Badge>
          <Badge>{duration}s</Badge>
          {mode === '5seg' ? <Badge tone="accent">{segments.length} 段</Badge> : null}
        </span>
      }
      footer={
        <span className="jz-node__foot-btns">
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
      {/* 模型摘要行（常显，不折叠） */}
      <div className="jz-node__vmodel" title={slotLabel}>
        <Icon name={backend === 'seedance-cloud' ? 'spark' : 'cube'} size={12} />
        <span className="jz-node__vmodel-name">{slotLabel}</span>
      </div>

      {/* 后端 + 模型（常显，最高频） */}
      <div className="jz-node__vtop nowheel" onPointerDown={(e) => e.stopPropagation()}>
        <Field label="后端">
          <Select
            className="nodrag jz-node__control"
            value={backend}
            options={[
              { value: 'h3-local', label: 'H3 本地' },
              { value: 'seedance-cloud', label: 'Seedance 云端' },
            ]}
            onChange={setBackend}
          />
        </Field>
        <Field label="模型档位">
          <Select
            className="nodrag jz-node__control"
            value={model}
            options={modelOptionsForBackend(backend)}
            onChange={(v) => actions.patchParams(props.id, { model: v })}
          />
        </Field>
      </div>

      {/* 首尾帧可视条：一眼看到是否已就位 */}
      <div className="jz-node__frames">
        <FrameSlot label="首帧" url={firstFrame} required={Boolean(MODE_REQUIREMENTS[mode]?.first)} />
        <span className="jz-node__frames-arrow" aria-hidden="true">
          <Icon name="chevronRight" size={12} />
        </span>
        <FrameSlot label="尾帧" url={lastFrame} required={Boolean(MODE_REQUIREMENTS[mode]?.last)} />
        {refImages.length > 0 ? (
          <span className="jz-node__frames-refs">
            <Icon name="layers" size={10} /> {refImages.length} 参考
          </span>
        ) : null}
      </div>

      {/* 五段流摘要（模式=5seg 时展开） */}
      {mode === '5seg' ? (
        <div className="jz-node__seg-summary">
          {segments.map((s, i) => (
            <span
              key={s.index}
              className={s.prompt.trim() ? 'jz-node__seg-pill jz-node__seg-pill--on' : 'jz-node__seg-pill'}
              title={s.prompt || '本段未填提示词'}
            >
              {i + 1}
            </span>
          ))}
          <span className="jz-node__seg-summary-text">
            {segments.filter((s) => s.prompt.trim()).length}/{segments.length} 段已写
          </span>
        </div>
      ) : null}

      {/* 采样摘要 */}
      <div className="jz-node__sample-bar">
        <span className="jz-node__sample-item">
          <span className="jz-node__sample-k">总步数</span>
          <span className="jz-node__sample-v">{steps}</span>
        </span>
        <span className="jz-node__sample-item">
          <span className="jz-node__sample-k">一采</span>
          <span className="jz-node__sample-v">{firstPassSteps}</span>
        </span>
        <span className="jz-node__sample-item">
          <span className="jz-node__sample-k">动作 LoRA</span>
          <span className="jz-node__sample-v">{lora.toFixed(2)}</span>
        </span>
      </div>
      <div className="jz-node__lora">
        <div className="jz-node__lora-track" aria-hidden="true">
          <div
            className="jz-node__lora-fill"
            style={{ width: `${Math.min(100, (lora / 2) * 100)}%` }}
          />
        </div>
      </div>

      <PreviewBox data={data} kind="video" emptyHint="生成后在此预览；尾帧可继承下一镜" />

      {warnings.length > 0 ? (
        <div className="jz-node__warnlist">
          {warnings.slice(0, 3).map((w) => (
            <div key={w} className="jz-node__warn">
              <Icon name="alert" size={11} />
              <span>{w}</span>
            </div>
          ))}
        </div>
      ) : (
        <HintLine>参数齐备，可以生成</HintLine>
      )}

      {/* 分区折叠的参数面板 */}
      <div className="jz-node__vgroups nowheel" onPointerDown={(e) => e.stopPropagation()}>
        {groups
          .filter((g) => g.title !== '后端 · 模型')
          .map((g) => {
            const isOpen = Boolean(open[g.title]);
            return (
              <div key={g.title} className="jz-node__vgroup">
                <button
                  type="button"
                  className="jz-node__vgroup-head nodrag"
                  aria-expanded={isOpen}
                  onClick={() => setOpen((prev) => ({ ...prev, [g.title]: !prev[g.title] }))}
                >
                  <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={11} />
                  <span>{g.title}</span>
                  <span className="jz-node__vgroup-count">{g.fields.length}</span>
                </button>
                {isOpen ? (
                  <ParamPanel
                    nodeId={props.id}
                    fields={g.fields}
                    params={data.params}
                    collapsed={false}
                  />
                ) : null}
              </div>
            );
          })}
      </div>

      {!data.result?.url ? <PreviewEmptyInner /> : null}
    </NodeShell>
  );
}

/* ========================================================================== */
/* 子组件                                                                      */
/* ========================================================================== */

function FrameSlot({ label, url, required }: { label: string; url: string; required: boolean }) {
  const cls = [
    'jz-node__frame',
    url ? 'jz-node__frame--filled' : '',
    required && !url ? 'jz-node__frame--missing' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} title={url || `${label}未设置`}>
      {url ? <img src={url} alt={label} draggable={false} /> : <Icon name="image" size={12} />}
      <span className="jz-node__frame-label">
        {label}
        {required && !url ? '*' : ''}
      </span>
    </div>
  );
}

/** 视频节点不重复渲染空预览（上面已有 PreviewBox），这里只在没有产物时给一行小字 */
function PreviewEmptyInner() {
  return (
    <div className="jz-node__vempty">
      <span>五段流会产出 1 条合成总片 + 每段 1 条分段</span>
    </div>
  );
}

/** 供外部读：模型下拉分组（选择器组件可能被别处复用） */
export { MODEL_GROUPS };

/** 供别处复用：纯逻辑全部在 videoParams.ts，这里只做转出，避免两处实现漂移 */
export {
  clampSegmentCount,
  normalizeSegments,
  modelOptionsForBackend,
  parseModelValue,
  validateVideoParams,
} from '../videoParams';