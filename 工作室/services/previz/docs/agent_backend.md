# 导演助手（Agent）后端：DeepSeek API 路径 与 Codex CLI 子进程路径

实现：`artifacts/recovered/app_director_engine_module.js` 中 `LR(service, messages)`（路由分发）、`kl(service, messages, state)`（DeepSeek 多轮工具循环）、`Vl(messages, tools)`（DeepSeek HTTP 调用）、`zl()/Bl()/El()`（Codex CLI 定位/子进程/输出解析）。提示词与流程均从二进制内嵌 JS 原文提取（`bundle_pretty_utf8.js` 行 22695–23013）。

## 0. 选择逻辑（观察）

```js
async function LR(service, messages) {
  const state = await service.execute("director_get_state");
  if (process.env.DEEPSEEK_API_KEY) return kl(service, messages, state);   // 路径 A
  const codex = await zl();                                               // 路径 B
  ...
}
```
两条路径互斥；`DEEPSEEK_API_KEY` 有值即走 A，否则必须找到 Codex CLI，否则返回 400 错误。

## 1. 路径 A：DeepSeek API（有 `DEEPSEEK_API_KEY`）

### 1.1 请求

```
POST ${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions
Authorization: Bearer ${process.env.DEEPSEEK_API_KEY}
Content-Type: application/json
body: {"model":"deepseek-v4-pro",
       "messages":[...],
       "tools":[...15 个 director_* 的 OpenAI function schema...],
       "tool_choice":"auto"}
```
- **模型名硬编码 `"deepseek-v4-pro"`**（不读取 `DEEPSEEK_MODEL`；主程序那边默认 `deepseek-chat` 的设置在本版本无效 —— 观察到的差异）。
- 超时：`AbortController` + 600,000 ms；超时报错 `DeepSeek API 响应超时（600s）`。
- 工具 schema 由 `Il()` 从 zod 定义 `toJSONSchema()` 生成：
  ```js
  { type:"function", function:{ name, description,
      parameters:{ type:"object", properties:<schema.properties>, required:<schema.required> } } }
  ```
- 非 2xx：抛 `DeepSeek API <status>: <error.message 或 JSON 前 200 字符>`。

### 1.2 多轮工具循环（最多 20 轮）

```
messages = [system prompt, user prompt]
loop up to 20:
  resp = DeepSeek(messages, tools)
  if no tool_calls: return {message: resp.content?.trim() || "已完成。", commands: executed, state: get_state}
  messages.push({role:"assistant", content: resp.content ?? null, tool_calls: resp.tool_calls})
  for each tool_call:
      name = call.function.name; args = JSON.parse(call.function.arguments || "{}")
      if name in ["director_apply_action","director_set_motion_keyframe","director_set_camera_keyframe"]: args.source = "agent"
      try { r = service.execute(name, args); executed.push({name, ok:true}); messages.push({role:"tool", tool_call_id, content: truncate(JSON.stringify(r))}) }
      catch e { executed.push({name, ok:false, error}); messages.push({role:"tool", tool_call_id, content: `错误: ${e.message(500)}`}) }
after loop: 取最后一条 assistant 文本；若发生过变更(wl)但没调用过 validate → 自动补一次 director_validate
```
- 追踪的 `wl`（10 条变更命令）：add/update element、apply action、set motion kf、apply camera、set camera kf、manage shot、set lock、delete、undo。
- 结果截断：`zR(x, 6000)`（含 health/project 时默认 6000，否则 `ER(x, 4000)`；被截断时追加 `...(project 已截断)` / `...(截断)`）。
- 返回：`{message, commands:[{name, ok, error?}], state}`。

### 1.3 DeepSeek system prompt（原文，行 22839–22847）

```
你是预演导演台内的专业电影预演助手，通过工具操作 3D 舞台。

工作规则：
1. 动手前必须先调用 director_get_state 获取真实元素 ID、动作/运镜模板和锁定状态，绝不编造人物或临时角色。
2. 所有时间线写入使用 24fps 整数帧；duration_seconds × 24 = duration_frames。
3. 绝不覆盖人工锁定的内容，除非用户明确要求（此时传 override_locked=true）。
4. 动作模板 ID 和运镜模板 ID 必须使用 get_state 返回的真实 ID，不要臆造。
5. 多步编辑完成后必须调用 director_validate 检查碰撞/重叠/路径问题。
6. 使用中文回复，简明说明你做了什么。
```

### 1.4 DeepSeek user prompt（原文，行 22861–22870）

```
当前完整工程状态(JSON)：
${zR(state, 20000)}

最近对话：
${最近 12 轮，格式 "用户：<content>" / "导演助手：<content>"，换行连接}

请根据对话继续执行。
```

