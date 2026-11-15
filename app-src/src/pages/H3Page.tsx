/**
 * H3 工坊页 —— 双语源（目录扫描 / 粘贴文本）→ analyze → 预览 → 导入资产库，
 * 以及 H3 成片工作台（分段视频 concat + 可选字幕）。
 *
 * 参数默认值对齐 host/services/h3-workshop.js 的 analyze 校验：
 *   episode 必须 >= 1 的整数；durationMin/Max 在 1—600 且 min <= max。
 */
import { useState } from 'react';

import { api, describeError } from '../api/client';
import type { H3Analysis, H3AnalyzeInput } from '../api/types';
import { useProjectStore, useUiStore } from '../store';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Icon,
  Input,
  KeyValue,
  Panel,
  Select,
  Tabs,
  Textarea,
  useT,
} from '../ui';
import { useToast } from '../ui/Toast';

type SourceKind = 'paste' | 'dir';

const ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as const;
const LANGUAGES = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
] as const;
const PLATFORMS = [
  { value: '', label: '不指定' },
  { value: 'douyin', label: '抖音' },
  { value: 'kuaishou', label: '快手' },
  { value: 'bilibili', label: 'B 站' },
  { value: 'youtube', label: 'YouTube' },
] as const;

export function ScriptAnalyzerPanel() {
  const t = useT();
  const toast = useToast();

  const draft = useUiStore((s) => s.h3Draft);
  const patchDraft = useUiStore((s) => s.patchH3Draft);

  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const selectProject = useProjectStore((s) => s.selectProject);
  const profileOptions = useProjectStore((s) => s.profileOptions);

  
  /* 分析状态 */
  const [analysis, setAnalysis] = useState<H3Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');



  /* ------------------------------- 分析 ------------------------------- */
  async function handleAnalyze() {
    setError('');
    if (draft.source === 'paste' && !draft.text.trim()) {
      setError(t('h3.needScript'));
      return;
    }
    if (!Number.isInteger(draft.episode) || draft.episode < 1) {
      setError(t('h3.needEpisode'));
      return;
    }
    setAnalyzing(true);
    try {
      const input: H3AnalyzeInput = {
        source: draft.source,
        episode: draft.episode,
        language: draft.language,
        aspect: draft.aspect,
        durationMin: draft.durationMin,
        durationMax: draft.durationMax,
        profile: draft.profile,
        ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
        ...(draft.style.trim() ? { style: draft.style.trim() } : {}),
        ...(draft.platform ? { platform: draft.platform } : {}),
        ...(draft.source === 'paste' ? { text: draft.text } : { file: draft.dir }),
      };
      const result = await api.h3Analyze(input);
      setAnalysis(result);
      toast.ok(`${t('h3.result')} · ${result.segments.length} ${t('h3.segments')}`);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setAnalyzing(false);
    }
  }

  /* ------------------------------- 导入 ------------------------------- */
  async function handleImport() {
    setError('');
    if (!currentProjectId) {
      setError(t('h3.needProject'));
      return;
    }
    if (!analysis) {
      setError(t('h3.noResult'));
      return;
    }
    setImporting(true);
    try {
      const result = await api.h3Import({ projectId: currentProjectId, analysis });
      toast.ok(
        t('h3.importSummary', {
          created: result.summary.created,
          characters: result.summary.characters,
          scenes: result.summary.scenes,
          props: result.summary.props,
          voices: result.summary.voices,
          shots: result.summary.shots,
        }),
      );
      // 导入后素材库应刷新
      void useProjectStore.getState().loadAssets({ projectId: currentProjectId });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setImporting(false);
    }
  }

  const profiles = profileOptions();

  return (
    <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
      <div className="jz-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <Select<string>
          value={currentProjectId ?? ''}
          onChange={(v) => selectProject(v || null)}
          options={[
            { value: '', label: t('app.none') },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
          aria-label={t('assets.project')}
        />
      </div>
      <div className="jz-split">
          {/* --------------------------- 参数区 --------------------------- */}
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel
              title={t('h3.sourcePaste')}
              actions={
                <Tabs<SourceKind>
                  items={[
                    { value: 'paste', label: t('h3.sourcePaste') },
                    { value: 'dir', label: t('h3.sourceDir') },
                  ]}
                  value={draft.source}
                  onChange={(v) => patchDraft({ source: v })}
                  ariaLabel={t('h3.sourcePaste')}
                />
              }
            >
              {draft.source === 'paste' ? (
                <Textarea
                  value={draft.text}
                  onChange={(e) => patchDraft({ text: e.target.value })}
                  placeholder={t('h3.textPlaceholder')}
                  minRows={12}
                />
              ) : (
                <div className="jz-col" style={{ gap: 'var(--jz-sp-2)' }}>
                  <Field label={t('h3.chooseDir')} hint="后端直接读本地目录，需为绝对路径">
                    <Input
                      value={draft.dir}
                      onChange={(e) => patchDraft({ dir: e.target.value })}
                      placeholder={t('h3.dirPlaceholder')}
                      mono
                    />
                  </Field>
                </div>
              )}
            </Panel>

            <Panel title={t('h3.params')}>
              <div className="jz-grid-3">
                <Field label={t('h3.episode')} required>
                  <Input
                    type="number"
                    min={1}
                    value={draft.episode}
                    onChange={(e) => patchDraft({ episode: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </Field>
                <Field label={t('h3.titleField')}>
                  <Input
                    value={draft.title}
                    onChange={(e) => patchDraft({ title: e.target.value })}
                    placeholder="第 1 集"
                  />
                </Field>
                <Field label={t('h3.language')}>
                  <Select<string>
                    value={draft.language}
                    onChange={(v) => patchDraft({ language: v })}
                    options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
                  />
                </Field>

                <Field label={t('h3.platform')}>
                  <Select<string>
                    value={draft.platform}
                    onChange={(v) => patchDraft({ platform: v })}
                    options={PLATFORMS.map((p) => ({ value: p.value, label: p.label }))}
                  />
                </Field>
                <Field label={t('h3.aspect')}>
                  <Select<string>
                    value={draft.aspect}
                    onChange={(v) => patchDraft({ aspect: v })}
                    options={ASPECTS.map((a) => ({ value: a, label: a }))}
                  />
                </Field>
                <Field label={t('h3.profile')}>
                  <Select<string>
                    value={draft.profile}
                    onChange={(v) => patchDraft({ profile: v })}
                    options={
                      profiles.length
                        ? profiles
                        : [{ value: 'P24-quality', label: 'P24-quality' }]
                    }
                  />
                </Field>

                <Field label={t('h3.durationMin')}>
                  <Input
                    type="number"
                    min={1}
                    max={600}
                    value={draft.durationMin}
                    onChange={(e) => patchDraft({ durationMin: Number(e.target.value) || 1 })}
                  />
                </Field>
                <Field label={t('h3.durationMax')}>
                  <Input
                    type="number"
                    min={1}
                    max={600}
                    value={draft.durationMax}
                    onChange={(e) => patchDraft({ durationMax: Number(e.target.value) || 1 })}
                  />
                </Field>
                <Field label={t('h3.style')}>
                  <Input
                    value={draft.style}
                    onChange={(e) => patchDraft({ style: e.target.value })}
                    placeholder={t('h3.stylePlaceholder')}
                  />
                </Field>
              </div>

              <div className="jz-row" style={{ marginTop: 'var(--jz-sp-4)' }}>
                <Button
                  variant="primary"
                  loading={analyzing}
                  icon={<Icon name="spark" size={15} />}
                  onClick={() => void handleAnalyze()}
                >
                  {analyzing ? t('h3.analyzing') : t('h3.analyze')}
                </Button>
                <span className="jz-spacer" />
                <Button
                  loading={importing}
                  disabled={!analysis}
                  icon={<Icon name="download" size={15} />}
                  onClick={() => void handleImport()}
                >
                  {importing ? t('h3.importing') : t('h3.importToAssets')}
                </Button>
              </div>

              {error ? (
                <div style={{ marginTop: 'var(--jz-sp-3)' }}>
                  <Alert tone="danger">{error}</Alert>
                </div>
              ) : null}
            </Panel>

            {analysis ? <AnalysisPreview analysis={analysis} /> : null}
          </div>

          {/* --------------------------- 结果区 --------------------------- */}
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            {analysis ? (
              <>
                <Panel title={t('h3.stats')}>
                  <KeyValue
                    rows={[
                      { key: t('h3.segments'), value: `${analysis.segments.length}` },
                      { key: t('h3.totalDuration'), value: `${analysis.stats.totalDuration}s` },
                      {
                        key: '分辨率',
                        value: `${analysis.resolution.width} × ${analysis.resolution.height}`,
                      },
                      { key: t('h3.aspect'), value: analysis.aspect },
                    ]}
                  />
                </Panel>

                {analysis.warnings.length > 0 ? (
                  <Panel title={t('h3.warnings')}>
                    <div className="jz-col" style={{ gap: 6 }}>
                      {analysis.warnings.map((w, i) => (
                        <Alert key={i} tone="warn">
                          {w}
                        </Alert>
                      ))}
                    </div>
                  </Panel>
                ) : null}

                <Panel title={t('h3.extractedAssets')} tight>
                  <KeyValue
                    rows={[
                      {
                        key: t('h3.characters'),
                        value: analysis.assets.characters.map((c) => c.name).join('、') || '—',
                      },
                      {
                        key: t('h3.scenes'),
                        value: analysis.assets.scenes.map((c) => c.name).join('、') || '—',
                      },
                      {
                        key: t('h3.props'),
                        value: analysis.assets.props.map((c) => c.name).join('、') || '—',
                      },
                      {
                        key: t('h3.voices'),
                        value: analysis.assets.voices.map((c) => c.name).join('、') || '—',
                      },
                    ]}
                  />
                </Panel>
              </>
            ) : (
              <EmptyState icon="h3" title={t('h3.noResult')} hint={t('h3.noResultHint')} />
            )}
          </div>
        </div>
    </div>
  );
}
/* ------------------------------------------------------- 分析结果预览 */

function AnalysisPreview({ analysis }: { analysis: H3Analysis }) {
  const t = useT();
  return (
    <Panel title={`${t('h3.result')} · ${t('h3.segments')} ${analysis.segments.length}`} flush>
      <div className="jz-table__wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 420 }}>
        <table className="jz-table">
          <thead>
            <tr>
              <th style={{ width: 52 }}>{t('h3.segmentIndex')}</th>
              <th style={{ width: 84 }}>{t('h3.segmentScene')}</th>
              <th>{t('h3.segmentAction')}</th>
              <th style={{ width: 72, textAlign: 'right' }}>{t('h3.segmentDuration')}</th>
            </tr>
          </thead>
          <tbody>
            {analysis.segments.map((seg) => (
              <tr key={seg.index}>
                <td className="jz-mono jz-xs">{seg.index}</td>
                <td>
                  <Badge>{seg.scene}</Badge>
                </td>
                <td>
                  <div className="jz-sm" style={{ maxWidth: 460, whiteSpace: 'pre-wrap' }}>
                    {seg.action || '—'}
                  </div>
                  {seg.dialogue.length > 0 ? (
                    <div className="jz-xs jz-muted" style={{ marginTop: 4 }}>
                      {seg.dialogue
                        .map((d) => (d.speaker ? `${d.speaker}：${d.text}` : d.text))
                        .join(' / ')}
                    </div>
                  ) : null}
                </td>
                <td className="jz-mono jz-xs" style={{ textAlign: 'right' }}>
                  {seg.durationSec}s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default ScriptAnalyzerPanel;