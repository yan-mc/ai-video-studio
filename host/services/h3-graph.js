/**
 * H3 ComfyUI 节点图装配器。
 *
 * ============================================================================
 * 为什么单独一个模块
 * ============================================================================
 *
 * 原来的实现把节点装配、槽位分配、"多余节点清理"三件事混在 runH3Local 的
 * 一个大 if/else 里，靠**硬编码编号段**约定互不冲突：
 *
 *     20..28  参考图 LoadImage
 *     40..    参考视频 / 音频（LoadVideo → GetVideoComponents）
 *     70/71   引导图 LoadImage
 *     80..    AddGuide
 *
 * 这种"编号即所有权"的约定非常脆，实际已经炸过两次：
 *
 *   ① 首尾帧被误删（**线上 P0**）
 *      FL2VA 分支在 20/21 建了首帧/尾帧的 LoadImage，但收尾那段
 *      `usedLoadImages = names.map((_, i) => 20 + i)` 只承认 ref_images
 *      占用的槽位，于是 20/21 被无条件删掉，而 MiniMaxH3ImageToVideo 的
 *      first_frame 仍然指向 ['20', 0] →
 *      ComfyUI 报 `node_errors['9'].details = "'20'"`。
 *      实测：**任何"无参考图 + 首帧/尾帧"的镜头必然失败**，
 *      而这正是「Blender 渲首帧 → H3 出片」最自然的用法。
 *
 *   ② AddGuide 编号撞 LoadImage
 *      AddGuide 从 70 开始编号会覆盖刚建好的 70/71 LoadImage，
 *      ComfyUI 报 "image, received_type(CONDITIONING)"。
 *
 * ============================================================================
 * 现在的做法
 * ============================================================================
 *
 *   1. `NodeGraph` 负责**唯一 ID 分配**（按用途分段，但不再靠约定保证安全）；
 *   2. 所有节点都经过 `set()` 登记；
 *   3. 装配完成后调 `pruneUnreachable()` —— 从输出节点反向遍历，
 *      **删掉一切不可达节点**。
 *
 * 第 3 步是关键：它不再需要任何"哪些槽位该删"的硬编码判断，
 * 因此不可能再出现"这个节点其实在用、却被清理逻辑删掉"的 bug。
 * 模板里遗留的 `{{REF_IMAGE_1}}` 占位符节点也会被同一条规则清掉
 * （它们没有上游生产者、也到不了输出）。
 */

/** 常见的输出类节点：从它们出发做可达性遍历。 */
const OUTPUT_NODE_TYPES = new Set([
  'SaveVideo', 'SaveImage', 'PreviewImage', 'PreviewVideo', 'SaveAudio',
  'VHS_VideoCombine', 'CreateVideo',
]);

/** 节点 ID 分配段位（仅为可读性，不承担正确性保证）。 */
const ZONE = Object.freeze({
  TEMPLATE: 0,      // 模板自带的固定节点，不参与分配
  REF_IMAGE: 20,    // 20..28 参考图
  REF_MEDIA: 40,    // 40..59 参考视频/音频
  GUIDE_IMG: 70,    // 70..79 引导图 LoadImage
  GUIDE: 80,        // 80..99 AddGuide
  MISC: 100,
});

export class NodeGraph {
  /**
   * @param {object} template 模板工作流（API 格式），会被深拷贝
   */
  constructor(template) {
    if (!template || typeof template !== 'object') {
      throw new Error('WORKFLOW_MISSING: 工作流模板为空');
    }
    this.nodes = structuredClone(template);
    this.taken = new Set(Object.keys(this.nodes).map(String));
    this.cursors = {};
    this.log = [];
  }

  /** 读一个节点（不存在返回 null） */
  get(id) {
    return this.nodes[String(id)] ?? null;
  }

  /** 写一个节点（覆盖） */
  set(id, node) {
    const key = String(id);
    this.nodes[key] = node;
    this.taken.add(key);
    return key;
  }

  /** 删一个节点 */
  remove(id) {
    const key = String(id);
    if (!(key in this.nodes)) return false;
    delete this.nodes[key];
    this.taken.delete(key);
    return true;
  }

  has(id) {
    return String(id) in this.nodes;
  }

  /**
   * 在指定段位分配一个未占用的节点 ID。
   *
   * @param {keyof ZONE} zone
   * @param {number} [span] 段位长度（默认到下一个段位为止，保守取 20）
   */
  alloc(zone, span = 20) {
    const base = ZONE[zone] ?? ZONE.MISC;
    let cur = this.cursors[zone] ?? base;
    const limit = base + span;
    while (cur < limit && this.taken.has(String(cur))) cur += 1;
    if (cur >= limit) {
      // 段位用尽：退到 MISC 区继续找，绝不覆盖已有节点
      let m = this.cursors.MISC ?? ZONE.MISC;
      while (this.taken.has(String(m))) m += 1;
      this.cursors.MISC = m + 1;
      this.taken.add(String(m));
      this.log.push(`zone ${zone} 用尽，回退到 ${m}`);
      return String(m);
    }
    this.cursors[zone] = cur + 1;
    this.taken.add(String(cur));
    return String(cur);
  }

