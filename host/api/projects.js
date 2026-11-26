/**
 * 项目辅助 —— 列表投影、可写字段白名单、图数据直通。
 */

/**
 * 列表页用的项目摘要（**不含 nodes / history**）。
 *
 * 项目详情里带完整画布节点树（可能几 MB），
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
 * 必须白名单而不是黑名单：body 直接来自浏览器，黑名单（排除 id/createdAt）
 * 会漏掉以后新加的敏感字段。
 */
export function allowedProjectPatch(body) {
  const out = {};
  for (const k of [
    'name', 'category', 'rootPath', 'description',
    'nodes', 'edges', 'viewport', 'nodeCount',
    // 剧本/漫画时代遗留字段：页面已删，老项目里还在，允许原样保存
    'scriptProjectName', 'scriptProjectDir', 'comicProjectName', 'comicProjectDir',
  ]) {
    if (body && k in body) out[k] = body[k];
  }
  return out;
}

/**
 * 读写项目时的图变换 —— **当前是直通**。
 *
 * 前端不产生 data:image 内联图（画布用 blob: 预览、上传后走 /assets/item），
 * 所以内联 base64 入池机制恒为空转，且它的启发式会误把长正文当图片搬走。
 * 旧数据里若存过 `imagePool`，读时原样带回，不做任何抽取/还原。
 */
export function packProject(project) {
  return project;
}

export function unpackProject(project) {
  return project;
}