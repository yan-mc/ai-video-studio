# 资产体系与角色卡 · 设计与实现

> 2026-11-11 · 覆盖：外挂资产包分类、上传资产库、角色卡
> 实测环境：DSH 0.2.2-rc.1 / 插件 12 工具 / 面板宽度 326—1200px

---

## 一、资产全景（两类，分开管理）

### 1.1 外部资产包（挂载，只读）

盘点了 `F:\AI视频\功能拆解` 全部拆解产物：**20,237 文件 / 3.97 GB**。

按可复用价值分类：

| 分类 | 数量 | 大小 | 说明 |
|---|---|---|---|
| `doc` | 1,029 | 205.3 MB | 拆解报告、说明文档 |
| `schema` | 1,402 | 163.0 MB | 节点定义 / 工具契约 / 模型目录 |
| **`3d-model`** | **748** | **74.7 MB** | **glb/gltf/fbx/obj —— 核心可复用资产** |
| `script` | 1,922 | 65.2 MB | 反编译源码（证据，非资产） |
| **`image`** | **3,447** | **19.8 MB** | 图标、贴图、UI 素材 |
| `vector` | 157 | 9.1 MB | SVG 图标 |
| `font` | 122 | 8.8 MB | 字体文件 |
| `scene-data` | 200 | 6.1 MB | `.pma` 预演场景/姿势数据 |
| `audio` | 3 | 2.4 MB | 示例音频 |
| `shader` | 21 | 0.1 MB | 着色器 |

**明确排除**：`.dll` 1.69 GB、`.exe` 0.52 GB、`.msi` 0.47 GB —— 这些是**软件本体**，不是资产。

### 1.2 已挂载的 5 个资产包

| 包 | 条目 | 类别 | 许可 |
|---|---|---|---|
| `previs-3d-cc0` | 572 | 3d | CC0-1.0（可分发） |
| `previs-asset-index` | 468 | 3d | forbidden（仅本地） |
| `node-schema-ref` | 191 | schema | forbidden |
| `enhance-schema-ref` | 870 | schema | forbidden |
| `test-pack` | 1 | template | MIT |

### 1.3 目录规划

```
F:\AI视频\
├── 资产包\                      ← 外挂包（已有 5 个，挂载只读）
└── 工作室\data\
    ├── assets\                  ← 【新增】上传资产库（可写）
    │   ├── index.json           ← 统一索引
    │   ├── image\               ← 图片
    │   ├── video\               ← 视频
    │   ├── audio\               ← 音频
    │   ├── model3d\             ← 3D 模型
    │   ├── font\                ← 字体
    │   ├── doc\                 ← 文档
    │   └── other\
    └── characters\              ← 【新增】角色卡
        └── <charId>\
            ├── card.json
            └── refs\            ← 参考图/音频/视频
```

**为什么分开**：外挂包是**只读证据**（不可改、不可分发），上传库是**工作素材**（可增删）。混在一起会导致许可边界模糊。

---

## 二、上传资产库

### 2.1 支持的模态

| kind | 扩展名 |
|---|---|
| `image` | png / jpg / jpeg / webp / bmp / gif / tga |
| `video` | mp4 / webm / mov / mkv / avi |
| `audio` | mp3 / wav / ogg / flac / m4a / aac |
| `model3d` | glb / gltf / fbx / obj / dae / stl / ply |
| `font` | ttf / otf / woff / woff2 |
| `doc` | txt / md / json / csv / yaml |
| `other` | 兜底 |

### 2.2 上传接口

**两种方式都支持：**

**A. multipart/form-data（推荐，浏览器 UI 用）**
```
POST /ai-video-studio/api/assets/upload
Content-Type: multipart/form-data

字段：
  file     文件（可多个）
  kind     可选，省略则按扩展名推断
  name     可选
  tag      可选，便于检索
  note     可选
```

**B. raw body（脚本用）**
```
POST /ai-video-studio/api/assets/upload?name=a.png&kind=image&tag=test
Content-Type: application/octet-stream

<二进制数据>
```

**上限**：单次 512 MB。

### 2.3 其它接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/assets/items?kind=&q=` | 列出资产（可按类别/关键词过滤） |
| GET | `/assets/item?id=` | 取资产文件（静态服务，带正确 Content-Type） |
| POST | `/assets/delete` | 删除资产（`{id}`） |

### 2.4 索引结构

`data/assets/index.json`：
```json
{
  "version": 1,
  "items": [{
    "id": "asset_mwavxo1gatmov",
    "kind": "image",
    "name": "first.png",
    "rel": "image/asset_mwavxo1gatmov.png",
    "bytes": 56640,
    "ext": ".png",
    "mime": "image/png",
    "tag": "test-upload",
    "note": "",
    "source": "upload",
    "createdAt": 1794326945524
  }]
}
```

