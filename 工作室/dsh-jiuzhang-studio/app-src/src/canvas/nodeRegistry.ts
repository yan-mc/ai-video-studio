/**
 * 26 种节点的注册表 —— 单一事实来源。
 *
 * 一个节点在这里声明一次，就能同时得到：
 *   · React Flow 的 nodeTypes 组件映射（nodes/index.ts 从这里生成）
 *   · 右键菜单/调色板的条目与分组
 *   · 参数面板（ParamField[] 驱动渲染，不用为每个节点手写表单）
 *   · 新建节点时的默认尺寸与默认参数
 *   · 端口表的可读性校验（与 portTypes.NODE_PORTS 的 key 集合必须一致）
 *
 * 新增节点的方法：① nodeKeys.ts 加 key；② portTypes.ts 加端口；
 * ③ 这里加定义；④ nodes/ 加组件；⑤ nodes/index.ts 加映射。缺一步测试会报。
 *
 * 参数来源：`02_报告/03_主UI_节点画布工作台.md` §4.1 的逐节点"功能要点"。
 * 模型档位来源：后端 `host/store/models.js` 的 H3_MODEL_SLOTS（19 档）与 Seedance 目录。
 */
import { NODE_LABELS, NODE_TYPE_KEYS } from './nodeKeys';
import type { NodeTypeKey } from './nodeKeys';
import type {
  CanvasTone,
  NodeCategory,
  NodeDefinition,
  ParamField,
  VideoSegmentParam,
} from './types';
import type { NodePortSpec } from './portTypes';
import { portsOf } from './portTypes';

/* ========================================================================== */
/* 一、公共选项常量                                                            */
/* ========================================================================== */

/** 19 档 H3 模型槽位 —— 与后端 models.js 的 H3_MODEL_SLOTS 逐项一致（去品牌后的 JZ_* 映射） */
export const H3_MODEL_SLOT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'T2V', label: 'H3 · 文生视频' },
  { value: 'I2V', label: 'H3 · 图生视频' },
  { value: 'FLF', label: 'H3 · 首尾帧' },
  { value: '5SEG', label: 'H3 · 五段流' },
  { value: 'U04', label: 'H3 · 专项 U04' },
  { value: 'U05', label: 'H3 · 专项 U05' },
  { value: 'U07', label: 'H3 · 专项 U07' },
  { value: 'U09V3', label: 'H3 · 专项 U09 v3' },
  { value: 'U09V4', label: 'H3 · 专项 U09 v4' },
  { value: 'U14', label: 'H3 · 专项 U14' },
  { value: 'U16', label: 'H3 · 专项 U16' },
  { value: 'U17', label: 'H3 · 专项 U17' },
  { value: 'U20FIGHT', label: 'H3 · 战斗连续性' },
  { value: 'U20FL2VA', label: 'H3 · FL2VA' },
  { value: 'U22', label: 'H3 · 专项 U22' },
  { value: 'U24V2', label: 'H3 · 专项 U24 v2' },
  { value: 'U24V927', label: 'H3 · 专项 U24 v927' },
  { value: 'U28', label: 'H3 · 专项 U28' },
  { value: 'U32', label: 'H3 · 专项 U32' },
];

/** Seedance 云端模型（火山引擎 2.x 系列） */
export const SEEDANCE_MODEL_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'volc/doubao-seedance-2-5', label: 'Seedance 2.5' },
  { value: 'volc/doubao-seedance-2-0', label: 'Seedance 2.0' },
  { value: 'volc/doubao-seedance-2-0-mini', label: 'Seedance 2.0 Mini' },
  { value: 'volc/doubao-seedance-2-0-fast', label: 'Seedance 2.0 Fast' },
];

/** 视频节点的模型选择：backend 决定可用档位（H3 19 档 / Seedance 4 档） */
export const VIDEO_MODEL_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'h3:T2V', label: 'H3 本地 · 文生视频（T2V）' },
  { value: 'h3:I2V', label: 'H3 本地 · 图生视频（I2V）' },
  { value: 'h3:FLF', label: 'H3 本地 · 首尾帧（FLF）' },
  { value: 'h3:5SEG', label: 'H3 本地 · 五段流（5SEG）' },
  ...H3_MODEL_SLOT_OPTIONS.filter((o) => !['T2V', 'I2V', 'FLF', '5SEG'].includes(o.value)).map(
    (o) => ({ value: `h3:${o.value}`, label: o.label }),
  ),
  ...SEEDANCE_MODEL_OPTIONS.map((o) => ({ value: `seedance:${o.value}`, label: o.label })),
];

const ASPECT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '16:9', label: '16:9 横屏' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '1:1', label: '1:1 方形' },
  { value: '21:9', label: '21:9 宽银幕' },
  { value: '2:1', label: '2:1 全景' },
];

/** 六种生成档位（后端 PROFILES） */
const PROFILE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'P12-draft', label: 'P12 草稿 480p' },
  { value: 'P16-std', label: 'P16 标准 544p' },
  { value: 'P24-quality', label: 'P24 高质 608p' },
  { value: 'P768-quality', label: '768p 官方档' },
  { value: 'cloud-fallback', label: '云端兜底 720p' },
];

const LLM_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash（快）' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro（强）' },
];

const RESULT_KIND_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'generic', label: '通用结果' },
  { value: 'storyboardGenOutput', label: '分镜生成产物' },
  { value: 'storyboardSplitExport', label: '分镜切割导出' },
  { value: 'storyboardFrameEdit', label: '单格编辑产物' },
  { value: 'videoGeneratorOutput', label: 'AI 视频产物' },
];

/** videoGeneratorNode 五段流默认 2 段（用户最常用的多镜头起步数） */
export const DEFAULT_VIDEO_SEGMENTS: VideoSegmentParam[] = [
  { index: 1, prompt: '', durationSec: 5 },
  { index: 2, prompt: '', durationSec: 5 },
];

