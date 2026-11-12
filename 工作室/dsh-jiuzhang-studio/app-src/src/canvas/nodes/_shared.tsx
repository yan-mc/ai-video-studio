/**
 * 节点公共构件 —— 26 个节点组件全部由这里的积木拼出来，保证视觉与行为一致。
 *
 * 一个节点 = NodeShell（外壳：标题条 / 端口 / 状态 / 菜单）
 *          + 自定义 body（参数区、预览区、上传区、分段编辑器…）
 *
 * 颜色一律走 CSS 变量（--jz-*）与 design-system 组件，无 hex。
 */
import { useCallback, useState, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Badge,
  Icon,
  IconButton,
  Select,
  Switch,
  Field,
  Input,
  Textarea,
} from '../../ui';
import type { IconName } from '../../ui/Icon';
import type { NodeTypeKey } from '../nodeKeys';
import { nodeDefaultLabel, toneVar } from '../nodeRegistry';
import type {
  CanvasNodeData,
  CanvasTone,
  NodeRunStatus,
  ParamField,
  VideoSegmentParam,
} from '../types';
import { paramList, paramSegments } from '../types';
import { portsOf, PORT_KIND_LABELS } from '../portTypes';
import type { NodePortSpec, PortKind, PortSpec } from '../portTypes';
import { PORT_KIND_VARS } from '../types';
import { useNodeActions } from '../nodeActions';

/* ========================================================================== */
/* 一、数据读取                                                                */
/* ========================================================================== */

/** React Flow 传给节点的 data 是 Record<string, unknown>，这里统一窄化 */
export function nodeData(data: Record<string, unknown>): CanvasNodeData {
  return data as CanvasNodeData;
}

/** 节点标题：用户自定义 > 注册表默认名 */
export function titleOf(type: string, data: CanvasNodeData): string {
  const t = typeof data.title === 'string' ? data.title.trim() : '';
  return t || nodeDefaultLabel(type);
}

/** 状态 → 徽标文案 / 颜色 */
const STATUS_META: Record<NodeRunStatus, { label: string; tone: 'default' | 'accent' | 'ok' | 'warn' | 'danger' }> = {
  idle: { label: '待运行', tone: 'default' },
  queued: { label: '排队中', tone: 'warn' },
  running: { label: '生成中', tone: 'accent' },
  done: { label: '已完成', tone: 'ok' },
  failed: { label: '失败', tone: 'danger' },
};

function statusOf(data: CanvasNodeData): NodeRunStatus {
  const s = data.status;
  return s === 'queued' || s === 'running' || s === 'done' || s === 'failed' ? s : 'idle';
}

/* ========================================================================== */
/* 二、端口渲染                                                                */
/* ========================================================================== */

/** 单侧端口在竖直方向上的百分比位置（1 个居中，多个均匀分布） */
function portTop(ports: PortSpec[], port: PortSpec): string {
  if (ports.length <= 1) return '50%';
  // 同 slot 的端口聚在一起（首帧/尾帧并排）
  const slot = port.slot ?? ports.indexOf(port);
  const slots = Array.from(new Set(ports.map((p, i) => p.slot ?? i)));
  const idx = slots.indexOf(slot);
  const n = slots.length;
  return `${((idx + 1) / (n + 1)) * 100}%`;
}

const handleBaseStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderWidth: 2,
  borderStyle: 'solid',
  borderRadius: '50%',
};

function PortHandle({ port, side, ports, isConnectable }: {
  port: PortSpec;
  side: 'in' | 'out';
  ports: PortSpec[];
  isConnectable: boolean;
}) {
  const color = `var(${PORT_KIND_VARS[port.kind]})`;
  return (
    <Handle
      id={port.id}
      type={side === 'in' ? 'target' : 'source'}
      position={side === 'in' ? Position.Left : Position.Right}
      isConnectable={isConnectable}
      className={`jz-node__handle jz-node__handle--${side} jz-node__handle--${port.kind}`}
      style={{
        ...handleBaseStyle,
        top: portTop(ports, port),
        background: 'var(--jz-bg-layer-2)',
        borderColor: color,
      }}
      title={`${port.label} · ${PORT_KIND_LABELS[port.kind]}`}
      aria-label={`${side === 'in' ? '输入' : '输出'}：${port.label}`}
    />
  );
}

