# Lead 独立核实笔记（截至 2026-11-03）

> 用途：主报告交叉核验用。仅记录 Lead 亲自通过 web_search / web_fetch 核实到的信息，标注来源。
> 状态：持续更新。

## 1. 榜单快照（Artificial Analysis，2026-11-03 抓取）

### AA-Video-T2V v2.1（文生视频，含原生音频，Elo，取前 14 + 中国模型）
| 排名 | 模型 | Elo | 发布 | API 价格 |
|---|---|---|---|---|
| 1 | Wan 3.0（阿里） | 1172 | 2026-08 | $12.00/min |
| 2 | Utopai X（Utopai Studios） | 1169 | 2026-09 | 无 API |
| 3 | MiniMax H3 (768p) | 1160 | 2026-07 | $4.80/min |
| 4 | FLUX 3 Max | 1156 | 2026-10 | $4.35/min |
| 5 | Dreamina Seedance 2.5（字节） | 1155 | 2026-07 | $34.12/min |
| 6 | HeyGen Video 1 | 1153 | 2026-10 | $2.40/min |
| 7 | MiniMax H3 Max（fal 后训练） | 1148 | 2026-08 | $9.60/min |
| 8 | FLUX 3 | 1139 | 2026-07 | $17.40/min |
| 9 | Dreamina Seedance 2.0 | 1136 | 2026-03 | $22.45/min |
| 10 | Gemini Omni Flash 1.1（Google） | 1129 | 2026-08 | $9.12/min |
| 11 | P-Video-2-Pro | 1127 | 2026-09 | $5.70/min |
| 12 | Agnes-Video-2.5 | 1067 | 2026-08 | $2.40/min |
| 13 | Grok Imagine Video 1.5（xAI） | 1058 | 2026-05 | $15.00/min |
| 14 | HappyHorse-1.1（阿里系，见下） | 1050 | 2026-06 | $10.80/min |
| 18 | Kling 3.0 Omni 1080p Pro（快手） | 1022 | 2026-02 | $8.40/min |
| 19 | Kling 3.0 1080p Pro（Elo 锚点 1000） | 1000 | 2026-02 | $10.08/min |
| 21 | PixVerse V6（爱诗） | 981 | 2026-03 | $6.90/min |
| 22 | Veo 3.1（Google） | 961 | 2026-01 | $24.00/min |
| 27 | Vidu Q3 Pro（生数） | 938 | 2026-01 | $7.20/min |
| 29 | LTX-2.3 Pro（Lightricks） | 884 | 2026-03 | $4.80/min |
| 31 | Boreal | 830 | 2026-09 | $2.69/min |

来源：https://artificialanalysis.ai/video/leaderboard/text-to-video （2026-11-03 抓取）

### AA-Video-I2V v2.1（图生视频，含音频，Elo）
1 Dreamina Seedance 2.5 1157；2 Utopai X 1147；3 Dreamina Seedance 2.0 1137；4 MiniMax H3 768p 1131；5 Hyperflow H3（H3 蒸馏版，开源权重）1124；6 HeyGen Video 1 1122；7 P-Video-2-Pro 1119；8 MiniMax H3 Max 1118；9 Wan 3.0 1111；10 Agnes-Video-2.5 1102；11 FLUX 3 1070；12 FLUX 3 Max 1067；13 Grok Imagine 1.5 1051；14 Gemini Omni Flash 1.1 1046；15 HappyHorse-1.1 1037；17 Kling 3.0 Omni 1002；18 Kling 3.0 1000；20 PixVerse V6 958；21 Veo 3.1 955；23 Vidu Q3 Pro 931；25 LTX-2.5 Fast 917；26 LTX-2.5 Pro 913。
来源：https://artificialanalysis.ai/video/leaderboard/image-to-video

### 榜单结构
- Artificial Analysis 2026-09 重构 AA-Video：拆分为 T2V（含音频）/T2V-Silent/I2V（含音频）/I2V-Silent，并新增"视频编辑"榜（来源：https://alphasignal.ai/news/artificial-analysis-rebuilds-aa-video-to-rank-models-by-real-world-jobs ）。
- 榜单 FAQ（T2V 页）：HeyGen Video 1 以 1143 Elo 居 T2V-Silent 第一；MiniMax H3 (768p) 1120 为开放权重第一，其后 LTX-2.5 Pro/Fast 927。
- I2V 页 FAQ：Hyperflow H3 以 1118 居 I2V-Silent 开放权重第一，其后 MiniMax H3 1110、LTX-2.5 Fast 919。

