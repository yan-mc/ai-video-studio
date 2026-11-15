/**
 * 26 种画布节点的 **type key** 与中文名 —— 全局唯一事实来源。
 *
 * 为什么单独一个文件（不塞进 nodeRegistry / portTypes）：
 *  - portTypes 需要 type key 来声明端口表，nodeRegistry 也需要；
 *  - 两边互相 import 会形成循环依赖，打包器与 node 测试都会踩坑。
 *  - 这里只放纯常量，零依赖，node 可直接 type-strip 后 import。
 *
 * 来源（三者必须逐字一致）：
 *  1. `功能拆解/预演软件/03_反编译与代码/主UI_节点画布/artifacts/node-types.json`
 *  2. `功能拆解/预演软件/02_报告/03_主UI_节点画布工作台.md` §4.1
 *  3. 后端 `dsh-jiuzhang-studio/host/store/models.js` 的 NODE_TYPES / NODE_LABELS
 *
 * 顺序与后端 NODE_TYPES 完全一致，方便对照与快照测试。
 */

export const NODE_TYPE_KEYS = [
  /* 本地来源 */
  'uploadNode',
  'audioUploadNode',
  'uploadVideoNode',
  /* 生成 */
  'agentGenNode',
  'imageNode',
  'aiTextNode',
  /* 音色 */
  'aiVoiceGenerationNode',
  'extractVoiceNode',
  /* 结构化提取 */
  'extractCharacterNode',
  'extractSceneNode',
  'extractItemNode',
  /* 结果 */
  'exportImageNode',
  'exportVideoNode',
  /* 画布辅助 */
  'textAnnotationNode',
  'groupNode',
  /* 分镜 */
  'storyboardNode',
  'storyboardGenNode',
  /* 视频（最复杂） */
  'videoGeneratorNode',
  /* 全景 */
  'vr360PanoramaNode',
  'panoramaViewerBNode',
  'panoramaNode',
  /* 剧集 / 音乐 */
  'episodeSubCanvasNode',
  'backgroundMusicNode',
  /* 3D */
  'blueprintNode',
  'previzNode',
  'poseStudioNode',
] as const;

/** 节点类型 key 的联合类型 */
export type NodeTypeKey = (typeof NODE_TYPE_KEYS)[number];

/**
 * 中文名 —— 与后端 NODE_LABELS 逐字一致。
 * 节点标题优先取节点 data.title（用户可改名），没有才回退到这里的默认名。
 */
export const NODE_LABELS: Record<NodeTypeKey, string> = {
  uploadNode: '上传图片',
  audioUploadNode: '上传音频',
  uploadVideoNode: '上传视频',
  agentGenNode: '智能体生成',
  imageNode: 'AI 图片',
  aiTextNode: 'AI 文本',
  aiVoiceGenerationNode: 'AI 音色',
  extractVoiceNode: '提取音色',
  extractCharacterNode: '角色提取',
  extractSceneNode: '场景提取',
  extractItemNode: '道具提取',
  exportImageNode: '结果图片',
  exportVideoNode: '结果视频',
  textAnnotationNode: '文本注释',
  groupNode: '分组',
  storyboardNode: '切割结果',
  storyboardGenNode: '分镜生成',
  videoGeneratorNode: 'AI 视频',
  vr360PanoramaNode: '全景图 A · 探索版',
  panoramaViewerBNode: '全景图 B · 查看版',
  panoramaNode: '全景图生成',
  episodeSubCanvasNode: '剧集画布',
  backgroundMusicNode: '背景音乐生成',
  blueprintNode: '导演台',
  previzNode: '白模预演',
  poseStudioNode: '姿势台',
};

/** type key 是否合法（读后端/旧画布数据时做防御） */
export function isNodeTypeKey(value: unknown): value is NodeTypeKey {
  return typeof value === 'string' && (NODE_TYPE_KEYS as readonly string[]).includes(value);
}

/** 取默认中文名；未知 type 回退成 type 本身，便于定位脏数据 */
export function defaultNodeLabel(type: string): string {
  return isNodeTypeKey(type) ? NODE_LABELS[type] : type;
}