/* ========================================================================== */
/* 二、26 个节点定义                                                            */
/* ========================================================================== */

const DEFS: NodeDefinition[] = [
  /* ------------------------------ 1 上传导入 ----------------------------- */
  {
    type: 'uploadNode',
    label: NODE_LABELS.uploadNode,
    shortLabel: '图片',
    icon: 'image',
    category: 'upload',
    description: '拖拽或点击上传本地图片，可替换',
    size: { width: 236, height: 214 },
    tone: 'info',
    capabilities: { fileInput: true, preview: true },
    fields: [
      {
        kind: 'select',
        key: 'fit',
        label: '显示方式',
        default: 'contain',
        options: [
          { value: 'contain', label: '完整显示' },
          { value: 'cover', label: '填满裁切' },
        ],
      },
      { kind: 'input', key: 'sourcePath', label: '源文件', hint: '上传后自动回填', readOnly: true, mono: true },
    ],
  },
  {
    type: 'audioUploadNode',
    label: NODE_LABELS.audioUploadNode,
    shortLabel: '音频',
    icon: 'audio',
    category: 'upload',
    description: '上传 MP3 / WAV 音频',
    size: { width: 236, height: 176 },
    tone: 'ok',
    capabilities: { fileInput: true, preview: true },
    fields: [
      { kind: 'number', key: 'durationSec', label: '时长（秒）', min: 0, readOnly: true, suffix: '秒' },
      { kind: 'switch', key: 'loop', label: '循环播放', default: false },
    ],
  },
  {
    type: 'uploadVideoNode',
    label: NODE_LABELS.uploadVideoNode,
    shortLabel: '视频',
    icon: 'video',
    category: 'upload',
    description: '上传 mp4 / mov（可作白模底片）',
    size: { width: 236, height: 210 },
    tone: 'warn',
    capabilities: { fileInput: true, preview: true },
    fields: [
      { kind: 'switch', key: 'muted', label: '静音预览', default: true },
      { kind: 'switch', key: 'asPrevizPlate', label: '作为白模底片', default: false },
    ],
  },

  /* ------------------------------- 2 AI 生成 ----------------------------- */
  {
    type: 'agentGenNode',
    label: NODE_LABELS.agentGenNode,
    shortLabel: '智能体',
    icon: 'spark',
    category: 'generate',
    description: '图片分析 → 提示词 → 生成图/视频（最长 15 秒），可绑定智能体模板',
    size: { width: 280, height: 300 },
    tone: 'accent',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      {
        kind: 'select',
        key: 'template',
        label: '智能体模板',
        default: 'auto',
        options: [
          { value: 'auto', label: '自动（按输入选择）' },
          { value: 'imageAnalyze', label: '图片分析出提示词' },
          { value: 'shotDesign', label: '镜头设计' },
          { value: 'characterDesign', label: '角色设计' },
          { value: 'custom', label: '自定义' },
        ],
      },
      {
        kind: 'select',
        key: 'target',
        label: '产出类型',
        default: 'image',
        options: [
          { value: 'image', label: '图片' },
          { value: 'video', label: '视频（≤15 秒）' },
          { value: 'text', label: '提示词文本' },
        ],
      },
      { kind: 'select', key: 'model', label: '模型', default: 'deepseek-v4-flash', options: LLM_OPTIONS },
      { kind: 'textarea', key: 'prompt', label: '指令', rows: 3, placeholder: '描述希望智能体做什么…' },
      { kind: 'number', key: 'durationSec', label: '视频时长', min: 1, max: 15, step: 1, default: 5, suffix: '秒' },
    ],
  },
  {
    type: 'imageNode',
    label: NODE_LABELS.imageNode,
    shortLabel: 'AI 图片',
    icon: 'image',
    category: 'generate',
    description: '提示词 / 参考图 / 模型 / 尺寸 / 比例 / 清晰度，生成后可继续编辑',
    size: { width: 268, height: 328 },
    tone: 'accent',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      { kind: 'textarea', key: 'prompt', label: '提示词', rows: 3, placeholder: '画面描述…' },
      { kind: 'textarea', key: 'negativePrompt', label: '反向提示词', rows: 2, placeholder: '不希望出现的元素…' },
      {
        kind: 'select',
        key: 'model',
        label: '模型',
        default: 'luoshu-comfy/qwen-t2i',
        options: [
          { value: 'luoshu-comfy/qwen-t2i', label: 'Qwen Image 2.1 · 文生图' },
          { value: 'luoshu-comfy/qwen-edit', label: 'Qwen Image 2.1 · 编辑（≤16 参考）' },
          { value: 'luoshu/nano-banana-pro', label: 'Nano Banana Pro' },
          { value: 'luoshu/nano-banana-2', label: 'Nano Banana 2' },
          { value: 'luoshu/gpt-image-2.5-flare', label: 'GPT Image 2.5' },
        ],
      },
      { kind: 'select', key: 'aspectRatio', label: '比例', default: '16:9', options: ASPECT_OPTIONS },
      {
        kind: 'select',
        key: 'size',
        label: '尺寸',
        default: '1024',
        options: [
          { value: '768', label: '768' },
          { value: '1024', label: '1024' },
          { value: '1536', label: '1536' },
          { value: '2048', label: '2048' },
        ],
      },
      {
        kind: 'select',
        key: 'quality',
        label: '清晰度',
        default: 'standard',
        options: [
          { value: 'draft', label: '草稿' },
          { value: 'standard', label: '标准' },
          { value: 'hd', label: '高清' },
        ],
      },
      { kind: 'number', key: 'seed', label: '随机种子', min: 0, step: 1, default: 1101 },
      { kind: 'list', key: 'referenceImages', label: '参考图', max: 16, placeholder: '每行一个图片地址' },
    ],
  },
  {
    type: 'aiTextNode',
    label: NODE_LABELS.aiTextNode,
    shortLabel: 'AI 文本',
    icon: 'text',
    category: 'generate',
    description: '模型 / 系统提示词 / 温度 / max_tokens / 续写',
    size: { width: 280, height: 292 },
    tone: 'info',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      { kind: 'select', key: 'model', label: '模型', default: 'deepseek-v4-flash', options: LLM_OPTIONS },
      { kind: 'textarea', key: 'systemPrompt', label: '系统提示词', rows: 2, placeholder: '设定角色与输出格式…' },
      { kind: 'textarea', key: 'prompt', label: '提示词', rows: 3, placeholder: '要生成的内容…' },
      { kind: 'range', key: 'temperature', label: '温度', min: 0, max: 2, step: 0.1, default: 0.7 },
      { kind: 'number', key: 'maxTokens', label: 'max_tokens', min: 1, max: 32000, step: 128, default: 2048 },
      { kind: 'switch', key: 'continueWriting', label: '续写（接上文）', default: false },
      { kind: 'switch', key: 'stream', label: '流式输出', default: true },
    ],
  },

  /* -------------------------------- 3 音色 ------------------------------- */
  {
    type: 'aiVoiceGenerationNode',
    label: NODE_LABELS.aiVoiceGenerationNode,
    shortLabel: 'AI 音色',
    icon: 'audio',
    category: 'generate',
    description: '音色名 + 提示词 → 音频 → 收入音色资产库',
    size: { width: 260, height: 268 },
    tone: 'ok',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      { kind: 'input', key: 'voiceName', label: '音色名', placeholder: '例如：少年·清亮' },
      { kind: 'textarea', key: 'voicePrompt', label: '音色提示词', rows: 3, placeholder: '年龄 / 性别 / 音质 / 情绪…' },
      { kind: 'textarea', key: 'text', label: '台词', rows: 2, placeholder: '要朗读的文本…' },
      {
        kind: 'select',
        key: 'engine',
        label: '引擎',
        default: 'indextts',
        options: [
          { value: 'indextts', label: 'IndexTTS（本地）' },
          { value: 'jimeng', label: '即梦音色' },
        ],
      },
      { kind: 'range', key: 'speed', label: '语速', min: 0.5, max: 2, step: 0.05, default: 1 },
    ],
  },
  {
    type: 'extractVoiceNode',
    label: NODE_LABELS.extractVoiceNode,
    shortLabel: '提取音色',
    icon: 'audio',
    category: 'extract',
    description: '剧本文本 → 角色 + 音色描述，可绑定已有音频',
    size: { width: 268, height: 262 },
    tone: 'ok',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      { kind: 'textarea', key: 'script', label: '剧本', rows: 4, placeholder: '粘贴剧本文本…' },
      { kind: 'select', key: 'model', label: '抽取模型', default: 'deepseek-v4-flash', options: LLM_OPTIONS },
      { kind: 'switch', key: 'bindExistingAudio', label: '允许绑定已有音频', default: false },
      { kind: 'switch', key: 'autoAddToAssets', label: '自动加入音色资产库', default: true },
    ],
  },

  /* ----------------------------- 4 结构化提取 ---------------------------- */
  {
    type: 'extractCharacterNode',
    label: NODE_LABELS.extractCharacterNode,
    shortLabel: '角色',
    icon: 'assets',
    category: 'extract',
    description: '文本 → 结构化角色条目，可全部加入资产库 / 全部生成到画布',
    size: { width: 268, height: 252 },
    tone: 'accent',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      { kind: 'textarea', key: 'script', label: '剧本', rows: 4, placeholder: '粘贴剧本文本…' },
      { kind: 'select', key: 'model', label: '抽取模型', default: 'deepseek-v4-flash', options: LLM_OPTIONS },
      { kind: 'switch', key: 'autoAddToAssets', label: '全部添加到资产库', default: true },
      { kind: 'switch', key: 'autoGenerateToCanvas', label: '全部生成到画布', default: false },
      { kind: 'input', key: 'styleHint', label: '风格提示', placeholder: '例如：国风水墨' },
    ],
  },
  {
    type: 'extractSceneNode',
    label: NODE_LABELS.extractSceneNode,
    shortLabel: '场景',
    icon: 'layers',
    category: 'extract',
    description: '文本 → 结构化场景条目，可全部加入资产库 / 全部生成到画布',
    size: { width: 268, height: 252 },
    tone: 'info',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      { kind: 'textarea', key: 'script', label: '剧本', rows: 4, placeholder: '粘贴剧本文本…' },
      { kind: 'select', key: 'model', label: '抽取模型', default: 'deepseek-v4-flash', options: LLM_OPTIONS },
      { kind: 'switch', key: 'autoAddToAssets', label: '全部添加到资产库', default: true },
      { kind: 'switch', key: 'autoGenerateToCanvas', label: '全部生成到画布', default: false },
      { kind: 'input', key: 'styleHint', label: '风格提示', placeholder: '例如：赛博霓虹' },
    ],
  },
  {
    type: 'extractItemNode',
    label: NODE_LABELS.extractItemNode,
    shortLabel: '道具',
    icon: 'cube',
    category: 'extract',
    description: '文本 → 结构化道具条目，可全部加入资产库 / 全部生成到画布',
    size: { width: 268, height: 252 },
    tone: 'warn',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      { kind: 'textarea', key: 'script', label: '剧本', rows: 4, placeholder: '粘贴剧本文本…' },
      { kind: 'select', key: 'model', label: '抽取模型', default: 'deepseek-v4-flash', options: LLM_OPTIONS },
      { kind: 'switch', key: 'autoAddToAssets', label: '全部添加到资产库', default: true },
      { kind: 'switch', key: 'autoGenerateToCanvas', label: '全部生成到画布', default: false },
      { kind: 'input', key: 'styleHint', label: '风格提示', placeholder: '例如：做旧金属' },
    ],
  },

  /* -------------------------------- 5 结果 ------------------------------- */
  {
    type: 'exportImageNode',
    label: NODE_LABELS.exportImageNode,
    shortLabel: '结果图',
    icon: 'image',
    category: 'result',
    description: '结果回流 / 下载 / 去水印',
    size: { width: 248, height: 226 },
    tone: 'neutral',
    capabilities: { preview: true },
    fields: [
      { kind: 'select', key: 'resultKind', label: '结果类型', default: 'generic', options: RESULT_KIND_OPTIONS },
      { kind: 'switch', key: 'removeWatermark', label: '去水印', default: false },
      { kind: 'switch', key: 'autoDownload', label: '生成后自动下载', default: false },
    ],
  },
  {
    type: 'exportVideoNode',
    label: NODE_LABELS.exportVideoNode,
    shortLabel: '结果视频',
    icon: 'video',
    category: 'result',
    description: '显示任务 ID / 等待中 / 尾帧，可在总导演台中打开',
    size: { width: 248, height: 240 },
    tone: 'neutral',
    capabilities: { preview: true },
    fields: [
      { kind: 'select', key: 'resultKind', label: '结果类型', default: 'videoGeneratorOutput', options: RESULT_KIND_OPTIONS },
      { kind: 'switch', key: 'keepLastFrame', label: '保留尾帧（供下一镜继承）', default: true },
      { kind: 'switch', key: 'openInDirector', label: '完成后在总导演台打开', default: false },
    ],
  },

  /* ------------------------------ 6 画布辅助 ----------------------------- */
  {
    type: 'textAnnotationNode',
    label: NODE_LABELS.textAnnotationNode,
    shortLabel: '注释',
    icon: 'file',
    category: 'structure',
    description: 'Markdown 文本注释，不参与连线',
    size: { width: 240, height: 168 },
    tone: 'neutral',
    fields: [
      {
        kind: 'textarea',
        key: 'markdown',
        label: 'Markdown',
        rows: 5,
        placeholder: '# 标题\n- 要点',
      },
      {
        kind: 'select',
        key: 'align',
        label: '对齐',
        default: 'left',
        options: [
          { value: 'left', label: '左对齐' },
          { value: 'center', label: '居中' },
        ],
      },
    ],
  },
  {
    type: 'groupNode',
    label: NODE_LABELS.groupNode,
    shortLabel: '分组',
    icon: 'grid',
    category: 'structure',
    description: '把若干节点圈成一组（Ctrl+G），可改颜色与尺寸',
    size: { width: 420, height: 280 },
    resizable: true,
    tone: 'neutral',
    fields: [
      { kind: 'input', key: 'groupName', label: '组名', placeholder: '例如：第一场' },
      {
        kind: 'select',
        key: 'tone',
        label: '颜色',
        default: 'neutral',
        options: [
          { value: 'accent', label: '强调' },
          { value: 'ok', label: '绿' },
          { value: 'warn', label: '黄' },
          { value: 'danger', label: '红' },
          { value: 'info', label: '青' },
          { value: 'neutral', label: '中性' },
        ],
      },
      { kind: 'switch', key: 'collapsedBody', label: '收起内容', default: false },
    ],
  },

  /* -------------------------------- 7 分镜 ------------------------------- */
  {
    type: 'storyboardNode',
    label: NODE_LABELS.storyboardNode,
    shortLabel: '切割结果',
    icon: 'grid',
    category: 'storyboard',
    description: '分镜切割：导出分镜 / 合并 / 单格编辑 / 网格导出设置',
    size: { width: 280, height: 320 },
    tone: 'warn',
    capabilities: { preview: true },
    fields: [
      { kind: 'number', key: 'rows', label: '行', min: 1, max: 12, step: 1, default: 2 },
      { kind: 'number', key: 'cols', label: '列', min: 1, max: 12, step: 1, default: 2 },
      {
        kind: 'select',
        key: 'exportBg',
        label: '导出背景',
        default: 'layer-1',
        options: [
          { value: 'layer-1', label: '浅层（主题色）' },
          { value: 'sunken', label: '下沉（主题色）' },
          { value: 'inverse', label: '反色' },
        ],
      },
      { kind: 'number', key: 'gap', label: '格间距', min: 0, max: 64, step: 1, default: 8, suffix: 'px' },
      { kind: 'number', key: 'labelSize', label: '序号字号', min: 8, max: 48, step: 1, default: 14, suffix: 'px' },
      {
        kind: 'select',
        key: 'labelPosition',
        label: '描述位置',
        default: 'bottom',
        options: [
          { value: 'top', label: '上方' },
          { value: 'bottom', label: '下方' },
          { value: 'none', label: '不显示' },
        ],
      },
      {
        kind: 'select',
        key: 'imageFill',
        label: '图片填充',
        default: 'contain',
        options: [
          { value: 'contain', label: '完整显示' },
          { value: 'cover', label: '填满裁切' },
          { value: 'stretch', label: '拉伸' },
        ],
      },
    ],
  },
  {
    type: 'storyboardGenNode',
    label: NODE_LABELS.storyboardGenNode,
    shortLabel: '分镜生成',
    icon: 'grid',
    category: 'storyboard',
    description: '按行 × 列生成分镜网格（单格 / 整体比例可分别指定）',
    size: { width: 276, height: 320 },
    tone: 'accent',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      { kind: 'textarea', key: 'prompt', label: '分镜提示词', rows: 3, placeholder: '整体画面与镜头节奏…' },
      { kind: 'number', key: 'rows', label: '行数', min: 1, max: 8, step: 1, default: 2 },
      { kind: 'number', key: 'cols', label: '列数', min: 1, max: 8, step: 1, default: 3 },
      {
        kind: 'select',
        key: 'cellAspect',
        label: '单格比例',
        default: '16:9',
        options: ASPECT_OPTIONS,
      },
      {
        kind: 'select',
        key: 'sheetAspect',
        label: '整体比例',
        default: '16:9',
        options: ASPECT_OPTIONS,
      },
      {
        kind: 'select',
        key: 'model',
        label: '模型',
        default: 'luoshu-comfy/qwen-t2i',
        options: [
          { value: 'luoshu-comfy/qwen-t2i', label: 'Qwen Image 2.1 文生图' },
          { value: 'luoshu/nano-banana-2', label: 'Nano Banana 2' },
        ],
      },
    ],
  },

  /* ---------------------- 8 视频（本任务最复杂的节点） --------------------- */
  {
    type: 'videoGeneratorNode',
    label: NODE_LABELS.videoGeneratorNode,
    shortLabel: 'AI 视频',
    icon: 'video',
    category: 'generate',
    description: '多模型参数面板：首帧/尾帧/参考图、五段流（1~5 段）、总步数/一采步数、动作 LoRA 强度',
    size: { width: 320, height: 620 },
    tone: 'warn',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      /* --- 后端 / 模型 --- */
      {
        kind: 'select',
        key: 'backend',
        label: '后端',
        default: 'h3-local',
        options: [
          { value: 'h3-local', label: 'H3 本地（ComfyUI）' },
          { value: 'seedance-cloud', label: 'Seedance 云端' },
        ],
      },
      {
        kind: 'select',
        key: 'model',
        label: '模型档位',
        default: 'h3:T2V',
        options: VIDEO_MODEL_OPTIONS,
        hint: 'H3 共 19 档（含 5SEG 五段流）；切换后端时自动挑对应档位',
      },
      /* --- 模式 / 画面 --- */
      {
        kind: 'select',
        key: 'mode',
        label: '生成模式',
        default: 't2v',
        options: [
          { value: 't2v', label: '文生视频（T2V）' },
          { value: 'i2v', label: '图生视频（I2V，需首帧）' },
          { value: 'fl2v', label: '首尾帧（FL2V，需首帧+尾帧）' },
          { value: 'ref', label: '全能参考（参考图/视频）' },
          { value: '5seg', label: '五段流（5SEG）' },
        ],
      },
      { kind: 'select', key: 'aspectRatio', label: '画幅', default: '16:9', options: ASPECT_OPTIONS },
      { kind: 'select', key: 'profile', label: '生成档位', default: 'P24-quality', options: PROFILE_OPTIONS },
      { kind: 'number', key: 'durationSec', label: '时长', min: 1, max: 15, step: 1, default: 5, suffix: '秒' },
      /* --- 首尾帧 / 参考 --- */
      { kind: 'input', key: 'firstFrameUrl', label: '首帧地址', mono: true, placeholder: '连线优先；也可直接填图片地址' },
      { kind: 'input', key: 'lastFrameUrl', label: '尾帧地址', mono: true, placeholder: '连线优先；也可直接填图片地址' },
      { kind: 'list', key: 'referenceImages', label: '参考图', max: 9, placeholder: '每行一个图片地址（≤9）' },
      { kind: 'list', key: 'referenceVideos', label: '参考视频', max: 3, placeholder: '每行一个视频地址' },
      /* --- 五段流 --- */
      {
        kind: 'segments',
        key: 'segments',
        label: '五段流分段',
        min: 1,
        max: 5,
        default: DEFAULT_VIDEO_SEGMENTS,
        hint: '段数 = 镜头数（1~5），每段可有独立提示词与起点图；段间尾接头',
      },
      /* --- 采样 / 动作 --- */
      { kind: 'number', key: 'steps', label: '总步数', min: 1, max: 100, step: 1, default: 4 },
      { kind: 'number', key: 'firstPassSteps', label: '一采步数', min: 1, max: 100, step: 1, default: 4 },
      {
        kind: 'range',
        key: 'motionLoraStrength',
        label: '动作 LoRA 强度',
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      { kind: 'input', key: 'positivePrompt', label: '正向提示词', placeholder: '动作/镜头/风格…' },
      { kind: 'input', key: 'negativePrompt', label: '反向提示词', placeholder: '避免的元素…' },
      { kind: 'switch', key: 'generateAudio', label: '生成音频', default: true },
      { kind: 'switch', key: 'returnLastFrame', label: '返回尾帧', default: true },
      { kind: 'switch', key: 'freeVramBeforeRun', label: '生成前释放显存', default: true },
      { kind: 'switch', key: 'watermark', label: '水印', default: false },
      { kind: 'number', key: 'seed', label: '种子', min: 0, step: 1, default: 1101 },
    ],
  },

  /* -------------------------------- 9 全景 ------------------------------- */
  {
    type: 'vr360PanoramaNode',
    label: NODE_LABELS.vr360PanoramaNode,
    shortLabel: '全景 A',
    icon: 'eye',
    category: 'panorama',
    description: '球面/柱面全景查看 + 3D 假人摆位、四向导出、截图',
    size: { width: 292, height: 300 },
    tone: 'accent',
    capabilities: { preview: true },
    fields: [
      {
        kind: 'select',
        key: 'projection',
        label: '投影',
        default: 'sphere',
        options: [
          { value: 'sphere', label: '球面' },
          { value: 'cylinder', label: '柱面' },
        ],
      },
      { kind: 'switch', key: 'showFigure', label: '显示 3D 假人', default: true },
      { kind: 'switch', key: 'autoRotate', label: '自动旋转', default: false },
      { kind: 'number', key: 'fov', label: '视场角', min: 30, max: 120, step: 1, default: 75, suffix: '°' },
      {
        kind: 'select',
        key: 'exportDirection',
        label: '导出方向',
        default: 'front',
        options: [
          { value: 'front', label: '前' },
          { value: 'back', label: '后' },
          { value: 'left', label: '左' },
          { value: 'right', label: '右' },
        ],
      },
    ],
  },
  {
    type: 'panoramaViewerBNode',
    label: NODE_LABELS.panoramaViewerBNode,
    shortLabel: '全景 B',
    icon: 'eye',
    category: 'panorama',
    description: '只读查看器：前/后/左/右四视图导出、截图',
    size: { width: 276, height: 268 },
    tone: 'info',
    capabilities: { preview: true },
    fields: [
      {
        kind: 'select',
        key: 'projection',
        label: '投影',
        default: 'sphere',
        options: [
          { value: 'sphere', label: '球面' },
          { value: 'cylinder', label: '柱面' },
        ],
      },
      { kind: 'switch', key: 'locked', label: '锁定视角（只读）', default: true },
      { kind: 'number', key: 'fov', label: '视场角', min: 30, max: 120, step: 1, default: 75, suffix: '°' },
      { kind: 'switch', key: 'autoDownloadViews', label: '导出后自动下载', default: false },
    ],
  },
  {
    type: 'panoramaNode',
    label: NODE_LABELS.panoramaNode,
    shortLabel: '全景生成',
    icon: 'eye',
    category: 'panorama',
    description: '全景图生成：relay 后台管理 / 内置兜底两套模板',
    size: { width: 276, height: 288 },
    tone: 'accent',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      {
        kind: 'select',
        key: 'template',
        label: '模板',
        default: 'builtin',
        options: [
          { value: 'relay', label: 'relay 后台管理' },
          { value: 'builtin', label: '内置兜底' },
        ],
      },
      { kind: 'textarea', key: 'prompt', label: '提示词', rows: 3, placeholder: '场景描述（将铺满 360°）…' },
      {
        kind: 'select',
        key: 'model',
        label: '模型',
        default: 'luoshu-comfy/qwen-t2i',
        options: [
          { value: 'luoshu-comfy/qwen-t2i', label: 'Qwen Image 2.1 文生图' },
          { value: 'relay/panorama', label: 'relay 全景通道' },
        ],
      },
    ],
  },

  /* ---------------------------- 10 剧集 / 音乐 --------------------------- */
  {
    type: 'episodeSubCanvasNode',
    label: NODE_LABELS.episodeSubCanvasNode,
    shortLabel: '剧集画布',
    icon: 'canvas',
    category: 'storyboard',
    description: '镜头表：批量通过/退回/提交、Seedance 串行生成、尾帧继承、分镜板',
    size: { width: 300, height: 320 },
    tone: 'accent',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      { kind: 'number', key: 'episode', label: '集号', min: 1, max: 60, step: 1, default: 1 },
      { kind: 'switch', key: 'serialGenerate', label: '串行生成（Seedance）', default: true },
      { kind: 'switch', key: 'inheritLastFrame', label: '尾帧继承', default: true },
      { kind: 'switch', key: 'autoSubmit', label: '完成后自动提交下一镜', default: false },
      {
        kind: 'select',
        key: 'boardView',
        label: '视图',
        default: 'table',
        options: [
          { value: 'table', label: '镜头表' },
          { value: 'board', label: '分镜板' },
        ],
      },
    ],
  },
  {
    type: 'backgroundMusicNode',
    label: NODE_LABELS.backgroundMusicNode,
    shortLabel: '背景音乐',
    icon: 'audio',
    category: 'generate',
    description: 'Suno 生成：提示词自动生成 → 任务 → 下载音频',
    size: { width: 268, height: 276 },
    tone: 'ok',
    capabilities: { generative: true, preview: true, needsBackend: true },
    fields: [
      { kind: 'switch', key: 'autoPrompt', label: '由剧本自动生成音乐提示词', default: true },
      { kind: 'textarea', key: 'prompt', label: '音乐提示词', rows: 3, placeholder: '情绪 / 乐器 / 节奏…' },
      { kind: 'input', key: 'style', label: '风格', placeholder: '例如：国风弦乐' },
      { kind: 'number', key: 'durationSec', label: '时长', min: 5, max: 300, step: 5, default: 60, suffix: '秒' },
    ],
  },

  /* ------------------------------- 11 3D 工作台 -------------------------- */
  {
    type: 'blueprintNode',
    label: NODE_LABELS.blueprintNode,
    shortLabel: '导演台',
    icon: 'cube',
    category: 'studio',
    description: '内嵌 3D 站位 / 机位 / 灯光（BlueprintScene）',
    size: { width: 320, height: 340 },
    tone: 'info',
    capabilities: { preview: true, needsBackend: true },
    fields: [
      { kind: 'input', key: 'sceneId', label: '场景 ID', mono: true, placeholder: '例如：sc-1' },
      {
        kind: 'select',
        key: 'camera',
        label: '机位',
        default: 'cam-main',
        options: [
          { value: 'cam-main', label: '主机位' },
          { value: 'cam-over', label: '过肩' },
          { value: 'cam-top', label: '俯拍' },
          { value: 'cam-side', label: '横移' },
        ],
      },
      {
        kind: 'select',
        key: 'lighting',
        label: '灯光',
        default: 'day',
        options: [
          { value: 'day', label: '日景' },
          { value: 'night', label: '夜景' },
          { value: 'dusk', label: '黄昏' },
          { value: 'studio', label: '棚拍' },
        ],
      },
      { kind: 'switch', key: 'showGrid', label: '显示网格', default: true },
      { kind: 'switch', key: 'showFigures', label: '显示人物摆位', default: true },
    ],
  },
  {
    type: 'previzNode',
    label: NODE_LABELS.previzNode,
    shortLabel: '白模预演',
    icon: 'play',
    category: 'studio',
    description: '场景 JSON → 6 种模式导出（导演台/场记/关键帧/站位/宫格/接缝），mp4 需 WebCodecs',
    size: { width: 300, height: 356 },
    tone: 'info',
    capabilities: { preview: true, needsBackend: true },
    fields: [
      {
        kind: 'select',
        key: 'mode',
        label: '导出模式',
        default: 'director',
        options: [
          { value: 'director', label: '导演台' },
          { value: 'script', label: '场记' },
          { value: 'keyframe', label: '关键帧' },
          { value: 'blocking', label: '站位' },
          { value: 'grid', label: '宫格' },
          { value: 'seam', label: '接缝' },
        ],
      },
      { kind: 'textarea', key: 'sceneJson', label: '场景 JSON', rows: 3, mono: true, placeholder: '{ "scenes": [...] }' },
      { kind: 'number', key: 'fps', label: '帧率', min: 1, max: 60, step: 1, default: 24, suffix: 'fps' },
      {
        kind: 'select',
        key: 'resolution',
        label: '分辨率',
        default: '1280x720',
        options: [
          { value: '960x544', label: '960 × 544' },
          { value: '1056x608', label: '1056 × 608' },
          { value: '1280x720', label: '1280 × 720' },
        ],
      },
      { kind: 'switch', key: 'exportVideo', label: '导出 mp4（需 WebCodecs）', default: false },
    ],
  },
  {
    type: 'poseStudioNode',
    label: NODE_LABELS.poseStudioNode,
    shortLabel: '姿势台',
    icon: 'cube',
    category: 'studio',
    description: 'iframe 载入 freepose 编辑器，postMessage 注入 pose-studio-load',
    size: { width: 288, height: 300 },
    tone: 'info',
    capabilities: { preview: true, needsBackend: true },
    fields: [
      { kind: 'input', key: 'characterUrl', label: '角色图地址', mono: true, placeholder: '姿势台载入的角色图' },
      { kind: 'input', key: 'poseName', label: '姿势名', placeholder: '例如：抱拳' },
      { kind: 'switch', key: 'embedded', label: '内嵌模式', default: true },
      { kind: 'switch', key: 'autoLoad', label: '打开即载入', default: true },
    ],
  },
];

