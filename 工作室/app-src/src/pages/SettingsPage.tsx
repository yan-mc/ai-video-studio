/**
 * 设置页 —— 后端配置（模型与接口 / 生成默认值）+ 外观 + 关于。
 *
 * 注意：host/config.js 的 WRITABLE_CONFIG_KEYS 是白名单，只有其中的键能落盘；
 * 这里只渲染白名单内的键，避免"改了但没存住"的错觉。
 */
import { useEffect, useState } from 'react';

import { describeError, getCachedToken } from '../api/client';
import type { BackendId } from '../api/types';
import { useProjectStore, useUiStore } from '../store';
import {
  Alert,
  Badge,
  Button,
  Field,
  Icon,
  Input,
  KeyValue,
  Loading,
  Page,
  Panel,
  Select,
  Switch,
  Tabs,
  useT,
} from '../ui';
import { useTheme } from '../ui/theme';
import { useToast } from '../ui/Toast';

type Section = 'backend' | 'appearance' | 'about';

export function SettingsPage() {
  const t = useT();
  const toast = useToast();

  const config = useProjectStore((s) => s.config);
  const configError = useProjectStore((s) => s.configError);
  const loadConfig = useProjectStore((s) => s.loadConfig);
  const saveConfig = useProjectStore((s) => s.saveConfig);
  const health = useUiStore((s) => s.health);
  const refreshHealth = useUiStore((s) => s.refreshHealth);
  const profileOptions = useProjectStore((s) => s.profileOptions);

  const { theme, accent, density, setTheme, setAccent, setDensity } = useTheme();

  const [section, setSection] = useState<Section>('backend');
  const [draft, setDraft] = useState<Record<string, string | number | boolean>>({});
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    void loadConfig();
    void refreshHealth();
  }, [loadConfig, refreshHealth]);

  // 配置到手后初始化草稿（只在首次/刷新后同步）
  useEffect(() => {
    if (!config) return;
    setDraft({
      comfyUrl: config.comfyUrl ?? '',
      comfyInputDir: config.comfyInputDir ?? '',
      seedanceEndpoint: config.seedanceEndpoint ?? '',
      seedanceModel: config.seedanceModel ?? '',
      seedanceApiKey: '',                       // 后端只回掩码，这里留空表示"不修改"
      seedanceMock: config.seedanceMock ?? true,
      defaultBackend: config.defaultBackend ?? 'h3-local',
      defaultProfile: config.defaultProfile ?? 'P12-draft',
      maxConcurrentLocal: config.maxConcurrentLocal ?? 1,
      previzAutoStart: config.previzAutoStart ?? true,
    });
  }, [config]);

  async function handleSave() {
    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        comfyUrl: String(draft['comfyUrl'] ?? ''),
        comfyInputDir: String(draft['comfyInputDir'] ?? ''),
        seedanceEndpoint: String(draft['seedanceEndpoint'] ?? ''),
        seedanceModel: String(draft['seedanceModel'] ?? ''),
        seedanceMock: Boolean(draft['seedanceMock']),
        defaultBackend: String(draft['defaultBackend'] ?? 'h3-local') as BackendId,
        defaultProfile: String(draft['defaultProfile'] ?? 'P12-draft'),
        maxConcurrentLocal: Number(draft['maxConcurrentLocal']) || 1,
        previzAutoStart: Boolean(draft['previzAutoStart']),
        theme,
        accent,
      };
      // 只有用户真的输入了新 key 才提交（空 = 保持不变）
      const newKey = String(draft['seedanceApiKey'] ?? '').trim();
      if (newKey && newKey !== '***') patch['seedanceApiKey'] = newKey;
      await saveConfig(patch);
      setSavedAt(Date.now());
      toast.ok(t('settings.configSaved'));
      void refreshHealth();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  const set = (key: string, value: string | number | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const profiles = profileOptions();

  return (
    <Page
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
      actions={
        <>
          <Tabs<Section>
            items={[
              { value: 'backend', label: t('settings.sectionBackend') },
              { value: 'appearance', label: t('settings.sectionAppearance') },
              { value: 'about', label: t('settings.sectionAbout') },
            ]}
            value={section}
            onChange={setSection}
            ariaLabel={t('settings.title')}
          />
          <Button
            variant="primary"
            loading={busy}
            icon={<Icon name="check" size={15} />}
            onClick={() => void handleSave()}
          >
            {t('settings.saveConfig')}
          </Button>
        </>
      }
    >
      {section === 'backend' ? (
        configError ? (
          <Alert tone="danger">{`${t('settings.configLoadFailed')} · ${configError}`}</Alert>
        ) : !config ? (
          <Loading text={t('app.loading')} />
        ) : (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)', maxWidth: 880 }}>
            {savedAt > 0 ? <Alert tone="ok">{t('settings.configSaved')}</Alert> : null}

            <Panel title={t('settings.sectionModel')}>
              <div className="jz-col" style={{ gap: 'var(--jz-sp-3)' }}>
                <Field label={t('settings.comfyUrl')} hint={`${t('settings.comfyUrlHint')} · ${config.comfyUrl ?? ''}`}>
                  <Input
                    value={String(draft['comfyUrl'] ?? '')}
                    onChange={(e) => set('comfyUrl', e.target.value)}
                    mono
                    placeholder="http://127.0.0.1:8188"
                  />
                </Field>
                <Field label={t('settings.comfyInputDir')}>
                  <Input
                    value={String(draft['comfyInputDir'] ?? '')}
                    onChange={(e) => set('comfyInputDir', e.target.value)}
                    mono
                    placeholder="留空表示不额外指定"
                  />
                </Field>
                <Field label={t('settings.seedanceEndpoint')}>
                  <Input
                    value={String(draft['seedanceEndpoint'] ?? '')}
                    onChange={(e) => set('seedanceEndpoint', e.target.value)}
                    mono
                  />
                </Field>
                <Field label={t('settings.seedanceModel')}>
                  <Input
                    value={String(draft['seedanceModel'] ?? '')}
                    onChange={(e) => set('seedanceModel', e.target.value)}
                    mono
                    placeholder="留空则使用默认"
                  />
                </Field>
                <Field label={t('settings.seedanceApiKey')} hint={t('settings.seedanceApiKeyHint')}>
                  <Input
                    value={String(draft['seedanceApiKey'] ?? '')}
                    onChange={(e) => set('seedanceApiKey', e.target.value)}
                    placeholder="粘贴新的 API Key（留空保持不变）"
                    mono
                    title={t('settings.tokenHint')}
                  />
                </Field>
                <Field label={t('settings.seedanceMock')}>
                  <Switch
                    checked={Boolean(draft['seedanceMock'])}
                    onChange={(v) => set('seedanceMock', v)}
                    label={Boolean(draft['seedanceMock']) ? 'Mock（无 key 也能跑通）' : '真实调用'}
                  />
                </Field>
              </div>
            </Panel>

            <Panel title={t('settings.sectionDefaults')}>
              <div className="jz-grid-3">
                <Field label={t('settings.defaultBackend')}>
                  <Select<string>
                    value={String(draft['defaultBackend'] ?? 'h3-local')}
                    onChange={(v) => set('defaultBackend', v)}
                    options={[
                      { value: 'h3-local', label: 'H3 本地' },
                      { value: 'seedance-cloud', label: 'Seedance 云端' },
                      { value: 'mock', label: 'Mock' },
                    ]}
                  />
                </Field>
                <Field label={t('settings.defaultProfile')}>
                  <Select<string>
                    value={String(draft['defaultProfile'] ?? 'P12-draft')}
                    onChange={(v) => set('defaultProfile', v)}
                    options={
                      profiles.length ? profiles : [{ value: 'P12-draft', label: 'P12-draft' }]
                    }
                  />
                </Field>
                <Field label={t('settings.maxConcurrentLocal')}>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={Number(draft['maxConcurrentLocal'] ?? 1)}
                    onChange={(e) => set('maxConcurrentLocal', Number(e.target.value) || 1)}
                  />
                </Field>
              </div>

              <div style={{ marginTop: 'var(--jz-sp-3)' }}>
                <Field label={t('settings.previzAutoStart')}>
                  <Switch
                    checked={Boolean(draft['previzAutoStart'])}
                    onChange={(v) => set('previzAutoStart', v)}
                    label={Boolean(draft['previzAutoStart']) ? t('app.yes') : t('app.no')}
                  />
                </Field>
              </div>
            </Panel>

            <Panel title={t('settings.health')} tight>
              <KeyValue
                rows={[
                  {
                    key: t('settings.healthH3'),
                    value: (
                      <Badge tone={health?.h3?.ok ? 'ok' : health ? 'danger' : 'default'}>
                        {health?.h3?.ok ? t('app.ready') : health ? t('app.offline') : t('app.unknown')}
                      </Badge>
                    ),
                  },
                  {
                    key: t('settings.healthSeedance'),
                    value: (
                      <Badge tone={health?.seedance?.ok === true ? 'ok' : 'warn'}>
                        {typeof health?.seedance?.detail === 'string'
                          ? health.seedance.detail
                          : health?.seedance?.ok === 'mock'
                            ? t('app.unknown')
                            : t('app.unknown')}
                      </Badge>
                    ),
                  },
                  {
                    key: t('settings.healthPreviz'),
                    value: (
                      <Badge tone={health?.previz?.ok ? 'ok' : 'default'}>
                        {health?.previz?.ok ? t('app.ready') : t('app.offline')}
                      </Badge>
                    ),
                  },
                  {
                    key: t('settings.tokenStatus'),
                    value: (
                      <span className="jz-row">
                        <Badge tone={getCachedToken() ? 'ok' : 'warn'}>
                          {getCachedToken() ? t('settings.tokenReady') : t('settings.tokenMissing')}
                        </Badge>
                      </span>
                    ),
                  },
                ]}
              />
            </Panel>
          </div>
        )
      ) : section === 'appearance' ? (
        <div className="jz-col" style={{ gap: 'var(--jz-sp-4)', maxWidth: 640 }}>
          <Panel title={t('settings.sectionAppearance')}>
            <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
              <Field label={t('settings.theme')}>
                <div className="jz-row" style={{ gap: 'var(--jz-sp-2)' }}>
                  <Button
                    variant={theme === 'inknight' ? 'primary' : 'default'}
                    icon={<Icon name="moon" size={15} />}
                    onClick={() => setTheme('inknight')}
                  >
                    {t('theme.inknight')}
                  </Button>
                  <Button
                    variant={theme === 'xuanpaper' ? 'primary' : 'default'}
                    icon={<Icon name="sun" size={15} />}
                    onClick={() => setTheme('xuanpaper')}
                  >
                    {t('theme.xuanpaper')}
                  </Button>
                </div>
              </Field>

              <Field label={t('settings.accent')}>
                <div className="jz-row jz-wrap" style={{ gap: 'var(--jz-sp-2)' }}>
                  {(
                    [
                      ['cinnabar', t('theme.accentCinnabar'), 'var(--jz-swatch-cinnabar)'],
                      ['indigo', t('theme.accentIndigo'), 'var(--jz-swatch-indigo)'],
                      ['gold', t('theme.accentGold'), 'var(--jz-swatch-gold)'],
                      ['pine', t('theme.accentPine'), 'var(--jz-swatch-pine)'],
                    ] as const
                  ).map(([id, label, color]) => (
                    <Button
                      key={id}
                      variant={accent === id ? 'primary' : 'default'}
                      size="sm"
                      onClick={() => setAccent(id)}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: '50%',
                          background: color,
                          display: 'inline-block',
                        }}
                      />
                      {label}
                    </Button>
                  ))}
                </div>
              </Field>

              <Field label={t('theme.density')}>
                <div className="jz-row" style={{ gap: 'var(--jz-sp-2)' }}>
                  <Button
                    variant={density === 'comfort' ? 'primary' : 'default'}
                    size="sm"
                    onClick={() => setDensity('comfort')}
                  >
                    {t('theme.densityComfort')}
                  </Button>
                  <Button
                    variant={density === 'compact' ? 'primary' : 'default'}
                    size="sm"
                    onClick={() => setDensity('compact')}
                  >
                    {t('theme.densityCompact')}
                  </Button>
                </div>
              </Field>
            </div>
          </Panel>
        </div>
      ) : (
        <div className="jz-col" style={{ gap: 'var(--jz-sp-4)', maxWidth: 720 }}>
          <Panel title={t('settings.sectionAbout')}>
            <div className="jz-col" style={{ gap: 'var(--jz-sp-3)' }}>
              <div style={{ fontFamily: 'var(--jz-font-title)', fontSize: 'var(--jz-fs-xl)' }}>
                {t('app.name')}
              </div>
              <div className="jz-sm jz-secondary">{t('settings.about')}</div>
              <div className="jz-sm jz-muted">{t('settings.aboutModules')}</div>
              <div className="jz-divider" />
              <KeyValue
                rows={[
                  { key: t('app.version'), value: '0.1.0' },
                  { key: 'API', value: <code className="jz-mono">/luoshu/api</code> },
                  { key: 'SPA', value: <code className="jz-mono">/luoshu/app</code> },
                  { key: t('settings.tokenHint'), value: '' },
                ]}
              />
            </div>
          </Panel>
        </div>
      )}
    </Page>
  );
}

export default SettingsPage;