## 2. 开源/闭源关键事实

- **MiniMax H3**：2026-07 发布，2026-08 开放权重；330 亿参数统一多模态（文本/图像/音频/视频）。开源一个月 HuggingFace 下载 >2400 万次，300+ 公开衍生模型。许可证《MiniMax H3 Community License》：商用年收入 >2000 万美元需书面授权。衍生：fal 训练 H3 Max；Pika 2026-10-29 发布基于 H3 的 H3 Flex；英伟达基于 H3 发布 Open-H3-Regenerate-2K（低分辨率草稿+精修+三步去噪重生成 2K）、StreamRender-H3、快速视频解码器。H3 曾登顶 AA 视频编辑榜、文生视频第2、图生视频第3（发布时口径）；报道称 2026-09 在 Arena 图生视频榜以 1495 分第一（该分数与 AA 现版 Elo 不可直接比较）。
  来源：https://eu.36kr.com/zh/p/4052671124575367 （2026-11-03）；https://dayaai.com/news/story/3546 ；https://kompozy.io/news/minimax-h3-first-open-model-tops-video-ranking
- **Hyperflow H3**：H3 的少步蒸馏/加速版本（LoRA 等），2026-09 开源发布在 HuggingFace（drbaph/Hyperflow-Comfyui），ComfyUI 节点，int8；AA I2V-Silent 开放权重第一。
  来源：https://huggingface.co/drbaph/Hyperflow-Comfyui
- **Wan 3.0（阿里通义）**：2026-08-06 公测、2026-08-24 正式发布；仅托管 API，**未开放权重/无代码仓库/无许可证**（截至 2026-08-31 第三方核查）。Wan 系列 2.1/2.2 曾开源。
  来源：https://www.orcarouter.ai/zh-CN/blog/wan-3-0-vs-minimax-h3 ；https://wan3pro.video/wan-3-0-open-source
- **Utopai X**：Utopai Studios（影视工作室）自研视频模型，集成在其 PAI 制作平台，2026-09 发布，无公开 API。
  来源：https://www.utopaistudios.com/en/blog/introducing-the-all-new-pai-and-utopai-x
- **HappyHorse**：2026-04 空降 AA 榜首后被阿里认领（新浪财经 2026-04-10）；HappyHorse-1.0 1374 Elo 曾登顶 T2V（无音频）榜。
  来源：https://finance.sina.com.cn/wm/2026-04-10/doc-inhtywee0313594.shtml
- **Sora 3**：截至 2026-01 未官宣，网络传闻均属推测（WaveSpeed 博客明确"未确认"）。
  来源：https://wavespeed.ai/blog/ru/posts/openai-sora-3-what-to-expect-from-the-next-generation-video-model/

## 3. 市场与C端数据（待与 platform-market 交叉）

- Sora App 热度回落：2026-01 移动端新增下载约 120 万次（环比 -45%，连续第二个月下滑），应用内消费 36.7 万美元（较 2025-12 峰值 54 万美元 -32%）。
  来源：https://www.bianews.com/news/details?id=231152 ；https://phone.cnmo.com/news/803539.html （Appfigures 数据）
- AI短剧（国内）：2026 年市场规模预计突破 400 亿元（同比 +138%），用户超 6 亿，日均上新约 1500 部；但播放破亿率仅 0.48%、98.7% 项目亏损；AI 仿真人短剧在漫剧百强榜占比从 2025 年 7% 升至 2026H1 60%+；海外 AI 剧市场约 6.5 亿美元（DataEye 研究院）。
  来源：https://stcn.com/article/detail/4221237.html ；https://m.thepaper.cn/newsDetail_forward_33503141
- 全球 "AI video generator" 市场（窄口径）：2025 年 8.5 亿美元 → 2026 年 10.4 亿美元（CAGR 22.4%），2030 年预计 20.7 亿美元。
  来源：https://www.researchandmarkets.com/reports/6227059/ai-video-generator-market-report ；https://www.gii.tw/report/tbrc1970100-artificial-intelligence-ai-video-generator-global.html

## 4. 2026年重大行业动态（Lead 已核实）