/* ========================================================================== */
/* 三、注册表导出                                                              */
/* ========================================================================== */

export const NODE_DEFINITIONS: ReadonlyArray<NodeDefinition> = DEFS;

/** 关键参数键名（视频节点用，避免组件里散落魔法字符串） */
export const VIDEO_SEGMENTS_KEY = 'segments';

/** type key → 定义 */
export const NODE_REGISTRY: Readonly<Record<NodeTypeKey, NodeDefinition>> = Object.freeze(
  DEFS.reduce<Record<string, NodeDefinition>>((acc, def) => {
    acc[def.type] = def;
    return acc;
  }, {}) as Record<NodeTypeKey, NodeDefinition>,
);

/** 取定义；未知 type 返回 undefined（调用方应回退到通用节点） */
export function getDefinition(type: string): NodeDefinition | undefined {
  return (NODE_REGISTRY as Record<string, NodeDefinition>)[type];
}

/** 节点默认标题（registry 优先，其次 nodeKeys，最后原样返回 type） */
export function nodeDefaultLabel(type: string): string {
  return getDefinition(type)?.label ?? NODE_LABELS[type as NodeTypeKey] ?? type;
}

/** 分组后的定义列表（调色板渲染顺序：按 NODE_CATEGORIES 分节） */
export function definitionsByCategory(): Array<{ category: NodeCategory; items: NodeDefinition[] }> {
  const order: NodeCategory[] = [
    'upload',
    'generate',
    'extract',
    'storyboard',
    'panorama',
    'studio',
    'result',
    'structure',
  ];
  const buckets = new Map<NodeCategory, NodeDefinition[]>();
  for (const c of order) buckets.set(c, []);
  for (const def of DEFS) {
    buckets.get(def.category)?.push(def);
  }
  return order
    .filter((c) => (buckets.get(c)?.length ?? 0) > 0)
    .map((category) => ({ category, items: buckets.get(category) ?? [] }));
}