---

## 三、角色卡

### 3.1 概念

把「一个角色的全部可复用信息」打包：

| 字段 | 作用 |
|---|---|
| `name` | 角色名 |
| `appearance` | 外观描述（**最关键**，会拼进 H3 提示词） |
| `style` | 画风（如 `anime cel-shaded, consistent flat colors`） |
| `seedPrompt` | 附加提示词（光线/景深等） |
| `refs[]` | 参考素材（图/视频/音频，R2V 用） |

### 3.2 为什么重要（实测教训）

做 Ave Mujica 测试时发现：**H3 不认识角色名**。

| 提示词写法 | 结果 |
|---|---|
| `Sakiko Togawa, blue hair flowing` | ❌ 角色全跑偏（黑发/红裙的路人） |
| `slim anime girl with very long pale blue hair, black hair ribbon, black dress with white frilled sleeves, black gloves` | ✅ 正确还原 |

角色卡的核心价值就是：**把验证过有效的外观描述固化下来，每次自动拼进提示词**。

### 3.3 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/characters` | 列出所有角色卡 |
| GET | `/characters/get?id=` | 取单个 |
| POST | `/characters/save` | 保存（`{card}`） |
| POST | `/characters/delete` | 删除（`{id}`） |
| POST | `/characters/ref` | 上传参考素材（multipart，字段 `id` + `file`） |
| GET | `/characters/expand?id=` | **展开成可注入形态** |
| GET | `/characters/asset?id=&rel=` | 取参考素材文件 |

### 3.4 展开（关键能力）

`GET /characters/expand?id=xxx` 返回：
```json
{
  "id": "char_xxx",
  "name": "祥子",
  "prompt": "slim anime girl with very long pale blue hair, ...",
  "style": "anime cel-shaded, consistent flat colors",
  "seedPrompt": "cinematic lighting",
  "images": ["F:\\...\\refs\\ref_xxx.png"],
  "videos": [],
  "audios": []
}
```

用途：
- `prompt` → 拼进 `shot.description`
- `style` → 拼进 `shot.style`
- `images` → 挂到 `shot.refs.images`（生成时自动复制到 ComfyUI input）

### 3.5 UI 操作流

1. 资产包页 → 「角色卡」子页签
2. 点「新建角色」→ 填名称/外观描述/画风
3. 「保存角色卡」→ 得到 id
4. 「添加参考素材」→ 上传立绘
5. 选镜头 → 点「应用到当前镜头」→ 自动写入 shot 的 style/description/refs

---

## 四、UI 结构

资产包页签现在是**三个子页签**：

| 子页签 | 内容 |
|---|---|
| **资产库（上传）** | 网格卡片、按 kind 过滤、上传/打开/用作参考/删除 |
| **资产包（外挂）** | 挂载/卸载/校验（原有功能） |
| **角色卡** | 卡片列表 + 编辑器 + 素材条 |

---

## 五、实测结果

### 5.1 后端

| 项 | 结果 |
|---|---|
| 图片上传 | ✅ 56,640 B，multipart 解析正确 |
| 视频上传 | ✅ 4,181 KB |
| 音频上传 | ✅ 946 KB |
| 3D 模型上传 | ✅ 453 KB（robot-expressive.glb） |
| 字体上传 | ✅ 78 KB（CanvaSans-Bold.otf） |
| kind 过滤 | ✅ image/video/audio/model3d/font 各 1 |
| 静态服务 | ✅ 200 image/png 56,640 B |
| 角色卡创建 | ✅ `char_mwavyd8pizys3` |
| 参考素材上传 | ✅ 1 个 |
| 展开 | ✅ prompt + images 绝对路径正确 |

### 5.2 UI（harness 真实浏览器，1100px）

| 子页签 | 渲染结果 |
|---|---|
| 资产库 | 5 张卡片、7 个 kind 过滤 chip、1 张缩略图正常加载 |
| 资产包 | 5 个挂载包列出 |
| 角色卡 | 1 张角色卡、含头像 |

**0 异常**。

---

## 六、已知限制

| 限制 | 说明 |
|---|---|
| 资产去重 | 同名文件不自动去重（按 id 存，不覆盖） |
| 缩略图 | 只有 image 类型有真实缩略图；视频/模型显示类型文字 |
| 3D 预览 | 无模型预览器（需要 three.js 加载器，当前引擎不支持 glb） |
| 角色卡引用 | 参考图目前以绝对路径挂到 shot.refs，未走资产包引用体系 |
| `asset:` 引用 | `attachAssetToShot` 写入 `asset:<id>` token，但生成侧尚未解析（见下一步） |