### 4.1 Sora：关停与拟重启
- 2026-03 OpenAI 宣布关闭 Sora 业务；Sora 网页端与 App 于 2026-04-26 停止服务，相关 API 于 2026-09-24 关闭。
- 2026-10 报道：OpenAI 正讨论以股权合作方式把 Sora 技术授权给一家新创 AI 视频公司（由好莱坞制片人 Jeffrey Katzenberg、Sora 前研究负责人 Bill Peebles、前 Dropbox CFO Sujay Jaswa 创立），转向好莱坞专业影视制作市场；此前迪士尼 10 亿美元潜在投资未能落地。
- Sora App 生前数据（Appfigures）：2026-01 移动端新增下载约 120 万（环比 -45%，连续第二个月下滑），应用内消费 36.7 万美元（较 2025-12 峰值 54 万美元 -32%）。
- 来源：https://news.pedaily.cn/202610/570141.shtml ；https://www.chinaz.com/ainews/31580.shtml ；https://www.bianews.com/news/details?id=231152

### 4.2 通用大模型"跨界"视频（Vibe Video / Agent 导演）
- Claude Opus 5.5（2026）通过写代码（Remotion 框架等）+ 调工具 + 开源语音/配乐合成视频，形成 "Vibe Video" 创作范式；案例：一句指令产出 2 分 16 秒西方文明史短片、两天播放破千万；创作者用约 7400 行 Remotion 代码 1 小时产出 3 分钟 AI 发展史视频；单条宣传片成本可低至约 2 美元；GitHub awesome-opus5-5-videos 收录 400+ 作品。
- OpenAI GPT-6 Astra（2026-09-28 发布，面向 Plus/Pro/Business/Enterprise 及 API/Azure/AWS Bedrock）：可操作 Blender/Unreal Engine 等 3D 软件，扮演"导演+制片"，端到端完成调研、脚本、配音、数字人出镜、剪辑、音效。
- 意义：视频生产从"概率性生成"转向"确定性编程/Agent 编排"；通用模型向制作全链路渗透，专业视频模型转向工作流与垂直场景壁垒。
- 来源：https://www.tmtpost.com/baidu/8160182.html ；https://www.jiemian.com/article/15164037.html ；https://openai.com/zh-Hant-HK/index/gpt-6-astra/ ；https://www.donews.com/article/detail/5450/109150.html

### 4.3 可灵融资与商业化
- 2026-07-02 快手公告：可灵 AI 完成近 30 亿美元首轮融资，投后估值 180 亿美元（CPE源峰、国方创投、BlueFive、腾讯、中信证券、中关村科学城基金等联合领投），计划 2031 年前 IPO。
- 商业化：2026Q1 单季营收超 6.5 亿元（同比 +300%）；ARR 从 2025-03 的 1 亿美元升至 2026-03 近 5 亿美元；截至 2026-06 全球用户破 1 亿、企业客户近 5 万家；2025 全年 + 2026Q1 累亏超 20 亿元；预计 2028Q4 单季盈亏平衡。
- 来源：http://www.xinhuanet.com/digital/20260703/bc3f78f1564842758c0cb82e9e4e8aa5/c.html ；https://news.ifeng.com/c/8uSXXUcNMcM ；https://www.donews.com/article/detail/5450/109150.html

### 4.4 影视资本与生态
- Netflix 以 5.87 亿美元收购 AI 影视制作平台 InterPositive；詹姆斯·卡梅隆加入 Stability AI 董事会；史蒂文·索德伯格称新片将大量使用 AI。
- 字节 2026 资本开支据报超 2000 亿元（较原计划 1600 亿 +25%）；快手 2026 计划资本开支 260 亿元。
- 字节 Agent 工作台：剪映 Hub、剪映助手、小云雀 Agent、漫剧创作工具；MiniMax Design 多智能体创作工作台；可灵 All-in-One 工作流。
- 来源：https://www.donews.com/article/detail/5450/109150.html

### 4.5 即梦调价（C端价格战/算力成本）
- 2026-03-26（Sora 关停次日）即梦取消高级会员 4 折优惠，15 秒视频所需积分 45→120；4-03 上线 Seedance 2.0 VIP 加速通道（15 秒 210 积分）；4-08 全面调价、会员权益与积分额度缩水。
- 火山方舟 Seedance 2.0 Mini 单秒生成成本约 0.5 元。
- 来源：https://www.donews.com/article/detail/5450/109150.html

## 5. 其他线索（待深挖/交叉）
- Pika 2026-10-29 发布 H3 Flex（基于 MiniMax H3 后训练、压缩生成步数）——硅谷公司反向采用中国开源基座。
- 2026-05 Google 发布 Gemini Omni（统一多模态，含视频）。
- AI 视频广告工具：Creatify、Arcads、Topview AI 等 UGC 广告/URL-to-Video 方向。
- 秒创AI（电商主图视频/模特换装，覆盖淘宝/京东/拼多多/抖音小店/TikTok Shop）。