/* ========================================================================== */
/* 四、默认值与校验                                                            */
/* ========================================================================== */

/** 从 ParamField[] 提取默认参数对象 */
export function defaultParams(def: NodeDefinition): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (field.default !== undefined) {
      out[field.key] = Array.isArray(field.default) ? [...field.default] : field.default;
    }
  }
  return out;
}

/** 新建节点用的默认 data */
export function defaultNodeData(type: string): Record<string, unknown> {
  const def = getDefinition(type);
  if (!def) return { status: 'idle', params: {} };
  return {
    status: 'idle',
    params: defaultParams(def),
  };
}

/** 参数默认值表（测试与"重置参数"用） */
export function defaultParamsFor(type: string): Record<string, unknown> {
  const def = getDefinition(type);
  return def ? defaultParams(def) : {};
}

/* ========================================================================== */
/* 六、参数查询辅助                                                            */
/* ========================================================================== */

/** 取枚举参数的选项（字段不是 select 时返回空数组，避免调用方重复写 kind 判断） */
export function selectOptionsOf(
  type: string,
  key: string,
): ReadonlyArray<{ value: string; label: string }> {
  const field = getDefinition(type)?.fields.find((f) => f.key === key);
  return field && field.kind === 'select' ? field.options : [];
}

/** 取枚举参数当前值的显示名 */
export function selectLabelOf(type: string, key: string, value: string): string {
  return selectOptionsOf(type, key).find((o) => o.value === value)?.label ?? value;
}

