# HTTP API（`--http` 模式）与 MCP stdio 协议细节

实现位置：`artifacts/recovered/app_director_engine_module.js` 中 `VR(service, port)` / `K1()` / `wR()` / `bl()`；入口在 `artifacts/recovered/app_server_entry_module.js` 末尾。

## 0. 启动与监听

```
<闭源预演引擎可执行文件>.exe                     # 默认：MCP stdio（JSON-RPC over stdin/stdout）
<闭源预演引擎可执行文件>.exe --http             # HTTP 模式，端口缺省 4318
<闭源预演引擎可执行文件>.exe --http 4319        # HTTP 模式，端口 4319（Lead 实测）
```

- 监听地址：`process.env.PREVIZ_HOST ?? "127.0.0.1"`（环境变量名为既有运行时兼容标识符，保留原样）；端口：argv 中 `--http` 后的正整数，否则 4318。
- 启动后向 **stderr** 打印一行：`<闭源商业软件> AI Director stage: http://<host>:<port>\n`（`0.0.0.0` 时打印 `localhost`）。
- 由 Node 内置 `http.createServer` 承载（Bun 的 Node 兼容层）。

## 1. 通用约定（观察）

| 项 | 值 |
| --- | --- |
| 响应 Content-Type | `application/json; charset=utf-8` |
| Cache-Control（API） | `no-store` |
| CORS | 所有 JSON 响应带 `Access-Control-Allow-Origin: http://127.0.0.1:5173`、`Access-Control-Allow-Headers: Content-Type`（前端 dev Vite 源，写死） |
| OPTIONS | 204，允许 `GET, POST, DELETE, OPTIONS` |
| 请求体上限 | 2,000,000 B（超出抛 `Request body exceeds 2MB`） |
| 错误响应 | HTTP 400 + `{ok:false, error:"<message>"}`；未知路由 404 + `{ok:false, error:"Not found"}` |
| 鉴权 | 无（仅回环地址；`PREVIZ_HOST` 环境变量可改为 0.0.0.0，风险见 FEATURES §11；该变量名为运行时兼容标识符，保留原样） |

## 2. 路由

### GET `/api/health`
```json
{"ok":true,"service":"previs-engine","transport":"http"}
```
（Lead 动态实测返回完全一致；用于主程序就绪轮询 `http://127.0.0.1:4318/api/health`。）

### GET `/api/project`
直接返回 `director_get_state` 的完整 State（**裸对象**，不是 `{ok,result}` 包装）：
```js
{ project, runtime, catalog, health, agent_rules }
```
（Lead 实测 17,885 B State；`analysis\dynamic\director-probe\api-project.json`。）

### POST `/api/command`
请求：
```json
{"name":"director_get_state","arguments":{}}
```
响应：
```json
{"ok":true,"result": <State>}
```
- `name` 必须是字符串，否则 400 `"Command name is required"`；
- `arguments` 缺省 `{}`；未知命令 → `Unknown Director command: <name>`（400）；
- 命令成功/失败语义与 MCP 工具一致（失败 400 + error message）。
（Lead 实测 `POST /api/command {"name":"director_get_state","arguments":{}}` → 17,906 B `{ok,result}`；`analysis\dynamic\director-probe\api-command-getstate.json`。）

### POST `/api/agent/chat`
请求：
```json
{"messages":[{"role":"user","content":"…"},{"role":"assistant","content":"…"}]}
```
- `messages` 必须为非空数组，否则 400 `"对话消息不能为空"`；
- 只接受 `role ∈ {user, assistant}` 且 `content` 为字符串，否则 400 `"对话消息格式无效"`；
- 服务端只取**最后 12 条**，每条 `content.slice(0, 6000)`。
响应：
```json
{"ok":true,"result":{"message":"<中文回复>","commands":[{"name":"director_apply_action","ok":true}],"state": <State>}}
```
失败（如未配置 DeepSeek key 且找不到 Codex CLI）→ 400 `{ok:false,error:"未找到 Codex CLI。请先安装或打开 Codex 桌面版。"}`；前端展示 `导演助手暂时不可用`。
（本任务未触发该路由；Lead 动态探测也未调用 agent_chat——静态证据。）

### 其它 GET（静态文件托管）
- 根目录：`process.env.PREVIZ_WEB_ROOT`（环境变量名为运行时兼容标识符，保留原样），否则 `<模块目录>/web`（编译态为 `B:/~BUN/root/web`；安装包实际由主程序设置到 `resources\` 下的导演台前端目录）。
- 若根目录不存在：API 路由仍工作，静态请求返回 404。
- 路径：`decodeURIComponent(pathname)` → `normalize` → 去前导 `../` → `join(root, …)`，且 **必须仍以 root 为前缀**；`/` → `index.html`；文件不存在时 SPA fallback 到 `index.html`（该页存在才返回）。
- MIME：`.css/.html/.js/.json/.map/.png/.svg`；其余 `application/octet-stream`。
- 缓存：`index.html` → `no-cache`；其它 → `public, max-age=3600`。
- 实现：`fs.createReadStream(file).pipe(res)`（大文件流式）。

## 3. MCP stdio 协议（默认形态）

- SDK：`@modelcontextprotocol/sdk`（TypeScript SDK，被 Bun 打包进 bundle）。
- 服务器：`new McpServer({ name: "previs-engine", version: "0.2.0" })`（`name` 为 MCP 服务名契约字面量，保留原样），注册 15 个工具（见 `data/tool_catalog.json`），`connect(new StdioServerTransport())`。
- 传输：stdin/stdout 上 **换行分隔 JSON-RPC 2.0**（SDK 的 `ReadBuffer.readMessage()`/`FR()` 实现）；`initialize` / `notifications/initialized` / `tools/list` / `tools/call` 由 SDK 分发。
- 工具 handler：
```js
async (args) => {
  try {
    const result = await service.execute(toolName, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] };
  }
}
```
- 工具实现均落到同一个 `iE.execute(name, args)` 服务类（HTTP 与 MCP 共用），无协议层差异。

## 4. 前端调用一致性（观察）

`resources\` 下的导演台前端目录 `assets\index-CBJ_xqSO.js`（React 前端，同源托管）：
```js
fetch(`/api/project`, {cache:`no-store`})                                        // 返回裸 State
fetch(`/api/command`, {method:`POST`, body:JSON.stringify({name, arguments})})  // 取 r.result
fetch(`/api/agent/chat`, {method:`POST`, body:JSON.stringify({messages})})      // 取 r.result
```
字段与包装结构与 sidecar 实现逐项一致（核验见 FEATURES §3.4/§8）。
