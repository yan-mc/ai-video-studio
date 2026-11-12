/**
 * 兜底节点 —— 读到的画布里出现注册表不认识的 type 时用它。
 *
 * 为什么不直接抛错/丢节点：
 *   画布数据来自后端 JSON，可能是旧版本（节点被重命名）或别的分支写的。
 *   直接丢会让用户"打开项目少了一半节点"，比显示一个灰色未知节点糟糕得多。
 *   这里保留位置/选中/删除能力，让用户能自己清理。
 */
import type { NodeProps } from '@xyflow/react';
import { Badge, Icon } from '../../ui';
import { nodeData } from './_shared';
import { useNodeActions } from '../nodeActions';

export function UnknownNode(props: NodeProps) {
  const data = nodeData(props.data);
  const actions = useNodeActions();
  const type = typeof props.type === 'string' ? props.type : '?';

  return (
    <div
      className={props.selected ? 'jz-node jz-node--unknown jz-node--selected' : 'jz-node jz-node--unknown'}
      style={{ width: 200 }}
      data-node-id={props.id}
    >
      <div className="jz-node__head" style={{ borderLeft: '3px solid var(--jz-danger-text)' }}>
        <span className="jz-node__icon" style={{ color: 'var(--jz-danger-text)' }}>
          <Icon name="alert" size={14} />
        </span>
        <span className="jz-node__title">未知节点</span>
        <Badge tone="danger">{type}</Badge>
      </div>
      <div className="jz-node__body">
        <div className="jz-node__unknown-hint">
          该节点类型不在当前版本（26 种）里，可能是旧画布或未来版本数据。
        </div>
        {typeof data.title === 'string' && data.title ? (
          <div className="jz-node__unknown-title">标题：{data.title}</div>
        ) : null}
        <button
          type="button"
          className="jz-node__foot-btn nodrag"
          onClick={(e) => {
            e.stopPropagation();
            actions.remove(props.id);
          }}
        >
          <Icon name="trash" size={11} /> 删除此节点
        </button>
      </div>
    </div>
  );
}

export default UnknownNode;