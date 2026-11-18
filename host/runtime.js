/**
 * 运行时上下文 —— 插件生命周期内的共享控制器。
 *
 * 设计说明：Cordis 不允许往 ctx 上随意挂属性（"cannot set property X without provide"）。
 * 走 Service 子类对本地插件是过度设计，且 provide 声明需要 Cordis 的装饰器注册路径。
 * 这里改用模块级单例：插件激活时 init()，停用时 dispose()。
 * 工具/API 都从这里取控制器，避免 ctx 属性注入。
 *
 * ⚠️ Host 服务（llm / agentDefaultModel）也要挂进来：
 *    工具和 API 拿到的是这个 runtime 对象（`getRuntime()`），不是 Cordis ctx。
 *    以前只挂控制器，导致 `z.llm` 恒为 undefined ——
 *    智能分镜永远报"DSH 未挂载 llm 服务"，即使插件 inject 了 llm。
 */

let state = null;

export function initRuntime({ root, cfg, webServer, llm, agentDefaultModel, attachments }) {
  state = { root, cfg, webServer, llm, agentDefaultModel, attachments, startedAt: Date.now() };
  return state;
}

export function getRuntime() {
  if (!state) throw new Error('RUNTIME_NOT_READY: 插件尚未初始化');
  return state;
}

export function isRuntimeReady() { return state !== null; }

export function disposeRuntime() {
  state = null;
}

/** 把控制器挂进来（由 index.js 在 initRuntime 后调用） */
export function attachControllers(controllers) {
  if (!state) throw new Error('RUNTIME_NOT_READY');
  Object.assign(state, controllers);
  return state;
}