/** 端口名细字：贴在节点外侧，不占正文空间 */
function PortLabel({ port, side, ports }: { port: PortSpec; side: 'in' | 'out'; ports: PortSpec[] }) {
  return (
    <span
      className="jz-node__port-label jz-node__port-label--outside"
      style={{
        top: portTop(ports, port),
        [side === 'in' ? 'left' : 'right']: -10,
        transform: side === 'in' ? 'translate(-100%, -50%)' : 'translate(100%, -50%)',
        color: `var(${PORT_KIND_VARS[port.kind]})`,
      }}
    >
      {port.label}
    </span>
  );
}

/** 一整套端口（输入在左，输出在右） */
export function NodePorts({ type, isConnectable = true }: { type: string; isConnectable?: boolean }) {
  const spec: NodePortSpec = portsOf(type);
  const hasOut = spec.outputs.length > 0;
  const hasIn = spec.inputs.length > 0;
  // 中文注释：端口标签默认只在 hover 时显示，避免节点太吵；但视频节点有 5 个入口，
  // 常显更易用，所以由 CSS 的 .jz-node--dense 控制。
  return (
    <>
      {spec.inputs.map((p) => (
        <PortLabel key={`l-${p.id}`} port={p} side="in" ports={spec.inputs} />
      ))}
      {spec.outputs.map((p) => (
        <PortLabel key={`l-${p.id}`} port={p} side="out" ports={spec.outputs} />
      ))}
      {spec.inputs.map((p) => (
        <PortHandle key={`h-${p.id}`} port={p} side="in" ports={spec.inputs} isConnectable={isConnectable} />
      ))}
      {spec.outputs.map((p) => (
        <PortHandle key={`h-${p.id}`} port={p} side="out" ports={spec.outputs} isConnectable={isConnectable} />
      ))}
      {!hasIn && !hasOut ? null : null}
    </>
  );
}

/* ========================================================================== */
/* 三、外壳                                                                    */
/* ========================================================================== */

export interface NodeShellProps {
  nodeId: string;
  type: NodeTypeKey;
  data: CanvasNodeData;
  selected?: boolean;
  icon: IconName;
  tone?: CanvasTone;
  /** 外壳宽度（px）；不传则不限制 */
  width?: number;
  /** 参数区折叠 */
  collapsed?: boolean;
  /** 是否显示"运行"按钮 */
  canRun?: boolean;
  /** 运行按钮文案 */
  runLabel?: string;
  /** 底部额外操作 */
  footer?: ReactNode;
  /** 标题条右侧额外内容 */
  headExtra?: ReactNode;
  /** 正文 */
  children?: ReactNode;
  /** 分组节点：无标题条、无端口 */
  variant?: 'default' | 'group' | 'annotation';
}