/**
 * 注册表自检 —— 启动时（开发态）与单测都会调用。
 * 返回问题列表，空数组表示一切一致。
 */
export function validateRegistry(): string[] {
  const problems: string[] = [];

  // 1) 26 个 type key 必须与 nodeKeys.NODE_TYPE_KEYS 完全一致
  const registryKeys = Object.keys(NODE_REGISTRY).sort();
  const expected = [...NODE_TYPE_KEYS].sort();
  if (registryKeys.length !== expected.length) {
    problems.push(`注册表条目数 ${registryKeys.length} ≠ 期望 ${expected.length}`);
  }
  for (const k of expected) {
    if (!registryKeys.includes(k)) problems.push(`注册表缺少节点定义：${k}`);
  }
  for (const k of registryKeys) {
    if (!expected.includes(k as NodeTypeKey)) problems.push(`注册表存在未知节点：${k}`);
  }

  // 2) 每个定义都必须有端口表（portTypes 与 registry 的 key 集合必须双向覆盖）
  for (const def of DEFS) {
    const ports: NodePortSpec = portsOf(def.type);
    const declared = ports.inputs.length + ports.outputs.length;
    const caps = def.capabilities ?? {};
    // 业务规则：有文件输入的节点必须有输出口；有 preview 的生成节点必须有输出口
    if (declared === 0 && caps.generative) {
      problems.push(`${def.type} 标记了 generative 却没有端口`);
    }
    // 端口 id 必须在节点内唯一
    const ids = [...ports.inputs, ...ports.outputs].map((p) => p.id);
    if (new Set(ids).size !== ids.length) {
      problems.push(`${def.type} 的端口 id 有重复`);
    }
    if (def.size.width <= 0 || def.size.height <= 0) {
      problems.push(`${def.type} 的默认尺寸非法`);
    }
    if (def.fields.length === 0 && def.category !== 'structure') {
      problems.push(`${def.type} 没有任何参数字段`);
    }
  }

  // 3) 字段 key 不得重复
  for (const def of DEFS) {
    const keys = def.fields.map((f) => f.key);
    if (new Set(keys).size !== keys.length) {
      problems.push(`${def.type} 的参数 key 有重复`);
    }
  }

  return problems;
}

