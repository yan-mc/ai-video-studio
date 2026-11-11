/**
 * 上传类节点：uploadNode / audioUploadNode / uploadVideoNode。
 *
 * 三者行为一致（选择本地文件 → 预览 → 替换），差异只在 accept 与预览控件，
 * 所以抽同一套逻辑、各写一个具名组件，注册表按 type key 映射。
 */
import type { NodeProps } from '@xyflow/react';
import { Icon, Badge } from '../../ui';
import { getDefinition } from '../nodeRegistry';
import { paramStr } from '../types';
import { NodeShell, PreviewBox, UploadBox, ParamPanel, nodeData } from './_shared';

const DEF_UPLOAD = getDefinition('uploadNode');
const DEF_AUDIO = getDefinition('audioUploadNode');
const DEF_VIDEO = getDefinition('uploadVideoNode');

/* --------------------------------------------------------------- 上传图片 */

export function UploadNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_UPLOAD;
  return (
    <NodeShell
      nodeId={props.id}
      type="uploadNode"
      data={data}
      selected={props.selected}
      icon="image"
      tone="info"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      headExtra={<Badge>本地</Badge>}
    >
      <UploadBox nodeId={props.id} kind="image" data={data} acceptHint="PNG · JPG · WEBP" />
      <PreviewBox data={data} kind="image" emptyHint="上传后可在此预览" />
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* --------------------------------------------------------------- 上传音频 */

export function AudioUploadNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_AUDIO;
  return (
    <NodeShell
      nodeId={props.id}
      type="audioUploadNode"
      data={data}
      selected={props.selected}
      icon="audio"
      tone="ok"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      headExtra={<Badge>本地</Badge>}
    >
      <UploadBox nodeId={props.id} kind="audio" data={data} acceptHint="MP3 · WAV · M4A" />
      <PreviewBox data={data} kind="audio" emptyHint="上传后可在此试听" />
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/* --------------------------------------------------------------- 上传视频 */

export function UploadVideoNode(props: NodeProps) {
  const data = nodeData(props.data);
  const def = DEF_VIDEO;
  const asPlate = Boolean(data.params?.asPrevizPlate);
  return (
    <NodeShell
      nodeId={props.id}
      type="uploadVideoNode"
      data={data}
      selected={props.selected}
      icon="video"
      tone="warn"
      width={def?.size.width}
      collapsed={Boolean(data.collapsed)}
      headExtra={
        asPlate ? (
          <Badge tone="warn">
            <Icon name="cube" size={10} /> 白模底片
          </Badge>
        ) : (
          <Badge>本地</Badge>
        )
      }
    >
      <UploadBox nodeId={props.id} kind="video" data={data} acceptHint="MP4 · MOV" />
      <PreviewBox data={data} kind="video" emptyHint="上传后可在此预览" />
      <ParamPanel nodeId={props.id} fields={def?.fields ?? []} params={data.params} collapsed={Boolean(data.collapsed)} />
    </NodeShell>
  );
}

/** 上传视频节点的源文件名（画布上一眼认出底片） */
export function videoPlateName(data: Record<string, unknown>): string {
  const params = (data as { params?: Record<string, unknown> }).params;
  return paramStr(params, 'sourcePath');
}