## 2. 路径 B：Codex CLI 子进程（无 DeepSeek key）

### 2.1 定位 CLI（依次尝试，`acl($)` 检查可访问）

1. `process.env.CODEX_CLI_PATH`
2. `/Applications/ChatGPT.app/Contents/Resources/codex`
3. `/opt/homebrew/bin/codex`
4. `/usr/local/bin/codex`

全部不存在 → 抛中文错误：`未找到 Codex CLI。请先安装或打开 Codex 桌面版。`（unicode 转义原文 `\u672A\u627E\u5230 Codex CLI\u3002\u8BF7\u5148\u5B89\u88C5\u6216\u6253\u5F00 Codex \u684C\u9762\u7248\u3002`）

### 2.2 临时目录与输出 schema

- `mkdtemp(tmpdir()/previs-agent-)`（临时前缀已中性化）→ 写 `response.schema.json`、等待 CLI 写 `response.json`；`finally` 递归删除。
- 写入的 JSON Schema（原文结构，行 22926–22947）：
```json
{"type":"object","additionalProperties":false,"required":["message","commands"],
 "properties":{
   "message":{"type":"string"},
   "commands":{"type":"array","items":{
     "type":"object","additionalProperties":false,"required":["name","arguments_json"],
     "properties":{"name":{"type":"string"},
                   "arguments_json":{"type":"string","description":"A JSON object encoded as a string"}}}}}}
```

### 2.3 子进程命令（原文参数数组，行 22975–22991）

```
codex exec --ephemeral --skip-git-repo-check --ignore-user-config --ignore-rules
      -s read-only -c approval_policy="never"
      --output-schema <tmp>/response.schema.json
      --output-last-message <tmp>/response.json
      -
```
- prompt 通过 **stdin** 传入；`spawn(codexPath, args, {stdio:["pipe","pipe","pipe"], env: process.env})`。
- 超时 **180,000 ms**（`setTimeout` → `SIGTERM`，错误 `导演助手响应超时`）；非 0 退出 → 用 stderr/stdout 摘要抛错。
- `-s read-only` + `--ignore-user-config/--ignore-rules`：Codex 以只读沙箱、不加载用户配置运行，只负责产出 JSON，**真正改工程由预演服务进程执行**。

### 2.4 结果解析与执行（`El()`）

- 读 `response.json` → 校验 `{message:string, commands:[]}`，否则 `导演助手返回了无效结果`；
- `commands[].name` 必须属于白名单 `BR`（13 条，见 FEATURES §3.3），否则该条**静默丢弃**；
- `arguments_json` 解析为对象（失败也丢弃该条）；
- 逐条 `service.execute(name, args)`，`source` 强制为 `agent`（3 个动作类命令）；首个失败即停止（`break`），返回 `{message, commands:[{name, ok, error?}], state}`。

### 2.5 Codex prompt（原文，行 22953–22971）

```
你是预演导演台内的专业电影预演助手。你只输出符合 schema 的 JSON。

工作规则：
1. 根据工程状态中的精确 ID 操作，绝不编造人物或临时角色。
2. 用户需求明确时，输出可执行 commands；需求含糊时先在 message 中提出一个清楚问题，commands 留空。
3. 所有时间都是 24fps 的整数帧。动作和运镜要落在当前分镜时长内。
4. locked=true 是人工决定，除非用户明确要求覆盖，否则绝不使用 override_locked。
5. 人物添加优先使用 director_add_element 的 preset。角色、动物、群众和道具必须有稳定 ID。
6. 多步修改最后添加 director_validate。不要重置工程。
7. 不执行导出，导出必须由用户在界面手动确认。
8. 回答用简洁中文，说明将做什么或已经做了什么。

允许的命令：${[...BR].join(", ")}

当前完整工程状态：
${JSON.stringify(state)}

最近对话：
${最近 12 轮 "用户：…/导演助手：…"}
```

## 3. 与主程序 relay（8444）的关系（推断）

- 本 sidecar 的助手是**本地旁路**：要么直连 `api.deepseek.com`（BYOK），要么驱动本机 Codex CLI；**不经过**主程序 relay-server 8444（sidecar 内 `8444` 字符串计数 0）。
- 调试/思考模型：DeepSeek 路径用原生 function calling；Codex 路径用"JSON 结构输出 + 服务端白名单执行"模拟工具调用。
- 两条路径都要求模型"先 get_state 拿真实 ID、24fps 整数帧、勿覆盖锁定、多步后 validate"，与其 MCP 工具设计一致。
- 未解：主程序是否把用户额度对应的 key 注入 `DEEPSEEK_API_KEY`；`DEEPSEEK_MODEL` 与硬编码模型的错配原因（见 FEATURES §12）。
