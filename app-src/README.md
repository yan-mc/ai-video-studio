# 九章工作室 · SPA（app-src）

浏览器端 SPA：**Vite 5 + React 18.3.1 + TypeScript（strict）+ Zustand**。
由 DSH Host 插件 `dsh-jiuzhang-studio` 以 `/jiuzhang/app` 前缀同源服务。

## 命令

> `node`/`npm` 不在系统 PATH 时，使用捆绑运行时：
> `<你的 Node 路径>\node.exe` 与同级 `npm.cmd`。

```powershell
$env:Path = '<你的 Node 目录>;' + $env:Path
npm install
npm run build      # tsc --noEmit && vite build → ../dsh-jiuzhang-studio/app-dist
npm run dev        # 开发服务器（含 /jiuzhang/api 代理；端口取 $env:DSH_PORT，默认 7983）
npm run typecheck
```

构建产物直接落到 **`../dsh-jiuzhang-studio/app-dist/`**（`index.html` + `assets/`），
Host 的 `serveSpa` 从这里读，无需二次拷贝。

## 关键约定

| 事项 | 约定 |
| --- | --- |
| `base` | `'./'` —— SPA 挂在 `/jiuzhang/app` 且 Host 端口随机，绝对路径会坏 |
| 路由 | **hash 路由**（`#/canvas` `#/assets` `#/projects` `#/h3` `#/settings` `#/jobs`），不用 React Router |
| API base | `/jiuzhang/api` 相对路径（同源自动适配端口） |
| 写鉴权 | `POST/PUT/PATCH/DELETE` 自动带 `X-JZ-Token`（从 `GET /token` 取一次并缓存） |
| 文案 | 全部中文，集中在 `src/i18n/zh.ts` |
| 颜色 | 只允许用 `var(--jz-*)`，令牌全在 `src/ui/tokens.css` |

## 目录

```
src/
├─ main.tsx             入口（挂样式 + StrictMode）
├─ App.tsx              应用外壳：顶栏 / 侧导航 / 路由出口
├─ router.tsx           hash 路由解析与订阅
├─ api/
│  ├─ client.ts         fetch 封装 + token 管理 + 错误归一
│  └─ types.ts          与 host/api/index.js 契约对齐的类型
├─ store/
│  ├─ project.ts        元信息 / 配置 / 项目 / 资产
│  ├─ ui.ts             侧栏 / 监测器 / H3 草稿
│  └─ jobs.ts           任务列表与轮询
├─ ui/                  设计系统（令牌 + 基础组件）
├─ pages/               六个路由页
├─ canvas/CanvasArea.tsx 画布挂载点（当前为占位，由画布实现覆盖）
└─ i18n/zh.ts           界面文案
```

## 设计系统

- 双主题：**墨夜**（`data-theme="inknight"`，默认，基色 `#111316`）/ **宣纸**（`data-theme="xuanpaper"`）
- 四强调色：**朱砂** `#C8564A` / **黛青** `#3E5C6B` / **鎏金** `#B8912F` / **松绿** `#4A6B52`
- 通过 `<html>` 上的 `data-theme` / `data-accent` / `data-density` 驱动 CSS 变量，
  组件不感知主题；切换与持久化在 `src/ui/theme.tsx`（localStorage 键 `jz.appearance.v1`）。
- 每种强调色提供 `--jz-accent` / `--jz-accent-hover` / `--jz-accent-text` / `--jz-accent-soft` /
  `--jz-accent-line` / `--jz-on-accent` 六档，深浅主题各一套对比度修正。

## 画布挂载契约

`App.tsx` 只依赖：

```tsx
import CanvasArea from './canvas/CanvasArea';
<CanvasArea />
```

默认导出、零必需 props、自身铺满父容器。画布实现替换该文件即可，无需改外壳。