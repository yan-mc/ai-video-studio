# 静态提取 vs 运行时实测 一致性核对

对比对象：`analysis\闭源预演引擎\artifacts\data\*.json`（从内嵌 JS 求值提取） vs `analysis\dynamic\director-probe\catalog\*.json`（Lead 运行时 GET /api/project 的 catalog 字段；`director-probe` 为既有技术目录名，保留原样）

| 数据表 | 静态条数 | 动态条数 | 严格一致(JSON) | 首尾 ID |
| --- | --- | --- | --- | --- |
| action_templates.json | 58 | 58 | ✅ 是 | ['stand', 'exit-car'] / ['stand', 'exit-car'] |
| camera_move_templates.json | 28 | 28 | ✅ 是 | ['static', 'roll-right'] / ['static', 'roll-right'] |
| element_presets_actors.json | 7 | 7 | ✅ 是 | ['person', 'crowd-5'] / ['person', 'crowd-5'] |
| element_presets_props.json | 10 | 10 | ✅ 是 | ['table', 'crate'] / ['table', 'crate'] |
| performance_profiles.json | 8 | 8 | ✅ 是 | ['neutral', 'casual'] / ['neutral', 'casual'] |

动态 catalog 类目分布：actions={'基础': 5, '走位': 8, '视线': 6, '交流': 7, '手部': 11, '姿态': 8, '情绪': 4, '专项': 9}（共 58 条 / 8 类）；cameras={'稳定': 1, '推拉': 5, '横移': 2, '摇摄': 6, '升降': 4, '弧线': 3, '跟拍': 3, '表现性': 4}（共 28 条 / 8 类）

默认工程（动态 default-project.json）：name='Untitled Previs' aspect='16:9' version=1 elements=2 plans=1 shots=4 duration=15.0s
默认工程 element kinds=['mannequin', 'mannequin']；shot 相机 Move=['static', 'static', 'static', 'static']；actor poses=['stand', 'stand']

runtime 实测（runtime-sample.json）键：['fps', 'duration_sec', 'current_frame', 'current_time_sec', 'evaluated_frame']
实测 runtime={'fps': 24, 'duration_sec': 15, 'current_frame': 0, 'current_time_sec': 0}
evaluated_frame 键=['shot', 'localTimeSec', 'camera', 'elements']；camera 键=['position', 'target', 'fov', 'rollDeg']；elements 数=2

agent_rules 实测 4 条：
- Use the exact element, shot, action and keyframe IDs returned here.
- All timeline writes use integer frames at 24fps.
- Never override a manually locked item without explicit user confirmation.
- Run director_validate after a multi-step edit.