export function NodeShell({
  nodeId,
  type,
  data,
  selected = false,
  icon,
  tone = 'neutral',
  width,
  collapsed = false,
  canRun = false,
  runLabel = '运行',
  footer,
  headExtra,
  children,
  variant = 'default',
}: NodeShellProps) {
  const actions = useNodeActions();
  const status = statusOf(data);
  const meta = STATUS_META[status];
  const running = status === 'running';
  const isGroup = variant === 'group';

  const accent = toneVar(tone, 'text');
  const accentSoft = toneVar(tone, 'soft');
  const accentLine = toneVar(tone, 'line');

  const onRun = useCallback(() => {
    if (running) actions.cancel(nodeId);
    else actions.run(nodeId);
  }, [actions, nodeId, running]);

  if (isGroup) {
    return (
      <div
        className={[
          'jz-node',
          'jz-node--group',
          selected ? 'jz-node--selected' : '',
          `jz-node--tone-${tone}`,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          width,
          minHeight: 120,
          background: accentSoft,
          borderColor: selected ? accentLine : 'var(--jz-border)',
        }}
        data-node-id={nodeId}
      >
        <div className="jz-node__group-head">
          <span className="jz-node__group-swatch" style={{ background: accent }} />
          <span className="jz-node__group-title">{titleOf(type, data)}</span>
          {headExtra}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div
      className={[
        'jz-node',
        selected ? 'jz-node--selected' : '',
        running ? 'jz-node--running' : '',
        collapsed ? 'jz-node--collapsed' : '',
        `jz-node--tone-${tone}`,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width }}
      data-node-id={nodeId}
    >
      {/* 标题条 */}
      <div
        className="jz-node__head"
        style={{
          borderLeft: `3px solid ${accent}`,
          background: `linear-gradient(90deg, ${accentSoft}, transparent)`,
        }}
      >
        <span className="jz-node__icon" style={{ color: accent }} aria-hidden="true">
          <Icon name={icon} size={14} />
        </span>
        <span className="jz-node__title" title={titleOf(type, data)}>
          {titleOf(type, data)}
        </span>
        {headExtra}
        {status !== 'idle' ? (
          <Badge tone={meta.tone}>{running && data.progress ? `${meta.label} ${Math.round((data.progress ?? 0) * 100)}%` : meta.label}</Badge>
        ) : null}
        <span className="jz-node__head-actions">
          <IconButton
            label={collapsed ? '展开参数' : '收起参数'}
            size={14}
            onClick={(e) => {
              e.stopPropagation();
              actions.toggleCollapsed(nodeId);
            }}
          >
            <Icon name={collapsed ? 'chevronRight' : 'chevronDown'} size={14} />
          </IconButton>
        </span>
      </div>

      {/* 进度条（运行中） */}
      {running ? (
        <div className="jz-node__progress" role="progressbar" aria-valuenow={Math.round((data.progress ?? 0) * 100)}>
          <div
            className="jz-node__progress-fill"
            style={{ width: `${Math.max(4, Math.round((data.progress ?? 0) * 100))}%`, background: accent }}
          />
        </div>
      ) : null}

      {/* 正文 */}
      <div className="jz-node__body">
        {children}
        {data.error ? (
          <div className="jz-node__error" role="alert">
            <Icon name="alert" size={12} />
            <span>{data.error}</span>
          </div>
        ) : null}
      </div>

      {/* 底部：运行 + 返回 */}
      {canRun || footer ? (
        <div className="jz-node__foot">
          {canRun ? (
            <button
              type="button"
              className={running ? 'jz-node__run jz-node__run--stop nodrag' : 'jz-node__run nodrag'}
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
              style={running ? undefined : { background: accent, color: 'var(--jz-on-accent)' }}
            >
              <Icon name={running ? 'stop' : 'play'} size={12} />
              {running ? '取消' : runLabel}
            </button>
          ) : null}
          <span className="jz-node__foot-spacer" />
          {footer}
        </div>
      ) : null}

      <NodePorts type={type} />
    </div>
  );
}

/* ========================================================================== */
/* 四、参数面板（schema 驱动）                                                  */
/* ========================================================================== */

interface ParamPanelProps {
  nodeId: string;
  fields: ParamField[];
  params: Record<string, unknown> | undefined;
  collapsed: boolean;
  /** 分组标题（视频节点用） */
  groups?: Array<{ title: string; fields: ParamField[] }>;
}

/** 参数面板：按 ParamField 声明渲染，不用给每个节点手写表单 */
export function ParamPanel({ nodeId, fields, params, collapsed, groups }: ParamPanelProps) {
  const groupsToRender =
    groups && groups.length > 0 ? groups : [{ title: '', fields }];
  if (collapsed) return null;
  return (
    <div className="jz-node__params nowheel">
      {groupsToRender.map((g) => (
        <div key={g.title || 'default'} className="jz-node__param-group">
          {g.title ? <div className="jz-node__param-group-title">{g.title}</div> : null}
          {g.fields.map((f) => (
            <ParamControl key={f.key} nodeId={nodeId} field={f} params={params} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 单个参数控件 */
export function ParamControl({ nodeId, field, params }: {
  nodeId: string;
  field: ParamField;
  params: Record<string, unknown> | undefined;
}) {
  const actions = useNodeActions();
  const set = useCallback(
    (value: unknown) => actions.patchParams(nodeId, { [field.key]: value }),
    [actions, nodeId, field.key],
  );

  /* 分段编辑器单独处理（自带标题） */
  if (field.kind === 'segments') {
    return <SegmentsEditor nodeId={nodeId} field={field} params={params} />;
  }

  const label = field.label;
  const hint = field.hint;

  return (
    <Field label={label} hint={hint}>
      {renderControl()}
    </Field>
  );

  function renderControl(): ReactNode {
    switch (field.kind) {
      case 'textarea':
        return (
          <Textarea
            className="nodrag nowheel jz-node__control"
            value={typeof params?.[field.key] === 'string' ? (params[field.key] as string) : (field.default ?? '')}
            placeholder={field.placeholder}
            rows={field.rows ?? 2}
            readOnly={field.readOnly}
            onChange={(e) => set(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
          />
        );
      case 'input':
        return (
          <Input
            className="nodrag jz-node__control"
            mono={field.mono}
            value={typeof params?.[field.key] === 'string' ? (params[field.key] as string) : (field.default ?? '')}
            placeholder={field.placeholder}
            readOnly={field.readOnly}
            onChange={(e) => set(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
          />
        );
      case 'number': {
        const raw = params?.[field.key];
        const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : (field.default ?? 0);
        return (
          <div className="jz-node__number">
            <Input
              type="number"
              className="nodrag jz-node__control"
              value={Number.isFinite(value) ? value : 0}
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              readOnly={field.readOnly}
              onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))}
              onPointerDown={(e) => e.stopPropagation()}
            />
            {field.suffix ? <span className="jz-node__suffix">{field.suffix}</span> : null}
          </div>
        );
      }
      case 'select': {
        const raw = params?.[field.key];
        const value = typeof raw === 'string' ? raw : (field.default ?? '');
        return (
          <Select
            className="nodrag jz-node__control"
            options={field.options}
            value={value}
            onChange={set}
            onPointerDown={(e) => e.stopPropagation()}
          />
        );
      }
      case 'switch': {
        const raw = params?.[field.key];
        const checked = typeof raw === 'boolean' ? raw : Boolean(field.default);
        // label 由外层 <Field> 显示，这里不再给 Switch 传 label（否则同一行出现两遍文案）
        return (
          <div className="jz-node__switch-row nodrag">
            <Switch checked={checked} onChange={set} disabled={field.readOnly} />
          </div>
        );
      }
      case 'range': {
        const raw = params?.[field.key];
        const value = typeof raw === 'number' ? raw : (field.default ?? field.min);
        return (
          <div className="jz-node__range nodrag">
            <input
              type="range"
              className="jz-node__range-input"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={value}
              onChange={(e) => set(Number(e.target.value))}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={field.label}
            />
            <span className="jz-node__range-value">
              {value}
              {field.suffix ?? ''}
            </span>
          </div>
        );
      }
      case 'list': {
        const list = paramList(params, field.key);
        const text = list.join('\n');
        return (
          <Textarea
            className="nodrag nowheel jz-node__control"
            mono
            rows={Math.min(4, Math.max(2, list.length + 1))}
            value={text}
            placeholder={field.placeholder}
            onChange={(e) =>
              set(
                e.target.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, field.max ?? 99),
              )
            }
            onPointerDown={(e) => e.stopPropagation()}
          />
        );
      }
      default:
        return null;
    }
  }
}

/* ========================================================================== */
/* 五、五段流编辑器（videoGeneratorNode 专属）                                   */
/* ========================================================================== */

function SegmentsEditor({ nodeId, field, params }: {
  nodeId: string;
  field: Extract<ParamField, { kind: 'segments' }>;
  params: Record<string, unknown> | undefined;
}) {
  const actions = useNodeActions();
  const segments = paramSegments(params, field.key, field.default ?? []);
  const [active, setActive] = useState(0);

  const commit = useCallback(
    (next: VideoSegmentParam[]) => {
      actions.patchParams(nodeId, { [field.key]: next });
    },
    [actions, nodeId, field.key],
  );

  const setPrompt = (idx: number, prompt: string) => {
    const next = segments.map((s, i) => (i === idx ? { ...s, prompt } : s));
    commit(next);
  };
  const setStartImage = (idx: number, startImage: string) => {
    const next = segments.map((s, i) => (i === idx ? { ...s, startImage } : s));
    commit(next);
  };
  const setDuration = (idx: number, durationSec: number | undefined) => {
    const next = segments.map((s, i) => (i === idx ? { ...s, durationSec } : s));
    commit(next);
  };
  const addSegment = () => {
    if (segments.length >= field.max) return;
    commit([...segments, { index: segments.length + 1, prompt: '', durationSec: 5 }]);
    setActive(Math.min(segments.length, field.max - 1));
  };
  const removeSegment = (idx: number) => {
    if (segments.length <= field.min) return;
    const next = segments.filter((_, i) => i !== idx).map((s, i) => ({ ...s, index: i + 1 }));
    commit(next);
    setActive(Math.max(0, Math.min(active, next.length - 1)));
  };

  return (
    <div className="jz-node__segments nodrag nowheel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="jz-node__segments-head">
        <span className="jz-node__segments-title">
          {field.label}
          <span className="jz-node__segments-count">
            {segments.length}/{field.max} 段
          </span>
        </span>
        <button
          type="button"
          className="jz-node__seg-add nodrag"
          onClick={addSegment}
          disabled={segments.length >= field.max}
          title="增加一段"
        >
          <Icon name="plus" size={12} /> 加段
        </button>
      </div>

      {/* 段选择胶囊 */}
      <div className="jz-node__seg-tabs" role="tablist" aria-label="五段流分段">
        {segments.map((s, i) => (
          <button
            key={s.index}
            type="button"
            role="tab"
            aria-selected={active === i}
            className={active === i ? 'jz-node__seg-tab jz-node__seg-tab--active nodrag' : 'jz-node__seg-tab nodrag'}
            onClick={() => setActive(i)}
            title={`第 ${i + 1} 段`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {segments.map((s, i) =>
        active === i ? (
          <div key={s.index} className="jz-node__seg-body">
            <Field label={`第 ${i + 1} 段提示词`}>
              <Textarea
                className="nodrag nowheel jz-node__control"
                rows={3}
                value={s.prompt}
                placeholder="本段画面/动作/镜头…"
                onChange={(e) => setPrompt(i, e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </Field>
            <Field label="起点图" hint="留空则自动接上一段尾帧">
              <Input
                className="nodrag jz-node__control"
                mono
                value={s.startImage ?? ''}
                placeholder="图片地址"
                onChange={(e) => setStartImage(i, e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </Field>
            <div className="jz-node__seg-foot">
              <Field label="本段时长" inline>
                <Input
                  type="number"
                  className="nodrag jz-node__control jz-node__control--narrow"
                  min={1}
                  max={15}
                  value={s.durationSec ?? 5}
                  onChange={(e) =>
                    setDuration(i, e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  onPointerDown={(e) => e.stopPropagation()}
                />
              </Field>
              <button
                type="button"
                className="jz-node__seg-del nodrag"
                onClick={() => removeSegment(i)}
                disabled={segments.length <= field.min}
                title="删除本段"
              >
                <Icon name="trash" size={12} /> 删段
              </button>
            </div>
          </div>
        ) : null,
      )}

      <div className="jz-node__seg-hint">{field.hint}</div>
    </div>
  );
}

/* ========================================================================== */
/* 六、预览区                                                                  */
/* ========================================================================== */

export type PreviewKind = 'image' | 'video' | 'audio' | 'text' | 'panorama' | 'pose';

export function PreviewBox({ data, kind, emptyHint }: {
  data: CanvasNodeData;
  kind: PreviewKind;
  emptyHint?: string;
}) {
  const result = data.result;
  const url = result?.url;
  const text = result?.text;

  if (kind === 'text') {
    if (text) {
      return (
        <div className="jz-node__preview jz-node__preview--text nowheel">
          <pre className="jz-node__preview-text">{text}</pre>
        </div>
      );
    }
    return <PreviewEmpty hint={emptyHint ?? '尚无文本'} />;
  }

  if (!url) return <PreviewEmpty hint={emptyHint ?? '尚无产物'} />;

  if (kind === 'image' || kind === 'panorama' || kind === 'pose') {
    return (
      <div className="jz-node__preview">
        <img className="jz-node__preview-img" src={url} alt={result?.path ?? '预览'} loading="lazy" draggable={false} />
      </div>
    );
  }
  if (kind === 'video') {
    return (
      <div className="jz-node__preview">
        <video className="jz-node__preview-video nodrag" src={url} controls preload="metadata" />
      </div>
    );
  }
  return (
    <div className="jz-node__preview jz-node__preview--audio">
      <audio className="nodrag" src={url} controls preload="metadata" />
    </div>
  );
}

export function PreviewEmpty({ hint }: { hint: string }) {
  return (
    <div className="jz-node__preview jz-node__preview--empty">
      <Icon name="image" size={16} />
      <span>{hint}</span>
    </div>
  );
}

/* ========================================================================== */
/* 七、上传区                                                                  */
/* ========================================================================== */

export function UploadBox({ nodeId, kind, data, acceptHint }: {
  nodeId: string;
  kind: 'image' | 'audio' | 'video';
  data: CanvasNodeData;
  acceptHint: string;
}) {
  const actions = useNodeActions();
  const icon: IconName = kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'audio';
  const url = data.result?.url;
  const fileName = typeof data.params?.sourcePath === 'string' ? data.params.sourcePath : '';

  return (
    <div className="jz-node__upload">
      {url && (kind === 'image' || kind === 'video') ? (
        <div className="jz-node__upload-preview">
          {kind === 'image' ? (
            <img src={url} alt="已上传" draggable={false} />
          ) : (
            <video src={url} muted preload="metadata" />
          )}
        </div>
      ) : (
        <button
          type="button"
          className="jz-node__dropzone nodrag"
          onClick={(e) => {
            e.stopPropagation();
            actions.pickFile(nodeId, kind);
          }}
        >
          <Icon name="upload" size={18} />
          <span className="jz-node__dropzone-main">{fileName || '点击或拖拽上传'}</span>
          <span className="jz-node__dropzone-hint">{acceptHint}</span>
        </button>
      )}
      {url ? (
        <button
          type="button"
          className="jz-node__replace nodrag"
          onClick={(e) => {
            e.stopPropagation();
            actions.pickFile(nodeId, kind);
          }}
        >
          <Icon name="refresh" size={11} />
          替换
          <Icon name={icon} size={11} />
        </button>
      ) : null}
    </div>
  );
}

/* ========================================================================== */
/* 八、其它小构件                                                              */
/* ========================================================================== */

/** 结果统计行（提取类节点：抽到 N 个角色） */
export function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="jz-node__stat">
      <span className="jz-node__stat-label">{label}</span>
      <span className="jz-node__stat-value">{value}</span>
    </div>
  );
}

/** 小提示条 */
export function HintLine({ children }: { children: ReactNode }) {
  return <div className="jz-node__hint-line">{children}</div>;
}

export type { NodeProps };
export type { PortKind };