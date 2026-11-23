/**
 * 项目辅助 —— 列表投影、可写字段白名单、图数据直通。
 *
 * 从 api/index.js 逐字迁出（原 2644-2680 行）。
 */

/**
 * 列表页用的项目摘要（**不含 nodes / history**）。
 *
 * 为什么必须投影：项目详情里带完整画布节点树（可能几 MB），
 * 列表页一拉十几个项目就是几十 MB —— 而列表只需要名字和几个计数。
 */
export function projectSummary(p) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    nodeCount: p.nodeCount || 0,
    rootPath: p.rootPath || '',
    description: p.description || '',
  };
}

/**
 * 可写字段白名单。
 *
 * ⚠️ 必须白名单而不是黑名单：`POST /projects/:id` 的 body 直接来自浏览器，
 *    黑名单（排除 id/createdAt）会漏掉以后新加的敏感字段。
 */
export function allowedProjectPatch(body) {
  const out = {};
  for (const k of [
    'name', 'category', 'rootPath', 'description',
    'nodes', 'edges', 'viewport', 'nodeCount',
    // 历史字段：剧本/漫画时代遗留，页面已删但老项目里还在，允许原样保存
    'scriptProjectName', 'scriptProjectDir', 'comicProjectName', 'comicProjectDir',
  ]) {
    if (body && k in body) out[k] = body[k];
  }
  return out;
}

/**
 * 读写项目时的图变换 —— **当前是直通**。
 *
 * ⚠️ 历史说明：这里原本有一整套「内联 base64 图片入池」机制（store/image-pool.js）：
 *    写盘时把 `data:image/...;base64,...` 抽进 `project.imagePool`，
 *    节点里只留 `__img_ref__:<n>`；读盘时再还原。
 *
 *    审计实测：**前端从不产生 data:image 内联图** —— 画布用
 *    `URL.createObjectURL()` 的 `blob:` 预览，上传后用 `/assets/item` 的同源 URL。
 *    全仓库 `app-src` 里 `data:image` 零命中。
 *
 *    于是这条链路恒为空转，却有两个真实代价：
 *      ① 每次 `GET /projects/:id` 都要 `JSON.stringify(整个项目)` 来判断要不要
 *         unpack（几十 MB 的项目每次序列化一遍）；
 *      ② `looksLikeBase64Image` 的「>2000 字符纯 base64」启发式会把 aiTextNode
 *         的长正文（长英文段落 / 代码块 / 哈希串）误判成图片，搬进 pool 后
 *         节点里变成占位符 —— **正文静默消失**，且没有任何提示。
 *
 *    所以改成直通：旧数据里若真存过 `imagePool`，读时原样带回（不丢历史内容），
 *    但不再做任何抽取/还原。`store/image-pool.js` 已随之删除。
 */
export function packProject(project) {
  return project;
}

export function unpackProject(project) {
  return project;
}