  /**
   * 判断一个 `<id>.<slot>` 引用是否指向存在的节点。
   * 用来在交付前做一次完整性检查。
   */
  _refsOf(node) {
    const out = [];
    const walk = (v) => {
      if (Array.isArray(v)) {
        // 形如 ['20', 0] 的连线
        if (v.length === 2 && typeof v[0] === 'string' && Number.isInteger(v[1])) {
          out.push(v[0]);
          return;
        }
        for (const x of v) walk(x);
        return;
      }
      if (v && typeof v === 'object') {
        for (const x of Object.values(v)) walk(x);
      }
    };
    walk(node?.inputs ?? {});
    return out;
  }

  /**
   * 找出图的**输出根**。
   *
   * ⚠️ 只认真正的输出类节点（SaveVideo / SaveImage / Preview…），
   *    不能把"没有下游消费者"的节点也当根 —— 那正是模板里遗留的
   *    占位符 LoadImage（20/21）的特征。早期版本把 sinks 也当根，
   *    结果一个节点都剪不掉，20/21 依旧带着字面量 `{{REF_IMAGE_1}}`
   *    提交给 ComfyUI，报 Invalid file。
   *
   * 只有在模板里**完全没有**输出类节点时才退回 sinks，
   * 否则宁可什么都不剪（返回空 roots 会让 prune 删光整张图）。
   */
  _findOutputRoots() {
    const consumers = new Set();
    for (const node of Object.values(this.nodes)) {
      for (const ref of this._refsOf(node)) consumers.add(ref);
    }
    const typed = [];
    for (const [id, node] of Object.entries(this.nodes)) {
      if (OUTPUT_NODE_TYPES.has(node?.class_type)) typed.push(id);
    }
    if (typed.length) return typed;

    // 退路：没有可识别的输出节点时，用 sinks 保证至少能连通
    const sinks = [];
    for (const id of Object.keys(this.nodes)) {
      if (!consumers.has(id)) sinks.push(id);
    }
    return sinks;
  }

  /**
   * 从输出节点反向遍历，删除一切不可达节点。
   *
   * 这是替代"硬编码槽位清理"的结构性做法：
   *   · 模板里遗留的占位符节点（没人引用上游文件、也到不了输出）会被删掉；
   *   · 分支切换后不再需要的节点（例如切到 FL2VA 后不用的 ref_images）会被删掉；
   *   · 正在使用的节点**永远**不会因为"编号不在白名单里"而被误删。
   *
   * @returns {{removed:string[], roots:string[]}}
   */
  pruneUnreachable() {
    const roots = this._findOutputRoots();
    const reachable = new Set();
    const stack = [...roots];
    while (stack.length) {
      const id = String(stack.pop());
      if (reachable.has(id)) continue;
      const node = this.nodes[id];
      if (!node) continue;
      reachable.add(id);
      for (const ref of this._refsOf(node)) stack.push(ref);
    }
    const removed = [];
    for (const id of Object.keys(this.nodes)) {
      if (!reachable.has(id)) {
        delete this.nodes[id];
        this.taken.delete(id);
        removed.push(id);
      }
    }
    return { removed, roots };
  }

  /**
   * 完整性检查：所有连线都必须指向存在的节点。
   *
   * ⚠️ 这是给"节点被误删"这类 bug 兜底的最后一道防线。
   *    历史实现里 first_frame 指向已删除的 '20'，要到 ComfyUI 校验
   *    才以 `node_errors['9'] details "'20'"` 这种极难读的形式暴露。
   *    现在在**提交之前**就抛出可读错误。
   *
   * @returns {{ok:boolean, dangling:Array<{from:string,to:string,path:string}>}}
   */
  validateLinks() {
    const dangling = [];
    for (const [id, node] of Object.entries(this.nodes)) {
      const check = (value, path) => {
        if (Array.isArray(value)) {
          if (value.length === 2 && typeof value[0] === 'string' && Number.isInteger(value[1])) {
            if (!(value[0] in this.nodes)) {
              dangling.push({ from: id, to: value[0], path });
            }
            return;
          }
          value.forEach((v, i) => check(v, `${path}[${i}]`));
          return;
        }
        if (value && typeof value === 'object') {
          for (const [k, v] of Object.entries(value)) check(v, `${path}.${k}`);
        }
      };
      check(node?.inputs ?? {}, `${id}.inputs`);
    }
    return { ok: dangling.length === 0, dangling };
  }

  /** 统计各 class_type 出现次数（日志/测试用） */
  summary() {
    const byType = {};
    for (const node of Object.values(this.nodes)) {
      const t = node?.class_type ?? '?';
      byType[t] = (byType[t] ?? 0) + 1;
    }
    return { nodeCount: Object.keys(this.nodes).length, byType };
  }
}

export { ZONE, OUTPUT_NODE_TYPES };
