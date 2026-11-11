/**
 * nodeTypes 映射 —— 26 个 type key → 组件。
 *
 * ⚠️ 这个对象必须是**模块级常量**：React Flow 在每次渲染时比较 nodeTypes 的
 * 引用，内联新建对象会导致所有节点反复重挂载（性能灾难 + 输入框失焦）。
 *
 * 26 条必须与 nodeKeys.NODE_TYPE_KEYS 一一对应，缺一条会 fallback 到 UnknownNode；
 * 单测会断言 `Object.keys(nodeTypes)` 恰好是那 26 个 key。
 */
import type { NodeTypes } from '@xyflow/react';
import { UploadNode, AudioUploadNode, UploadVideoNode } from './uploadNodes';
import { AgentGenNode, ImageNode, AiVoiceGenerationNode, BackgroundMusicNode } from './generateNodes';
import { AiTextNode, TextAnnotationNode } from './textNodes';
import { ExtractVoiceNode, ExtractCharacterNode, ExtractSceneNode, ExtractItemNode, PanoramaNode } from './extractNodes';
import { ExportImageNode, ExportVideoNode } from './resultNodes';
import { GroupNode } from './groupNode';
import {
  StoryboardGenNode,
  StoryboardNode,
  EpisodeSubCanvasNode,
} from './storyboardNodes';
import { VideoGeneratorNode } from './videoGeneratorNode';
import { Vr360PanoramaNode, PanoramaViewerBNode } from './panoramaNodes';
import { BlueprintNode, PrevizNode, PoseStudioNode } from './studioNodes';
import { UnknownNode } from './UnknownNode';

/**
 * 26 种节点 —— 顺序与 nodeKeys.NODE_TYPE_KEYS 一致，便于肉眼核对。
 */
export const nodeTypes: NodeTypes = {
  /* 上传 */
  uploadNode: UploadNode,
  audioUploadNode: AudioUploadNode,
  uploadVideoNode: UploadVideoNode,
  /* 生成 */
  agentGenNode: AgentGenNode,
  imageNode: ImageNode,
  aiTextNode: AiTextNode,
  /* 音色 */
  aiVoiceGenerationNode: AiVoiceGenerationNode,
  extractVoiceNode: ExtractVoiceNode,
  /* 结构化提取 */
  extractCharacterNode: ExtractCharacterNode,
  extractSceneNode: ExtractSceneNode,
  extractItemNode: ExtractItemNode,
  /* 结果 */
  exportImageNode: ExportImageNode,
  exportVideoNode: ExportVideoNode,
  /* 画布辅助 */
  textAnnotationNode: TextAnnotationNode,
  groupNode: GroupNode,
  /* 分镜 */
  storyboardNode: StoryboardNode,
  storyboardGenNode: StoryboardGenNode,
  /* 视频 */
  videoGeneratorNode: VideoGeneratorNode,
  /* 全景 */
  vr360PanoramaNode: Vr360PanoramaNode,
  panoramaViewerBNode: PanoramaViewerBNode,
  panoramaNode: PanoramaNode,
  /* 剧集 / 音乐 */
  episodeSubCanvasNode: EpisodeSubCanvasNode,
  backgroundMusicNode: BackgroundMusicNode,
  /* 3D */
  blueprintNode: BlueprintNode,
  previzNode: PrevizNode,
  poseStudioNode: PoseStudioNode,
};

/** 未知类型的兜底组件 key（CanvasArea 用 nodeTypes[node.type] ?? nodeTypes.__unknown） */
export const UNKNOWN_NODE_TYPE = '__unknown';

/** 带兜底的完整映射（含 __unknown） */
export const allNodeTypes: NodeTypes = {
  ...nodeTypes,
  [UNKNOWN_NODE_TYPE]: UnknownNode,
};

/** 26 个已注册的 type key（不含 __unknown） */
export const REGISTERED_NODE_TYPES: string[] = Object.keys(nodeTypes);

export { UnknownNode };
export default nodeTypes;