/* ========================================================================== */
/* 五、节点样式辅助                                                            */
/* ========================================================================== */

/** tone → CSS 变量前缀（节点组件用它取色，禁止 hex） */
export function toneVar(tone: CanvasTone, part: 'text' | 'soft' | 'line'): string {
  switch (tone) {
    case 'accent':
      return `var(--jz-accent-${part === 'soft' ? 'soft' : part === 'line' ? 'line' : 'text'})`;
    case 'ok':
      return part === 'soft'
        ? 'color-mix(in srgb, var(--jz-ok) 18%, transparent)'
        : part === 'line'
          ? 'color-mix(in srgb, var(--jz-ok) 46%, transparent)'
          : 'var(--jz-ok-text)';
    case 'warn':
      return part === 'soft'
        ? 'color-mix(in srgb, var(--jz-warn) 18%, transparent)'
        : part === 'line'
          ? 'color-mix(in srgb, var(--jz-warn) 46%, transparent)'
          : 'var(--jz-warn-text)';
    case 'danger':
      return part === 'soft'
        ? 'color-mix(in srgb, var(--jz-danger) 18%, transparent)'
        : part === 'line'
          ? 'color-mix(in srgb, var(--jz-danger) 46%, transparent)'
          : 'var(--jz-danger-text)';
    case 'info':
      return part === 'soft'
        ? 'color-mix(in srgb, var(--jz-info) 20%, transparent)'
        : part === 'line'
          ? 'color-mix(in srgb, var(--jz-info) 48%, transparent)'
          : 'var(--jz-info-text)';
    case 'neutral':
    default:
      return part === 'soft'
        ? 'color-mix(in srgb, var(--jz-text-primary) 7%, transparent)'
        : part === 'line'
          ? 'var(--jz-border)'
          : 'var(--jz-text-secondary)';
  }
}

