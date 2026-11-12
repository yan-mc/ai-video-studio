/**
 * 全景类节点：vr360PanoramaNode（探索版 A） / panoramaViewerBNode（查看版 B）。
 *
 * A 版是"探索"：球面/柱面切换 + 3D 假人摆位 + 四向导出 + 截图；
 * B 版是"查看"：只读、四视图平铺、可导出。
 * 两者都不自己做 WebGL —— 真正的 PhotoSphereViewer 集成由全景查看器面板负责，
 * 节点内只显示 equirect 缩略 + 当前视角示意（避免画布上跑多个 WebGL 上下文拖慢性能）。
 */
import type { NodeProps } from '@xyflow/react';
import { Badge, Icon } from '../../ui';
import { getDefinition, selectLabelOf } from '../nodeRegistry';
import { paramBool, paramNum, paramStr } from '../types';
import {
  NodeShell,
  ParamPanel,
  PreviewBox,
  HintLine,
  nodeData,
} from './_shared';
import { useNodeActions } from '../nodeActions';

/* ------------------------------------------------------- 全景图 A · 探索版 */

const DEF_VR = getDefinition('vr360PanoramaNode');

export function Vr360PanoramaNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_VR;
  const actions = useNodeActions();
  const projection = paramStr(data.params, 'projection', 'sphere');
  const showFigure = paramBool(data.params, 'showFigure', true);
  const fov = paramNum(data.params, 'fov', 75);
  const exportDir = paramStr(data.params, 'exportDirection', 'front');
  const dirLabel = selectLabelOf('vr360PanoramaNode', 'exportDirection', exportDir);

  return (
    <NodeShell
      nodeId={props.id}
      type="vr360PanoramaNode"
      data={data}
      selected={props.selected}
      icon="eye"
      tone="accent"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      headExtra={
        <span className="jz-node__meta-chips">
          <Badge tone="accent">{projection === 'sphere' ? '球面' : '柱面'}</Badge>
          <Badge>{fov}°</Badge>
          {showFigure ? <Badge tone="accent">假人</Badge> : null}
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
            <Icon name="download" size={11} /> 导出{dirLabel}
          </button>
          <button
            type="button"
            className="jz-node__foot-btn jz-node__foot-btn--ghost nodrag"
            onClick={(e) => {
              e.stopPropagation();
              actions.openStudio(props.id);
            }}
          >
            <Icon name="external" size={11} /> 全景
          </button>
        </span>
      }
    >
      <div className="jz-node__pano-stage">
        {data.result?.url ? (
          <img className="jz-node__pano-img" src={data.result.url} alt="全景" draggable={false} />
        ) : (
          <div className="jz-node__pano-empty">
            <Icon name="eye" size={18} />
            <span>等待全景图</span>
          </div>
        )}
        {/* 视角指示框（纯装饰，表达 fov 与朝向） */}
        <span className="jz-node__pano-crosshair" aria-hidden="true" />
        {showFigure ? (
          <span className="jz-node__pano-figure" aria-label="3D 假人摆位">
            <Icon name="cube" size={12} />
          </span>
        ) : null}
      </div>
      <div className="jz-node__dirs" aria-label="四向导出">
        {['前', '后', '左', '右'].map((d) => (
          <span key={d} className="jz-node__dir">
            {d}
          </span>
        ))}
      </div>
      <HintLine>画布内只做缩略；完整球面查看在「全景查看器」中打开</HintLine>
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* ------------------------------------------------------- 全景图 B · 查看版 */

const DEF_VIEWER_B = getDefinition('panoramaViewerBNode');

export function PanoramaViewerBNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_VIEWER_B;
  const actions = useNodeActions();
  const projection = paramStr(data.params, 'projection', 'sphere');
  const locked = paramBool(data.params, 'locked', true);
  const url = data.result?.url;

  return (
    <NodeShell
      nodeId={props.id}
      type="panoramaViewerBNode"
      data={data}
      selected={props.selected}
      icon="eye"
      tone="info"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      headExtra={
        <span className="jz-node__meta-chips">
          <Badge>{projection === 'sphere' ? '球面' : '柱面'}</Badge>
          {locked ? <Badge>只读</Badge> : null}
        </span>
      }
      footer={
        <button
          type="button"
          className="jz-node__foot-btn nodrag"
          disabled={!url}
          onClick={(e) => {
            e.stopPropagation();
            actions.download(props.id);
          }}
        >
          <Icon name="download" size={11} /> 四视图
        </button>
      }
    >
      {/* 四视图平铺：B 版的核心就是"一眼看四向" */}
      <div className="jz-node__quad" aria-label="前/后/左/右四视图">
        {['前', '后', '左', '右'].map((dir) => (
          <div key={dir} className="jz-node__quad-cell">
            {url ? (
              <img src={url} alt={`${dir}视图`} draggable={false} />
            ) : (
              <>
                <Icon name="eye" size={12} />
                <span>{dir}</span>
              </>
            )}
          </div>
        ))}
      </div>
      <PreviewBox data={data} kind="panorama" emptyHint="等待全景图" />
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}