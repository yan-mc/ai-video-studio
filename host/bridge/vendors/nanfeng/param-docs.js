/**
 * 南风 V15 参数释义表 —— 221 个参数的中文说明 + 调参建议 + 有效性标记。
 *
 * ============================================================================
 * 为什么需要这份表
 * ============================================================================
 *
 * 南风节点把 221 个参数塞进一个巨型 COMBO 节点，参数名是中文短语，
 * 但**没有任何文档**：界面上只显示名字，用户不知道：
 *   · 「SolAttn_tau」是什么
 *   · 「SLA稀疏率 0.9」调大调小会发生什么
 *   · 「T8残差阈值」和「T8开始比例」谁先谁后
 *   · 更糟的是：**有些参数是彻底无效的**（见下）
 *
 * 这份表把每个参数翻译成一句人话，并为其中真正会影响出片的参数
 * 补一条调参建议。
 *
 * ============================================================================
 * ⚠️ 关键结论：一批参数在 V15 里是**死参数**
 * ============================================================================
 *
 * 对照 vendor/nanfeng/h3_generator.py 逐项核实（V15 源码，行号按当前版本校对）：
 *
 *   1) 「启用高清二采」整条链路已不存在
 *      `hd_second_pass` 在 V15 已被移除（h3_generator.py:1748-1750 的注释确认），
 *      挂在旧 `if hd_second_pass:` 分支下的 9 个参数
 *      （二采百万像素 / 二采放大方法 / 二采步数 / 二采降噪 / 二采采样器 /
 *       二采调度器 / 二采模型 / 二采起始Sigma / 一采步数）
 *      **永远不会生效**。
 *
 *   2) 「启用双采样」整条链路已废弃
 *      `elif False:` 分支被写死关闭（"已废弃分支：V15 恒不启用"）。
 *      「双采后段比例」「双采后段采样器」永远不生效。
 *
 *   3) 「分块处理（节约显存）」被上游**主动禁用**
 *      h3_generator.py 直接抛错：分块处理会导致花屏，
 *      要求用户必须设为「关闭」。选项里也只有「关闭」一项。
 *      「分块卸载层数」属于同一个被禁用的 Block Offload 补丁。
 *
 *   4) 「参考图尺寸」是**形参零使用**
 *      ref2va 路径把 `ref_image_size` 硬编码为 "max"（h3_generator.py:1604）。
 *      match / max 在本地没有任何差异 —— UI 不应再给档位或据此提示降级。
 *
 *   合计 40 余个死参数。本表用 `dead` / `banned` 标记它们，
 *   前端默认折叠隐藏，避免用户在无效旋钮上浪费时间。
 *
 *   ⚠️ 反向注意：「启用西格玛调节」/「视频西格玛偏移」/「音频西格玛偏移」
 *      **不是**死参数 —— V15 读它们并据此插 MiniMaxH3SigmaShift
 *      （h3_generator.py:1727/1743/1751-1754），是 DMAD 类蒸馏学生
 *      不出分布外的唯一通道。标 dead 会让 UI 把唯一可调的 shift 灰掉。
 *
 *   真正的「二采」是 **H3 潜空间放大二采**（`H3一采步数` + `H3二采步数`
 *   + `H3潜空间目标百万像素`），预设用的就是这一条 —— 有效且是主力路径。
 *
 * @module nanfeng/param-docs
 */

/**
 * @typedef {object} ParamDoc
 * @property {string} zh    一句话说明（做什么）
 * @property {string} [hint] 调参建议（什么时候动、怎么动）
 * @property {'dead'|'banned'|'advanced'} [flag]
 *           dead   = 上游硬编码关闭 / 形参零使用，调了完全没反应
 *           banned = 上游主动禁用或本机缺依赖，开了会报错/花屏
 *           advanced = 高危或需要额外依赖，非老手不建议动
 *
 * ⚠️ `flag` 是 UI 的**唯一**真相来源：标错（把有效参数标 dead、
 *    把死通道标成可用）会让整块参数面板撒谎。改标记前必须回 vendor 源码核实行号。
 */

/** 分组级说明（覆盖 schema.js 里较简略的 desc） */
export const GROUP_DOCS = Object.freeze({
  A: {
    name: '核心参数',
    zh: '模型、VAE、采样器、分辨率、时长、提示词。日常只需要动这一组里的 4 个：画面比例、百万像素、时长秒、采样步数。',
  },
  B: {
    name: '素材槽位',
    zh: '参考图 1-9 / 参考视频 1-3 / 参考音频 1-3。槽位编号必须和提示词里的 <Picture N> / <Video N> / <Audio N> 严格对齐 —— 插件会自动填好，一般不要手改。',
  },
  C: {
    name: '生成模式',
    zh: '文生视频 / 图生视频 / 首尾帧，三选一。由镜头卡的 mode 自动映射，手改容易和素材槽位冲突。',
  },
  D: {
    name: '二次采样',
    zh: '画质提升的核心。真正有效的是「H3 潜空间放大二采」：先低分辨率一采，再在潜空间放大后二采精修。上面那批「高清二采」是 V7 之前的旧实现，已废弃。',
  },
  E: {
    name: '显存控制',
    zh: '12GB 显卡的救命组。显存不够时优先开「启用运行时预留显存」。分块处理被上游禁用，别碰。',
  },
  F: {
    name: '注意力与加速',
    zh: '换速度的地方，也是最容易搞崩的一组。Sol-Attn / T8 / H3专用注意力 / SLA **四者互斥**，只能开一个。全部开着会直接报错。',
  },
  G: {
    name: 'LoRA',
    zh: '蒸馏加速 LoRA。本机装了 DMAD 4 步 / 8 步两个。用了就必须把采样步数压到 4-8，否则出鬼影。',
  },
  H: {
    name: '小脸修复',
    zh: '远景里人脸太小、糊成一片时的补救。检测到小脸后单独再跑一轮高分辨率修复。有额外耗时。',
  },
  I: {
    name: '潜空间续写',
    zh: '跨镜头无缝续接。上一镜头末段的 AV latent 直接喂给下一镜头开头，动作不断裂。只能配合「续写」预设使用。',
  },
  J: {
    name: '音频驱动',
    zh: '用一段音频驱动画面节奏（打点、分段）。和潜空间续写互斥，不能同时开。',
  },
  K: {
    name: '预览与超分',
    zh: '采样过程预览 / RTX 视频超分 / DLSS 超分补帧 / TensorRT VAE。RTX、DLSS、TRT 都需要额外插件，本机未装，开了会报错。',
  },
  L: {
    name: '南风采样器',
    zh: '南风自研的 ER-SDE 求解器参数。只有在采样器选了「南风采样器」时才生效。',
  },
});

