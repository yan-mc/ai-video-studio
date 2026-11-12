/**
 * H3 提示词工作台 —— 把官方六段式/三段式规范做成可视化编辑器。
 *
 * 解决的痛点：手写 H3 提示词结构复杂（STYLE/RULE/subject/CHARACTER/
 * summary/retention/SCENE/MOTION 八段），容易漏字段、忘记英文画风、
 * 忘写音效字段。本页做三件事：
 *  1. 画风库一键套用（9 种，英文原文）
 *  2. 角色卡编辑（外观/性格/音色，音色只绑定一次）
 *  3. 分镜表编辑 + 实时编译预览 + 超限警告
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../api/client';
import {
  Alert, Badge, Button, Field, Icon, Input, Loading, Page, Panel, Select, Tabs, Textarea, useToast,
} from '../ui';

interface StylePreset {
  id: string; name: string; category: string; en: string; ban: string;
  best: string; changesAppearance: boolean;
}
interface H3Mode { id: string; name: string; hint: string; inputs: number }
interface Limits {
  durationSec: { min: number; max: number; warnAbove: number };
  fps: number; refImages: number; refVideos: number; refAudios: number;
  totalRefs: number; promptMaxChars: number;
}
interface Subject {
  id: string; name: string; pictureIndex: number; gender: string;
  heightCm: number | ''; traits: string; personality: string; voiceDesc: string;
}
interface Scene {
  startSec: number; endSec: number; shotSize: string; action: string;
  camera: string; sound: string; speaker: string; line: string; emotion: string;
}
interface CompileResult { prompt: string; mode: string; chars: number; warnings: string[] }

const SHOT_SIZES = ['大远景', '远景', '全景', '中景', '近景', '特写', '大特写'];
const LANGS = ['中文', '日语', 'English'];

type TabKey = 'style' | 'cast' | 'scenes' | 'output';

export function PromptPage() {
  const toast = useToast();

  const [styles, setStyles] = useState<StylePreset[]>([]);
  const [modes, setModes] = useState<H3Mode[]>([]);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('style');
  const [busy, setBusy] = useState(false);

  // 表单
  const [mode, setMode] = useState('ref2va');
  const [styleId, setStyleId] = useState('ghibli');
  const [customStyle, setCustomStyle] = useState('');
  const [durationSec, setDurationSec] = useState('5');
  const [sceneLayout, setSceneLayout] = useState('');
  const [summary, setSummary] = useState('');
  const [soundscape, setSoundscape] = useState('');
  const [music, setMusic] = useState('N/A');
  const [lang, setLang] = useState('中文');

  const [subjects, setSubjects] = useState<Subject[]>([
    { id: 'S1', name: '角色1', pictureIndex: 1, gender: 'FEMALE', heightCm: '', traits: '', personality: '', voiceDesc: '' },
  ]);
  const [scenes, setScenes] = useState<Scene[]>([
    { startSec: 0, endSec: 2.5, shotSize: '中景', action: '', camera: '', sound: '', speaker: 'S1', line: '', emotion: '' },
  ]);

  const [result, setResult] = useState<CompileResult | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const m = await api.promptMeta() as { styles: StylePreset[]; modes: H3Mode[]; limits: Limits };
        setStyles(m.styles ?? []);
        setModes(m.modes ?? []);
        setLimits(m.limits ?? null);
      } catch (e) {
        toast.error(String((e as Error)?.message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const buildInput = useCallback(() => ({
    mode,
    styleId: customStyle.trim() ? undefined : styleId,
    styleEn: customStyle.trim() || undefined,
    durationSec: Number(durationSec) || 5,
    sceneLayout,
    summary: summary || undefined,
    overall_soundscape: soundscape,
    non_diegetic_music: music || 'N/A',
    subjects: subjects.map((s) => ({
      ...s,
      heightCm: s.heightCm === '' ? null : Number(s.heightCm),
    })),
    references: {
      images: subjects.map((s) => `picture_${s.pictureIndex}.png`),
      videos: [],
      audios: [],
    },
    shots: scenes.map((s) => ({
      startSec: s.startSec,
      endSec: s.endSec,
      shotSize: s.shotSize,
      action: s.action,
      camera: s.camera,
      sound: s.sound,
      dialogue: s.line ? { speaker: s.speaker, text: s.line, lang, emotion: s.emotion } : null,
    })),
  }), [mode, styleId, customStyle, durationSec, sceneLayout, summary, soundscape, music, subjects, scenes, lang]);

  const compile = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api.promptCompile(buildInput()) as CompileResult;
      setResult(r);
      setTab('output');
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }, [buildInput, toast]);

  const currentStyle = useMemo(
    () => styles.find((s) => s.id === styleId) ?? null,
    [styles, styleId],
  );

  function addSubject() {
    const n = subjects.length + 1;
    setSubjects((prev) => [...prev, {
      id: `S${n}`, name: `角色${n}`, pictureIndex: n, gender: 'FEMALE',
      heightCm: '', traits: '', personality: '', voiceDesc: '',
    }]);
  }
  function patchSubject(i: number, patch: Partial<Subject>) {
    setSubjects((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  }
  function addScene() {
    const last = scenes[scenes.length - 1];
    const start = last ? last.endSec : 0;
    setScenes((prev) => [...prev, {
      startSec: start, endSec: start + 2.5, shotSize: '中景',
      action: '', camera: '', sound: '', speaker: 'S1', line: '', emotion: '',
    }]);
  }
  function patchScene(i: number, patch: Partial<Scene>) {
    setScenes((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  }

  async function copyPrompt() {
    if (!result?.prompt) return;
    try {
      await navigator.clipboard.writeText(result.prompt);
      toast.ok('已复制到剪贴板');
    } catch {
      toast.error('复制失败，请手动选择');
    }
  }

  if (loading) return <Page title="H3 提示词工作台"><Loading text="载入中" /></Page>;

  return (
    <Page
      title="H3 提示词工作台"
      subtitle="官方六段式 · 9 种画风 · 实时编译"
      actions={
        <>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void compile()} disabled={busy}>
            {busy ? '编译中…' : '编译预览'}
          </Button>
          <Button variant="primary" icon={<Icon name="check" size={15} />} onClick={() => void copyPrompt()} disabled={!result?.prompt}>
            复制提示词
          </Button>
        </>
      }
    >
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        <Tabs<TabKey>
          items={[
            { value: 'style', label: '① 画风与模式' },
            { value: 'cast', label: '② 角色定义' },
            { value: 'scenes', label: '③ 分镜表' },
            { value: 'output', label: '④ 编译结果' },
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel="提示词工作台步骤"
        />

        {tab === 'style' ? (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel title="生成模式">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                {modes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className="jz-card"
                    style={{
                      padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                      borderColor: mode === m.id ? 'var(--jz-accent)' : undefined,
                      borderWidth: mode === m.id ? 2 : 1,
                    }}
                  >
                    <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                      <b className="jz-sm">{m.name}</b>
                      {mode === m.id ? <Badge tone="ok">选中</Badge> : null}
                    </div>
                    <div className="jz-xs jz-muted" style={{ marginTop: 4 }}>{m.hint}</div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title={`画风库（${styles.length} 种）`}>
              <div className="jz-sm jz-muted" style={{ marginBottom: 8 }}>
                画风描述必须用英文（视觉模型对英文风格词响应更精准），其余部分用中文。
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {styles.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setStyleId(s.id); setCustomStyle(''); }}
                    className="jz-card"
                    style={{
                      padding: '9px 11px', textAlign: 'left', cursor: 'pointer',
                      borderColor: styleId === s.id && !customStyle ? 'var(--jz-accent)' : undefined,
                      borderWidth: styleId === s.id && !customStyle ? 2 : 1,
                    }}
                  >
                    <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                      <b className="jz-sm">{s.name}</b>
                      {s.changesAppearance ? <Badge tone="warn">改外观</Badge> : null}
                    </div>
                    <div className="jz-xs jz-muted" style={{ marginTop: 3 }}>{s.category}</div>
                    <div className="jz-xs jz-muted">{s.best}</div>
                  </button>
                ))}
              </div>
              <Field label="自定义画风（英文，写了就覆盖预设）">
                <Textarea value={customStyle} onChange={(e) => setCustomStyle(e.target.value)} rows={2}
                  placeholder="e.g. Cinematic anime style, soft rim light, shallow DOF, 4K." />
              </Field>
              {currentStyle && !customStyle ? (
                <div className="jz-card" style={{ padding: '8px 10px', marginTop: 8 }}>
                  <div className="jz-xs jz-mono" style={{ lineHeight: 1.6 }}>{currentStyle.en}</div>
                  <div className="jz-xs jz-muted" style={{ marginTop: 6 }}>禁止：{currentStyle.ban}</div>
                </div>
              ) : null}
            </Panel>

            <Panel title="时长与场景">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--jz-sp-3)' }}>
                <Field label={`时长（秒）· 推荐 ${limits?.durationSec.min}-${limits?.durationSec.max}`}>
                  <Input value={durationSec} onChange={(e) => setDurationSec(e.target.value)} mono />
                </Field>
                <Field label="台词语言">
                  <Select<string> value={lang} onChange={setLang} options={LANGS.map((l) => ({ value: l, label: l }))} />
                </Field>
              </div>
              <Field label="SCENE LAYOUT · 全局场景">
                <Textarea value={sceneLayout} onChange={(e) => setSceneLayout(e.target.value)} rows={3}
                  placeholder="地点、空间布局、光线色调、角色站位" />
              </Field>
              <Field label="summary · 一句话概括">
                <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="留空自动生成" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--jz-sp-3)' }}>
                <Field label="overall_soundscape · 画内音" hint="规范要求不能空">
                  <Input value={soundscape} onChange={(e) => setSoundscape(e.target.value)} placeholder="环境底噪，轻柔空气声" />
                </Field>
                <Field label="non_diegetic_music · 画外配乐" hint="无则填 N/A">
                  <Input value={music} onChange={(e) => setMusic(e.target.value)} mono />
                </Field>
              </div>
            </Panel>
          </div>
        ) : null}

        {tab === 'cast' ? (
          <Panel title={`角色定义（${subjects.length}）`}>
            <div className="jz-col" style={{ gap: 10 }}>
              {subjects.map((s, i) => (
                <div key={s.id} className="jz-card" style={{ padding: 10 }}>
                  <div className="jz-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                    <b>角色 {i + 1} {(s.id)}</b>
                    {subjects.length > 1 ? (
                      <Button onClick={() => setSubjects((p) => p.filter((_, k) => k !== i))}>删除</Button>
                    ) : null}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                    <Field label="名字"><Input value={s.name} onChange={(e) => patchSubject(i, { name: e.target.value })} /></Field>
                    <Field label="参考图序号"><Input value={String(s.pictureIndex)} onChange={(e) => patchSubject(i, { pictureIndex: Number(e.target.value) || 1 })} mono /></Field>
                    <Field label="性别">
                      <Select<string> value={s.gender} onChange={(v) => patchSubject(i, { gender: v })}
                        options={[{ value: 'FEMALE', label: '女' }, { value: 'MALE', label: '男' }]} />
                    </Field>
                    <Field label="身高 cm"><Input value={String(s.heightCm)} onChange={(e) => patchSubject(i, { heightCm: e.target.value === '' ? '' : Number(e.target.value) })} mono /></Field>
                  </div>
                  <Field label="关键特征（发色/瞳色/配饰）">
                    <Input value={s.traits} onChange={(e) => patchSubject(i, { traits: e.target.value })} placeholder="银蓝渐变长发，蓝色发饰，深蓝礼服" />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                    <Field label="性格"><Input value={s.personality} onChange={(e) => patchSubject(i, { personality: e.target.value })} /></Field>
                    <Field label="音色描述"><Input value={s.voiceDesc} onChange={(e) => patchSubject(i, { voiceDesc: e.target.value })} placeholder="清澈沉稳" /></Field>
                  </div>
                </div>
              ))}
              <Button onClick={addSubject} icon={<Icon name="plus" size={15} />}>加一个角色</Button>
            </div>
          </Panel>
        ) : null}

        {tab === 'scenes' ? (
          <Panel title={`分镜表（${scenes.length} 段）`}>
            <div className="jz-sm jz-muted" style={{ marginBottom: 8 }}>
              分镜里只写角色名与情绪，不要重复 &lt;Picture N&gt;；音色已在角色定义里绑定。
            </div>
            <div className="jz-col" style={{ gap: 10 }}>
              {scenes.map((sc, i) => (
                <div key={i} className="jz-card" style={{ padding: 10 }}>
                  <div className="jz-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                    <b>第 {i + 1} 段</b>
                    {scenes.length > 1 ? (
                      <Button onClick={() => setScenes((p) => p.filter((_, k) => k !== i))}>删除</Button>
                    ) : null}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
                    <Field label="起（秒）"><Input value={String(sc.startSec)} onChange={(e) => patchScene(i, { startSec: Number(e.target.value) || 0 })} mono /></Field>
                    <Field label="止（秒）"><Input value={String(sc.endSec)} onChange={(e) => patchScene(i, { endSec: Number(e.target.value) || 0 })} mono /></Field>
                    <Field label="景别">
                      <Select<string> value={sc.shotSize} onChange={(v) => patchScene(i, { shotSize: v })}
                        options={SHOT_SIZES.map((x) => ({ value: x, label: x }))} />
                    </Field>
                  </div>
                  <Field label="动作描述"><Input value={sc.action} onChange={(e) => patchScene(i, { action: e.target.value })} /></Field>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                    <Field label="运镜"><Input value={sc.camera} onChange={(e) => patchScene(i, { camera: e.target.value })} /></Field>
                    <Field label="音效（画内）"><Input value={sc.sound} onChange={(e) => patchScene(i, { sound: e.target.value })} /></Field>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                    <Field label="说话人">
                      <Select<string> value={sc.speaker} onChange={(v) => patchScene(i, { speaker: v })}
                        options={subjects.map((s) => ({ value: s.id, label: `${s.name} (${s.id})` }))} />
                    </Field>
                    <Field label="台词"><Input value={sc.line} onChange={(e) => patchScene(i, { line: e.target.value })} /></Field>
                    <Field label="情绪"><Input value={sc.emotion} onChange={(e) => patchScene(i, { emotion: e.target.value })} /></Field>
                  </div>
                </div>
              ))}
              <Button onClick={addScene} icon={<Icon name="plus" size={15} />}>加一段分镜</Button>
            </div>
          </Panel>
        ) : null}

        {tab === 'output' ? (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            {result ? (
              <>
                <div className="jz-row jz-wrap" style={{ gap: 8 }}>
                  <Badge tone="ok">{result.mode.toUpperCase()}</Badge>
                  <Badge>{result.chars} 字符</Badge>
                  <Badge tone={result.chars > (limits?.promptMaxChars ?? 7000) ? 'danger' : 'default'}>
                    上限 {limits?.promptMaxChars ?? 7000}
                  </Badge>
                  {result.warnings.length ? <Badge tone="warn">{result.warnings.length} 条警告</Badge> : <Badge tone="ok">无警告</Badge>}
                </div>
                {result.warnings.length ? (
                  <Alert tone="warn">
                    {result.warnings.map((w, i) => <div key={i}>· {w}</div>)}
                  </Alert>
                ) : null}
                <Panel title="编译结果" actions={<Button onClick={() => void copyPrompt()}>复制</Button>}>
                  <pre className="jz-mono jz-xs" style={{
                    whiteSpace: 'pre-wrap', lineHeight: 1.7, maxHeight: 620, overflow: 'auto',
                    background: 'var(--jz-bg-sunken)', padding: 12, borderRadius: 6,
                  }}>
                    {result.prompt}
                  </pre>
                </Panel>
              </>
            ) : (
              <Alert tone="info">点右上角「编译预览」生成提示词。</Alert>
            )}
          </div>
        ) : null}
      </div>
    </Page>
  );
}

export default PromptPage;