/** 参数面板分组：视频节点参数多，按功能区拆开渲染 */
export const VIDEO_PARAM_GROUPS: ReadonlyArray<{ title: string; keys: string[] }> = [
  { title: '后端 · 模型', keys: ['backend', 'model', 'mode', 'profile'] },
  { title: '画面 · 时长', keys: ['aspectRatio', 'durationSec', 'seed'] },
  { title: '首尾帧 · 参考', keys: ['firstFrameUrl', 'lastFrameUrl', 'referenceImages', 'referenceVideos'] },
  { title: '五段流', keys: ['segments'] },
  { title: '采样 · 动作', keys: ['steps', 'firstPassSteps', 'motionLoraStrength'] },
  { title: '提示词', keys: ['positivePrompt', 'negativePrompt'] },
  { title: '开关', keys: ['generateAudio', 'returnLastFrame', 'freeVramBeforeRun', 'watermark'] },
];

/** 取某节点的参数分组（未分组的字段统一进"其它"） */
export function paramGroupsFor(type: string): Array<{ title: string; fields: ParamField[] }> {
  const def = getDefinition(type);
  if (!def) return [];
  if (type !== 'videoGeneratorNode') return [{ title: '参数', fields: def.fields }];
  const used = new Set<string>();
  const groups: Array<{ title: string; fields: ParamField[] }> = [];
  for (const g of VIDEO_PARAM_GROUPS) {
    const fields = g.keys
      .map((k) => def.fields.find((f) => f.key === k))
      .filter((f): f is ParamField => Boolean(f));
    if (fields.length === 0) continue;
    for (const f of fields) used.add(f.key);
    groups.push({ title: g.title, fields });
  }
  const rest = def.fields.filter((f) => !used.has(f.key));
  if (rest.length > 0) groups.push({ title: '其它', fields: rest });
  return groups;
}

export type { NodeDefinition, ParamField } from './types';
export type { SparkIconName } from './types';
export { NODE_CATEGORIES, NODE_CATEGORY_LABELS } from './types';