/**
 * 全部参数释义。
 * key 必须与 schema.js 的 PARAMS 完全一致（测试会校验覆盖率）。
 * @type {Record<string, ParamDoc>}
 */
export const PARAM_DOCS = Object.freeze({
  /* ======================== A 核心参数（29） ======================== */
  模型: {
    zh: '扩散主干模型。ref2va 用于参考图/视频驱动，fl2va 用于首尾帧。',
    hint: 'Ref2VA 镜头用 ref2va；首尾帧镜头切到 fl2va。切错模型会直接报错或出废片。',
  },
  文本编码器: {
    zh: '把提示词编码成条件的文本塔（Qwen3-VL 32B，int8 量化）。',
    hint: '本机只装了一个，不要动。',
  },
  文本编码器类型: { zh: '文本编码器的加载实现。本机只有 minimax 一种。', hint: '不要动。' },
  文本编码器设备: {
    zh: '文本编码器跑在 GPU 还是 CPU。',
    hint: '显存吃紧时选 cpu 可以把 25GB 文本塔挪出显存，代价是编码变慢。默认 default 即可。',
  },
  视频VAE: { zh: '视频潜空间的编解码器。', hint: '只有一个可选，不要动。' },
  音频VAE: { zh: '音频潜空间的编解码器（H3 原生音画同步靠它）。', hint: '不要动。' },
  模型权重精度: {
    zh: '加载时把模型权重转成的数值精度。',
    hint: '模型已经是 fp8 预量化，这里保持 default。改 fp8_e5m2 画质会更差。',
  },
  SageAttention: {
    zh: 'SageAttention 加速内核（比原生注意力快 30-50%）。',
    hint: '用户值被无条件覆盖：`SageAttention = "disabled"` 后又被 `selected_h3_attention` 接管（h3_generator.py:1462-1471）。真正控制注意力的是「H3专用注意力」。本机另未装 SageAttention2/3，graph.js 也会强制改成 disabled。',
    flag: 'dead',
  },
  允许编译: {
    zh: '允许 torch.compile 图编译。',
    hint: '首次运行会编译几分钟，之后略快，但极易 OOM 或编译失败。12GB 卡不建议开。',
    flag: 'advanced',
  },
  画面比例: {
    zh: '输出画幅比例。',
    hint: '竖屏短剧用 9:16，横屏用 16:9，电影感用 21:9。选了「原图比例」会跟随第一张参考图的尺寸。',
  },
  百万像素: {
    zh: '一采（基础采样）的画幅面积，单位百万像素。数值越大画面越大、越慢、越吃显存。',
    hint: '12GB 卡固定 0.4（≈864×480）。0.6 以上容易 OOM。要更高清请用 H3 潜空间二采，不要直接抬这个。',
  },
  尺寸倍数: {
    zh: '输出宽高的对齐步长（必须是 32 的倍数）。',
    hint: '只在 `else resolution_from_megapixels(...)` 分支被用（h3_generator.py:1401），'
      + '而该表达式被 `if True` 短路（:1400）—— 永远走不到。固定 32，不要动。',
    flag: 'dead',
  },
  时长秒: {
    zh: '生成视频时长（秒）。',
    hint: 'H3 的训练区间是 124-362 帧 / 24fps，即约 5.2-15 秒。低于 5 秒会被内部补到下限。',
  },
  提示词: {
    zh: '完整提示词正文。Ref2VA 走六段式，T2VA 走三段式。',
    hint: '用 studio_prompt 编译器生成，不要手搓 —— 结构错了角色会串脸。',
  },
  随机种子: {
    zh: '随机种子。同一个种子 + 同一套参数 = 同一段视频。',
    hint: '想复现某个满意的镜头就记下它；想每次不同就改一个值。'
      + '注意：本参数**直接生效**，不依赖「固定随机种子」（那个开关上游根本没读，是个死参数）。',
  },
  调度器: {
    zh: 'Sigma 时间表的生成策略，决定每一步去掉多少噪声。',
    hint: 'simple 最稳，配合 DMAD 蒸馏 LoRA 必须用 simple。karras 细节更锐利但容易过曝。',
  },
  采样步数: {
    zh: '总采样步数。步数越多越精细，但线性变慢。',
    hint: '主力 20 步（无 LoRA）；用 DMAD 4 步 LoRA 时设 4，8 步 LoRA 时设 8。用 H3 潜空间二采时这个参数会被一采/二采步数取代。',
  },
  降噪强度: {
    zh: '整体降噪强度，相当于「重绘幅度」。',
    hint: '文生视频保持 1.0。图生视频想保留原图构图的可以降到 0.7-0.9。',
  },
  参考图尺寸: {
    zh: '参考图的预处理方式。match=缩放到与输出同尺寸；max=保留最大边不缩放。',
    hint: '【上游已固定】ref2va 路径把 `ref_image_size` 硬编码为 "max"（h3_generator.py:1604，'
      + '且在 :1854 注明"当前固定 ref_image_size=max"），本参数只是形参零使用 —— '
      + '"match" / "max" 在本地**没有任何差异**。请在 UI 上按"无档位"呈现，不要给用户选择，'
      + '也不要再据此生成显存降级提示（真实占用恒为 max）。',
    flag: 'dead',
  },
  固定随机种子: {
    zh: '【已失效】ComfyUI 前端的 control_after_generate 控件。',
    hint: '上游只在 h3_generator.py:2129 声明了它，`generate()` 内**零读取**。'
      + '真正决定种子的是「随机种子」参数本身，与这个开关无关。打开也没有任何效果。',
    flag: 'dead',
  },
  每区间细分: {
    zh: 'Sigma 加密时每个区间的插值步数。',
    hint: '只和「低西格玛加密」配合生效。2 是平衡点，调到 4 以上收益很小但会变慢。',
    flag: 'advanced',
  },
  加密曲线: {
    zh: 'Sigma 加密的插值曲线形状。',
    hint: 'cosine 在两端更密（推荐）；linear 均匀；sine 中段更密。差异很细微。',
    flag: 'advanced',
  },
  启用双采样: {
    zh: '【已失效】V4 时代的双段采样开关。',
    hint: '上游已把该分支写死为 False（h3_generator.py:1796 `elif False:`），打开也不会有任何效果。',
    flag: 'dead',
  },
  双采后段比例: {
    zh: '【已失效】旧双采样里第二段占的比例。',
    hint: '同上，整条双采样链路已废弃，调了没反应。',
    flag: 'dead',
  },
  双采后段采样器: {
    zh: '【已失效】旧双采样里第二段用哪个采样器。',
    hint: '同上，已废弃。',
    flag: 'dead',
  },
  一采步数: {
    zh: '【已失效】旧「高清二采」的一采步数。',
    hint: '只在 hd_second_pass 分支里被读取，而该分支的开关是硬编码 False。真正的二采步数请用「H3一采步数」。',
    flag: 'dead',
  },
  启动准备: {
    zh: '启动阶段的额外预处理（当前只有「关闭」一项）。',
    hint: '只有一个选项，不要动。',
  },
  H3一采步数: {
    zh: 'H3 潜空间放大二采的**第一阶段**步数（低分辨率基础采样）。',
    hint: '6 步是实测最佳性价比。降到 4 更快但动作容易糊，升到 8 收益递减。',
  },
  参考图最长边: {
    zh: '参考图送入模型前的最大边长，超出会等比缩小。',
    hint: '1920 是默认值。显存吃紧降到 1280 能省一大截；要保住立绘纹理可到 2560，但 12GB 卡有 OOM 风险。',
  },

  /* ======================== B 素材槽位（15） ======================== */
  图片1: { zh: '参考图槽位 1，对应提示词里的 <Picture 1>。', hint: '由插件按「角色卡 → 人设卡 → 手工图 → 场景图」的顺序自动填充，不要手改。' },
  图片2: { zh: '参考图槽位 2，对应 <Picture 2>。', hint: '同上，自动填充。' },
  图片3: { zh: '参考图槽位 3，对应 <Picture 3>。', hint: '同上，自动填充。' },
  图片4: { zh: '参考图槽位 4，对应 <Picture 4>。', hint: '同上，自动填充。' },
  图片5: { zh: '参考图槽位 5，对应 <Picture 5>。', hint: '同上，自动填充。' },
  图片6: { zh: '参考图槽位 6，对应 <Picture 6>。', hint: '同上，自动填充。' },
  图片7: { zh: '参考图槽位 7，对应 <Picture 7>。', hint: '同上，自动填充。' },
  图片8: { zh: '参考图槽位 8，对应 <Picture 8>。', hint: '同上，自动填充。' },
  图片9: { zh: '参考图槽位 9，对应 <Picture 9>。', hint: '同上，自动填充。H3 最多吃 9 张图。' },
  视频1: { zh: '参考视频槽位 1，对应 <Video 1>。', hint: 'Blender 预演渲出的灰模视频就填这里，用来锁运镜和走位。' },
  视频2: { zh: '参考视频槽位 2，对应 <Video 2>。', hint: '自动填充。' },
  视频3: { zh: '参考视频槽位 3，对应 <Video 3>。', hint: '自动填充。H3 最多吃 3 段参考视频。' },
  音频1: { zh: '参考音频槽位 1，对应 <Audio 1>。', hint: '用于锁音色 / 锁节奏。注意带音轨的参考视频会额外占用音频序号。' },
  音频2: { zh: '参考音频槽位 2，对应 <Audio 2>。', hint: '自动填充。' },
  音频3: { zh: '参考音频槽位 3，对应 <Audio 3>。', hint: '自动填充。H3 最多吃 3 段参考音频。' },

  /* ======================== C 生成模式（3） ======================== */
  文生视频: { zh: 'T2VA 模式开关：只靠文字生成。', hint: '由镜头 mode 自动设置。开了但没素材也没关系，这三个开关是互斥的。' },
  图生视频: { zh: 'I2VA 模式开关：用一张图作为首帧。', hint: '自动设置。需要 图片1 有内容。' },
  首尾帧: { zh: 'FL2VA 模式开关：给首帧和尾帧两张图，模型补中间。', hint: '自动设置。需要 图片1、图片2 都有内容，且模型切到 fl2va。' },

  /* ======================== D 二次采样（23） ======================== */
  启用高清二采: {
    zh: '【已失效】V7 之前的高清二采（解码放大再编码）。',
    hint: 'h3_generator.py:1689 硬编码 `hd_second_pass = False`，打开无任何效果。请改用「启用H3潜空间放大二采」。',
    flag: 'dead',
  },
  二采百万像素: { zh: '【已失效】旧高清二采的目标面积。', hint: '仅在上面的死分支里读取。请改用「H3潜空间目标百万像素」。', flag: 'dead' },
  二采放大方法: { zh: '【已失效】旧高清二采的插值算法。', hint: '死分支。', flag: 'dead' },
  二采步数: { zh: '【已失效】旧高清二采的步数。', hint: '死分支。请改用「H3二采步数」。', flag: 'dead' },
  二采降噪: { zh: '【已失效】旧高清二采的重绘幅度。', hint: '死分支。请改用「H3二采Sigma」。', flag: 'dead' },
  二采采样器: { zh: '【已失效】旧高清二采的采样器。', hint: '死分支。', flag: 'dead' },
  二采调度器: { zh: '【已失效】旧高清二采的调度器。', hint: '死分支。', flag: 'dead' },
  二采模型: { zh: '【已失效】旧高清二采用哪个模型重绘。', hint: '死分支。', flag: 'dead' },
  二采起始Sigma: { zh: '【已失效】旧高清二采的起始噪声水平。', hint: '死分支。', flag: 'dead' },
  启用H3潜空间放大二采: {
    zh: '**真正的二采总开关**：一采出低分辨率，在潜空间用 3D 卷积放大，再用二采精修。',
    hint: '这是本插件画质提升的主力，也是 standard / quality 预设的核心。12GB 卡建议 0.8-1.2MP。',
  },
  H3潜空间放大模型: { zh: '潜空间放大器（3D 卷积，专为 H3 训练）。', hint: '只有一个可选，不要动。' },
  H3潜空间目标百万像素: {
    zh: '二采放大后的目标面积。',
    hint: '0.8 ≈ 1216×688，1.2 ≈ 1472×832，1.5 ≈ 1664×928。12GB 卡 1.2 是实测上限。',
  },
  H3潜空间对齐: {
    zh: '放大后尺寸向下对齐的步长。',
    hint: '2 最精细，但最容易得到非 32 倍数的尺寸。显存告急时可调到 8 换取更小的画布。',
  },
  H3潜空间精度: {
    zh: '潜空间放大的计算精度。',
    hint: 'fp16 是默认且够用。bf16 更抗溢出但慢一点。fp32 显存直接爆，别选。',
  },
  H3二采Sigma: {
    zh: '二采的噪声衰减序列（从大到小，逗号分隔）。',
    hint: '只在 `else:` 分支被读（h3_generator.py:1998-2000），而 V15 恒走 `if is_v81:`（:1993-1996，用 `v81_sigma_split`）—— 该分支不可达。',
    flag: 'dead',
  },
  H3二采LoRA模式: {
    zh: '二采是否沿用一采的 LoRA。当前只有「继承一采LoRA」。',
    hint: '整段包在 `if False:` 里（h3_generator.py:1505-1508，注释写明'
      + '"原 V8 早期路径，V8.1 已改用低峰值放大器"），且 `second_lora_mode` 恒为'
      + '「继承一采LoRA」（:1504）—— 改不了。',
    flag: 'dead',
  },
  H3二采LoRA: {
    zh: '【已失效】二采阶段单独使用的 LoRA 文件。',
    hint: '只在「H3二采LoRA模式=独立4步LoRA」时读取，而该模式在当前选项列表里不存在'
      + '（唯一选项是「继承一采LoRA」），所以填了也不会生效。',
    flag: 'dead',
  },
  H3二采LoRA强度: {
    zh: '二采 LoRA 的强度。',
    hint: '只在 `if not is_v81 and second_lora_mode == "独立4步LoRA"` 分支被读'
      + '（h3_generator.py:1945-1956），而 V15 恒 `is_v81=True` —— 不可达。',
    flag: 'dead',
  },
  H3二采步数: {
    zh: 'H3 潜空间二采的**第二阶段**步数。',
    hint: '4 步是实测甜蜜点。降到 2 细节明显掉，升到 6 收益很小但时间 +50%。',
  },
  H3完整Sigma序列: {
    zh: '整条手动 Sigma 轨迹（留空=自动）。',
    hint: '留空。填了会用你给的值覆盖一采+二采的全部时间表，格式错直接报错。',
    flag: 'advanced',
  },
  V81一采使用手动Sigma: {
    zh: '不开二采时，一采是否也使用「H3完整Sigma序列」。',
    hint: '只有在你填了 H3完整Sigma序列 时才需要。',
    flag: 'advanced',
  },
  启用潜空间续写: {
    zh: '跨镜头续写总开关：把上一镜头的 AV latent 接到本镜头开头。',
    hint: '用 continuation / continuation-quality 预设时会自动打开。与锁音频、音频驱动、时间轴模式**互斥**。',
  },
  潜空间续写任务: {
    zh: '续写上下文的任务标识（由后半段自动生成）。',
    hint: '由续写批次自动写入，不要手改。',
  },

  /* ======================== E 显存控制（5） ======================== */
  '分块处理（节约显存）': {
    zh: '【已禁用】Block Offload 分块处理。',
    hint: '上游明确禁用：会让画面花屏（h3_generator.py:543 主动抛错）。选项里也只有「关闭」，必须保持关闭。',
    flag: 'banned',
  },
  分块卸载层数: {
    zh: '【已禁用】分块处理卸载到 CPU 的层数。',
    hint: '属于被禁用的 Block Offload 补丁，不要动。',
    flag: 'banned',
  },
  低显存注意力分头数: {
    zh: '【已失效】低显存注意力分头数。',
    hint: '该参数在 V15 的 generate() 里没有任何消费方（只有 schema 声明），'
      + '调它不会改变显存占用。真正省显存请用「启用运行时预留显存」。',
    flag: 'dead',
  },
  运行时预留显存GB: {
    zh: '给系统/其它程序预留的显存（GB）。',
    hint: '配合下面的开关。12GB 卡同时开浏览器+ComfyUI 时设 1.5-2.0 能显著减少 OOM。',
  },
  启用运行时预留显存: {
    zh: '是否启用显存预留。',
    hint: '显存不够就打开 —— 这是 12GB 卡最有效的一根救命稻草，比关掉各种加速都管用。',
  },

  /* ======================== F 注意力与加速（37） ========================
   * 注意：Sol-Attn（7 项）与 T8（8 项）在 V15 源码里被**无条件**置 False
   * （h3_generator.py:1472-1473），整组不产生任何作用；Sigma 面板
   * （6 项）同理被 sigma_requested=False（:1687）写死。下面逐项标注。
   */
  启用SolAttn: {
    zh: '【已失效】Sol-Attn 稀疏注意力加速。',
    hint: 'h3_generator.py:1472 无条件把 sol_enabled 置 False，'
      + '消费代码在恒假分支内。勾选不会有任何效果。',
    flag: 'dead',
  },
  SolAttn_tau: { zh: '【已失效】Sol-Attn 阈值系数。', hint: '死分支（见上）。', flag: 'dead' },
  SolAttn阈值类型: { zh: '【已失效】Sol-Attn 阈值类型。', hint: '死分支。', flag: 'dead' },
  SolAttn精确模式: { zh: '【已失效】Sol-Attn 精确模式。', hint: '死分支。', flag: 'dead' },
  SolAttn完整末步: { zh: '【已失效】Sol-Attn 末步数。', hint: '死分支。', flag: 'dead' },
  SolAttn末段比例: { zh: '【已失效】Sol-Attn 末段比例。', hint: '死分支。', flag: 'dead' },
  SolAttn前缀Token: { zh: '【已失效】Sol-Attn 前缀 token 数。', hint: '死分支。', flag: 'dead' },
  启用T8缓存: {
    zh: '【已失效】T8 Block Cache。',
    hint: 'h3_generator.py:1473 无条件置 False；依赖的 MiniMaxH3BlockCacheT8 '
      + '节点本机也未安装。勾选不会有任何效果。',
    flag: 'dead',
  },
  T8残差阈值: { zh: '【已失效】T8 残差阈值。', hint: '死分支。', flag: 'dead' },
  T8开始比例: { zh: '【已失效】T8 开始跳过比例。', hint: '死分支。', flag: 'dead' },
  T8结束比例: { zh: '【已失效】T8 停止跳过比例。', hint: '死分支。', flag: 'dead' },
  T8连续命中: { zh: '【已失效】T8 连续命中次数。', hint: '死分支。', flag: 'dead' },
  T8缓存设备: { zh: '【已失效】T8 缓存设备。', hint: '死分支。', flag: 'dead' },
  T8指标步幅: { zh: '【已失效】T8 指标步幅。', hint: '死分支。', flag: 'dead' },
  T8详细日志: { zh: '【已失效】T8 日志开关。', hint: '死分支。', flag: 'dead' },
  启用西格玛调节: {
    zh: 'Sigma 偏移总开关：开启后会插入 MiniMaxH3SigmaShift 节点，用下面两个偏移值决定 video/audio 的 shift。',
    hint: '**有效参数，且是 DMAD 类蒸馏学生不出分布外的唯一通道** —— '
      + 'h3_generator.py:1727 读用户值（`sigma_requested = bool(kwargs.get("启用西格玛调节", False))`），'
      + ':1743/:1747-1754 据此插 MiniMaxH3SigmaShift 并写 shift_video/shift_audio。'
      + 'DMAD 在 12/2 上训练，模型自带的是 12/3，所以插件在加速方案里会自动把它设为 true。'
      + '想手动调 shift 就走这里（必须配「原生轨迹」策略，即"不加步但仍指定 shift"）。',
    flag: 'advanced',
  },
  视频西格玛偏移: {
    zh: '视频轨迹的 Sigma shift（插 MiniMaxH3SigmaShift 时使用）。',
    hint: 'DMAD 学生训练值是 12。用非 12 的值属分布外采样，画质会悄悄变差但不报错。',
    flag: 'advanced',
  },
  音频西格玛偏移: {
    zh: '音频轨迹的 Sigma shift（插 MiniMaxH3SigmaShift 时使用）。',
    hint: 'DMAD 学生训练值是 2（模型自带 3）。与「视频西格玛偏移」成对设置。',
    flag: 'advanced',
  },
  西格玛模式: { zh: '【已失效】旧 V4/V7 Sigma 面板的模式选择。', hint: 'V15 恒走 V8.1 完整轨迹分支，本项零读取。真正生效的是「Sigma策略」。', flag: 'dead' },
  低西格玛开始: { zh: '【已失效】旧 Sigma 加密的起始值。', hint: 'V15 走 V8.1 轨迹，本项零读取。', flag: 'dead' },
  低西格玛结束: { zh: '【已失效】旧 Sigma 加密的结束值。', hint: '同上。', flag: 'dead' },
  手动西格玛: {
    zh: '【已失效】旧 Sigma 面板的手动序列。',
    hint: 'V15 恒走 V8.1 分支，本项零读取。要手动指定完整轨迹请用「H3完整Sigma序列」。',
    flag: 'dead',
  },
  H3专用注意力: {
    zh: '南风自己的注意力后端选择（第二套注意力开关，和上面的 SageAttention 不是同一个）。',
    hint: '⚠️ 本机未装 SageAttention，必须保持「关闭」。插件已强制修正。它和 Sol-Attn / T8 / SLA 也互斥。',
    flag: 'advanced',
  },
  Sigma策略: {
    zh: 'Sigma 时间表怎么生成：原生轨迹 / 面板 Sigma 轨迹 / 最终区间加 1 步。',
    hint: '「原生轨迹（不加步）」+ 开启「启用西格玛调节」= **只改 shift、不改步网格** —— '
      + '这正是蒸馏学生需要的形态（h3_generator.py:1758-1765：'
      + '`need_sigma_shift` 由总开关决定，`sigma_enabled` 才由本项派生）。'
      + '另外两个值会额外重排步网格。',
    flag: 'advanced',
  },
  全局修复Sigma策略: { zh: '全局修复阶段的 Sigma 策略（独立于主生成）。', hint: '`generate()` 里零读取（只在 h3_generator.py:2249 声明）。整个「全局修复」组都没有消费代码。', flag: 'dead' },
  启用UniBlockSwap: {
    zh: 'UniBlockSwap —— 把部分 transformer 块换出显存的省显存方案。',
    hint: '显存紧张时可试。会明显变慢，且和分块处理不是一回事。',
    flag: 'advanced',
  },
  UniBlockSwap常驻块数: { zh: '常驻显存不换出的块数，越大越快越吃显存。', hint: '1 是默认。8GB 卡可保持 1，显存宽裕可上调。', flag: 'advanced' },
  '启用H3 SLA': {
    zh: 'SLA 稀疏线性注意力（南风 V9 引入的加速方案）。',
    hint: '⚠️ 需要上游 H3SLAAttention 节点，**本机缺失**，开了会报错。必须保持关闭。插件已强制修正。',
    flag: 'banned',
  },
  SLA稀疏率: { zh: 'SLA 跳过的注意力比例（0.9 = 只算 10%）。', hint: '0.9 是默认。SLA 本机不可用，无实际意义。', flag: 'banned' },
  SLA块大小: { zh: 'SLA 的分块大小（64 或 128）。', hint: 'SLA 不可用。', flag: 'banned' },
  SLA最短序列: { zh: '序列短于此长度就退回稠密注意力。', hint: 'SLA 不可用。', flag: 'banned' },
  SLA末尾稠密步数: { zh: '最后 N 步强制走稠密注意力。', hint: 'SLA 不可用。', flag: 'banned' },
  SLA保护音频: { zh: 'SLA 是否跳过音频相关的注意力。', hint: 'SLA 不可用。', flag: 'banned' },
  SLA指定稠密步: { zh: '显式指定哪几步走稠密。', hint: 'SLA 不可用。', flag: 'banned' },
  SLA稠密后端: { zh: 'SLA 的稠密部分用哪个后端算。', hint: 'SLA 不可用。', flag: 'banned' },
  SLA关闭FP16累加: { zh: '稠密计算时禁用 FP16 累加以防溢出。', hint: 'SLA 不可用。', flag: 'banned' },
  SLA稳定运动: { zh: 'SLA 的运动稳定性补偿。', hint: 'SLA 不可用。', flag: 'banned' },

  /* ======================== G LoRA（25） ======================== */
  启用LoRA: {
    zh: 'LoRA 总开关。',
    hint: '只在 `not individual` 时才被检查（h3_generator.py:2063），而 V15 恒用 `individual=True`（:1440-1442, 1695-1699）—— 该早退不生效。真正的 LoRA 开关是 `LoRA1启用` … `LoRA8启用`（每个槽位一个）。',
    flag: 'dead',
  },
  LoRA1: { zh: 'LoRA 槽位 1 的模型文件。', hint: '通常放 DMAD 8 步（质量优先）。' },
  LoRA1强度: { zh: 'LoRA 槽位 1 的权重强度。', hint: '1.0 是满强度。降到 0.6-0.8 可以减轻 LoRA 带来的塑料感。' },
  LoRA1启用: { zh: 'LoRA 槽位 1 是否启用。', hint: '默认 true —— 但只有「启用LoRA」总开关打开才真正生效。' },
  LoRA2: { zh: 'LoRA 槽位 2 的模型文件。', hint: '空着即可。' },
  LoRA2强度: { zh: 'LoRA 槽位 2 的权重强度。', hint: '同上。' },
  LoRA2启用: { zh: 'LoRA 槽位 2 是否启用。', hint: '默认 true 但没有选文件时不会生效。' },
  LoRA3: { zh: 'LoRA 槽位 3 的模型文件。', hint: '空着即可。' },
  LoRA3强度: { zh: 'LoRA 槽位 3 的权重强度。', hint: '同上。' },
  LoRA3启用: { zh: 'LoRA 槽位 3 是否启用。', hint: '同上。' },
  LoRA4: { zh: 'LoRA 槽位 4 的模型文件。', hint: '空着即可。' },
  LoRA4强度: { zh: 'LoRA 槽位 4 的权重强度。', hint: '同上。' },
  LoRA4启用: { zh: 'LoRA 槽位 4 是否启用。', hint: '默认 false。' },
  LoRA5: { zh: 'LoRA 槽位 5 的模型文件。', hint: '空着即可。' },
  LoRA5强度: { zh: 'LoRA 槽位 5 的权重强度。', hint: '同上。' },
  LoRA5启用: { zh: 'LoRA 槽位 5 是否启用。', hint: '默认 false。' },
  LoRA6: { zh: 'LoRA 槽位 6 的模型文件。', hint: '空着即可。' },
  LoRA6强度: { zh: 'LoRA 槽位 6 的权重强度。', hint: '同上。' },
  LoRA6启用: { zh: 'LoRA 槽位 6 是否启用。', hint: '默认 false。' },
  LoRA7: { zh: 'LoRA 槽位 7 的模型文件。', hint: '空着即可。' },
  LoRA7强度: { zh: 'LoRA 槽位 7 的权重强度。', hint: '同上。' },
  LoRA7启用: { zh: 'LoRA 槽位 7 是否启用。', hint: '默认 false。' },
  LoRA8: { zh: 'LoRA 槽位 8 的模型文件。', hint: '空着即可。' },
  LoRA8强度: { zh: 'LoRA 槽位 8 的权重强度。', hint: '同上。' },
  LoRA8启用: { zh: 'LoRA 槽位 8 是否启用。', hint: '默认 false。' },

  /* ======================== H 小脸修复（14） ======================== */
  单人小脸修复: {
    zh: '单人镜头里的人脸增强：检测到小脸后单独跑一轮高分辨率修复。',
    hint: '远景、全身镜头脸糊了才开。会增加约 20-40% 耗时。',
  },
  多人小脸修复: {
    zh: '多人镜头里的人脸增强。',
    hint: '和单人版互斥，按镜头里的人数选。配合下面的「人物N身份参考」把脸锁到参考图。',
  },
  人物1身份参考: { zh: '第 1 个人物的身份要用哪个图片槽位的脸。', hint: '默认 图片1。角色卡填充后这里会自动指向正确的槽位。' },
  人物2身份参考: { zh: '第 2 个人物的身份要用哪个图片槽位的脸。', hint: '默认 图片2。' },
  人物1图中位置: { zh: '第 1 个人物在画面里的位置（用于定位是哪张脸）。', hint: '「自动（最大脸）」通常够用。多人拥挤时手动指定更准。' },
  人物2图中位置: { zh: '第 2 个人物在画面里的位置。', hint: '同上。' },
  全局修复: {
    zh: '全局修复总开关：整帧再跑一轮低强度重绘来提细节。',
    hint: '追求成片画质时可以开。耗时 +30% 左右，容易和「小脸修复」叠加变慢。',
  },
  全局修复倍率: { zh: '全局修复的放大倍数。', hint: '1.5 是默认。2.0 最清晰也最慢最吃显存。' },
  全局修复LoRA模式: { zh: '全局修复用哪套 LoRA。', hint: '「专用4步LoRA」最快；「继承主生成LoRA」一致性更好；「不使用LoRA」最慢。' },
  全局修复LoRA: { zh: '全局修复的 LoRA 文件（当前只有自动选择）。', hint: '只有一个选项。' },
  全局修复LoRA强度: { zh: '全局修复 LoRA 的权重强度。', hint: '0.75 是默认。调高会放大修复痕迹。' },
  全局修复步数: { zh: '全局修复的采样步数。', hint: '4 步配合专用 LoRA。不用 LoRA 时要抬到 10+。' },
  全局修复降噪: { zh: '全局修复的重绘幅度。', hint: '0.28 是保守值（只补细节）。超过 0.4 会开始改动动作和表情。' },
  全局修复范围: {
    zh: '修复作用在画面的哪个区域。',
    hint: '「全画面双区」最全面。「仅第一区」在横图是左半边、竖图是上半边 —— 做半身特写时用得上。',
  },

  /* ======================== I 潜空间续写（11） ======================== */
  context_length: {
    zh: '续写时复用上一段末尾多少帧作为上下文。',
    hint: '22 是默认。⚠️ 这个窗口越长，被「上一段实际生成的内容」钉住的帧就越多'
      + '（30s/6 段时 56 帧占目标片段的 32%~45%），做换人时会拖着重绘回源角色。'
      + '39/56 接缝更顺但对换人是负收益；5 太短接缝明显。',
  },
  audio_context_length: {
    zh: '续写时复用上一段末尾多少个音频 latent 步。',
    hint: '换算关系是 1 像素帧 = 40/24 = 5/3 个音频步，所以 22 帧对应 37 步。'
      + '插件会自动按 context_length 换算，一般不用手改。',
  },
  启用续写上下文加噪: {
    zh: '给续写上下文注入锥形噪声：损坏上一段的外观、保留它的运动。',
    hint: '换人链的核心抗漂移开关。干净的上下文会让模型原样拷贝上一段的长相，'
      + '而换人恰恰要求脸必须变 —— 加噪逼模型从身份参考重新合成。'
      + '叙事续写（非换人）要保持干净上下文，别开。',
  },
  续写加噪强度: {
    zh: '加噪窗口内的平坦注入强度。',
    hint: '0.45 是社区在 H3 换人链上验证的值。调低保留更多上一段外观（更容易漂）；'
      + '调高更强迫模型回到参考图（可能丢动作锐度）。',
  },
  续写加噪末档强度: {
    zh: '贴着接缝的那一步的注入强度，必须 <= 强度。',
    hint: '0.10 是验证值。这一步是模型「紧跟着往下演」的起点，'
      + '它越干净，上一段的外观就越容易被抄过去 —— 所以锥形是必要的。',
  },
  续写加噪斜坡步数: {
    zh: '末尾多少个 latent 步从「强度」线性降到「末档强度」。',
    hint: '2 步约等于 3 个像素帧，对应社区配方的斜坡长度。',
  },
  启用续写音频精修: {
    zh: '续写段的音频额外做一轮精修，消除接缝处的爆音/咔哒声。',
    hint: '续写批次建议开着。会多几秒耗时。',
  },
  续写音频降噪强度: { zh: '音频精修的重绘幅度。', hint: '0.3 是默认。接缝处还有杂音可升到 0.4。' },
  续写音频精修步数: { zh: '音频精修的采样步数。', hint: '4 步够用。' },
  续写音频采样器: { zh: '音频精修用的采样器。', hint: 'euler 稳定。', flag: 'advanced' },
  续写音频调度器: { zh: '音频精修用的调度器。', hint: 'simple。', flag: 'advanced' },

  /* ======================== J 音频驱动（13） ======================== */
  启用锁音频: {
    zh: '锁音频：把参考音频原封不动地作为输出音轨。',
    hint: '⚠️ 与潜空间续写互斥（会破坏原音轨时间）。做口型对齐 / 音乐卡点时才用。',
  },
  开启音频驱动模式: {
    zh: '音频驱动：用音频的打点信息驱动画面节奏与分段。',
    hint: '⚠️ 与潜空间续写互斥。需要配合下面的音频驱动文件/打点参数。',
  },
  音频驱动文件: { zh: '驱动用的音频文件路径。', hint: '配合音频驱动模式使用。', flag: 'advanced' },
  音频驱动打点: { zh: '音频打点时间戳数组（JSON）。', hint: '由工坊自动生成，一般不用手填。', flag: 'advanced' },
  音频驱动分段图片: { zh: '每段对应的参考图映射（JSON）。', hint: '自动生成。', flag: 'advanced' },
  音频驱动分段分镜: { zh: '每段对应的分镜描述（JSON）。', hint: '自动生成。', flag: 'advanced' },
  音频驱动创意: { zh: '音频驱动时的创意方向描述。', hint: '想控制分段画面风格时填。', flag: 'advanced' },
  音频驱动排除范围: { zh: '不参与驱动的音频时间段（JSON）。', hint: '前奏/尾奏不想被驱动时用。', flag: 'advanced' },
  音频驱动当前起点: { zh: '当前处理到的音频起点（秒）。', hint: '分批处理时自动推进。', flag: 'advanced' },
  音频驱动当前终点: { zh: '当前处理到的音频终点（秒）。', hint: '同上。', flag: 'advanced' },
  恒定触发词: { zh: '每段提示词里都会附带的固定触发词。', hint: '用来固化角色/画风，省得每段重复写。', flag: 'advanced' },
  空5分钟时间轴模式: { zh: '5 分钟长音频的空时间轴模式。', hint: '与潜空间续写互斥。长音频项目才用。', flag: 'advanced' },
  启用TAEH3彩色预览: { zh: '用 TAE 快速解码彩色预览（比完整 VAE 解码快很多）。', hint: '调试时开，成片不要开（画质是近似的）。', flag: 'advanced' },

  /* ======================== K 预览与超分（41） ======================== */
  启用实时预览: {
    zh: '采样过程中输出中间帧预览。',
    hint: '调试构图时开（配合 quality-preview 预设），正式出片关掉能省一点时间。',
  },
  实时预览最长边: { zh: '预览图的最大边长。', hint: '512 够看。调大只是预览更清楚，不影响成片。' },
  实时预览帧数: { zh: '每次预览输出多少帧。', hint: '12 是默认。' },
  实时预览帧率: { zh: '预览的播放帧率。', hint: '8fps 够用。' },
  实时预览JPEG质量: { zh: '预览图 JPEG 压缩质量。', hint: '75 平衡。' },
  启用RTX视频超分: {
    zh: 'NVIDIA RTX Video Super Resolution 后处理超分。',
    hint: '⚠️ 需要 ComfyUI 装 Nvidia_RTX_Nodes 扩展，本机未装，开了会报错。保持关闭。',
    flag: 'banned',
  },
  RTX缩放方式: { zh: 'RTX 超分按倍数还是按目标尺寸。', hint: 'RTX 节点不可用。', flag: 'banned' },
  RTX缩放倍数: { zh: 'RTX 超分的倍数（1-4）。', hint: 'RTX 节点不可用。', flag: 'banned' },
  RTX目标宽度: { zh: 'RTX 超分的目标宽度。', hint: 'RTX 节点不可用。', flag: 'banned' },
  RTX目标高度: { zh: 'RTX 超分的目标高度。', hint: 'RTX 节点不可用。', flag: 'banned' },
  RTX质量: { zh: 'RTX 超分质量档（LOW/MEDIUM/HIGH/ULTRA）。', hint: 'RTX 节点不可用。', flag: 'banned' },
  启用TRT视频VAE: {
    zh: 'TensorRT 加速的 VAE 编解码。',
    hint: '⚠️ 需要预先编译好的 TRT 引擎，本机未编译，开了会报错。保持关闭。',
    flag: 'banned',
  },
  TRT视频解码引擎: { zh: 'TRT 解码引擎名（未启用时必须是 None）。', hint: '插件已强制设为 None。', flag: 'banned' },
  TRT视频编码引擎: { zh: 'TRT 编码引擎名（未启用时必须是 None）。', hint: '插件已强制设为 None。', flag: 'banned' },
  DLSS超分模式: {
    zh: 'NVIDIA DLSS 超分：关闭 / 图像批次超分 / 视频超分。',
    hint: '⚠️ 需要 DLSS Frame Interpolation 插件，本机未装，开了会报错。保持关闭。',
    flag: 'banned',
  },
  启用DLSS补帧: { zh: 'DLSS 补帧（提升输出帧率）。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_upscale_mode: { zh: 'DLSS 视频超分的倍率档位（1×-3×）。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_require_neural_upscaling: { zh: '强制要求神经超分（否则报错而不是静默降级）。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_nr_preset: { zh: 'DLSS 降噪预设。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_nr_style: { zh: 'DLSS 降噪风格。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_nr_intensity: { zh: 'DLSS 降噪强度。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_local_tone_strength: { zh: 'DLSS 局部影调增强强度。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_local_structure_strength: { zh: 'DLSS 局部结构增强强度。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_skin_structure_strength: { zh: 'DLSS 皮肤结构增强强度（-1 = 自动）。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_automatic_mask: { zh: 'DLSS 自动遮罩。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_dlss_model_preset: { zh: 'DLSS 模型预设（J/K/L/M）。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_encoding_quality: { zh: 'DLSS 输出编码质量。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_video_codec: { zh: 'DLSS 输出视频编码器。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_container: { zh: 'DLSS 输出封装格式。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_rename: { zh: 'DLSS 输出文件命名策略。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_custom_suffix: { zh: 'DLSS 输出文件名后缀。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_hdr_mode: { zh: 'DLSS 输出 HDR。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_video_output_detail_strength: { zh: 'DLSS 输出细节强度。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_fg_output_fps: { zh: 'DLSS 补帧后的目标帧率。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_fg_dlss_engine: { zh: '补帧引擎（Auto/Native DLSSG/Cascade）。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_fg_encoding_quality: { zh: '补帧输出编码质量。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_fg_video_codec: { zh: '补帧输出视频编码器。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_fg_container: { zh: '补帧输出封装格式。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_fg_rename: { zh: '补帧输出命名策略。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_fg_custom_suffix: { zh: '补帧输出文件名后缀。', hint: 'DLSS 插件不可用。', flag: 'banned' },
  DLSS_fg_hdr_mode: { zh: '补帧输出 HDR。', hint: 'DLSS 插件不可用。', flag: 'banned' },

  /* ======================== L 南风采样器（5） ======================== */
  采样器: {
    zh: '主采样器（Sigma 更新算法）。',
    hint: '默认 er_sde，极稳。用 DMAD 蒸馏 LoRA 时必须切 lcm。南风自研的「南风采样器」也可以选，会启用下面 4 个 ER 参数。',
  },
  南风ER_solver_type: {
    zh: '南风 ER 求解器类型：ER-SDE / Reverse-time SDE / ODE。',
    hint: '**只有采样器选了「南风采样器」才生效**。ER-SDE 是默认且最稳；ODE 更确定但会损失动感。',
    flag: 'advanced',
  },
  南风ER_max_stage: {
    zh: 'ER 求解器的最大阶数（1-3）。',
    hint: '3 是默认（最高精度）。2 省一点时间。只在南风采样器下生效。',
    flag: 'advanced',
  },
  南风ER_eta: {
    zh: 'ER 求解器的噪声强度系数。',
    hint: '1.0 是默认。调大→更随机更有动感，调小→更保守更稳。只在南风采样器下生效。',
    flag: 'advanced',
  },
  南风ER_s_noise: {
    zh: 'ER 求解器每步注入的噪声倍率。',
    hint: '1.0 是默认。>1 更活但易崩；<1 更平滑。只在南风采样器下生效。',
    flag: 'advanced',
  },
});

/** 取单个参数的说明，缺失时返回 null（而不是抛错） */
export function paramDoc(name) {
  return PARAM_DOCS[name] ?? null;
}

/** 取分组说明 */
export function groupDoc(id) {
  return GROUP_DOCS[id] ?? null;
}

/** 统计：哪些参数是死参数 / 被禁用 */
export function deadParamNames() {
  return Object.entries(PARAM_DOCS)
    .filter(([, d]) => d.flag === 'dead' || d.flag === 'banned')
    .map(([k]) => k);
}
