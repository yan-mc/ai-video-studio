/**
 * 素材选择器 —— 从素材库挑参考图/视频/音频。
 *
 * ============================================================================
 * 与旧 RenderPage 的 MediaPicker 的区别
 * ============================================================================
 *
 *   旧版：内嵌在 RenderPage.tsx 里，只支持视频/音频，图片靠"服化道"绕
 *   新版：独立组件，支持三类，且数量上限与南风参数槽位对齐
 *
 * 南风的槽位上限（来自 h3_generator.py 的 INPUT_TYPES）：
 *   图片1-9 / 视频1-3 / 音频1-3
 *
 * @module components/AssetPicker
 */
import { useMemo, useState } from 'react';
import { Badge, Button, Input, Panel } from '../ui';

/** 素材项（来自 /assets） */
export interface AssetItem {
  id: string;
  name: string;
  kind: string;
  rel?: string;
  bytes?: number;
}

/** 已选项 */
export interface PickedMedia {
  rel: string;
  name: string;
}

export interface AssetPickerProps {
  assets: AssetItem[];
  images: PickedMedia[];
  videos: PickedMedia[];
  audios: PickedMedia[];
  onImages: (v: PickedMedia[]) => void;
  onVideos: (v: PickedMedia[]) => void;
  onAudios: (v: PickedMedia[]) => void;
  /** 刷新素材库 */
  onRefresh?: () => void;
  /**
   * 允许的素材类别。默认三类全开。
   *
   * 为什么需要：某些页面（智能分镜）的生成接口只接受参考图，
   * 视频/音频 tab 点得动但选了也没用 —— 那是**UI 在撒谎**。
   * 传 ['image'] 就只渲染图片 tab，不给用户假入口。
   */
  kinds?: ReadonlyArray<'image' | 'video' | 'audio'>;
}

const LIMITS = { image: 9, video: 3, audio: 3 } as const;

/**
 * 三类素材选择器。
 */
export function AssetPicker({
  assets,
  images,
  videos,
  audios,
  onImages,
  onVideos,
  onAudios,
  onRefresh,
  kinds = ['image', 'video', 'audio'],
}: AssetPickerProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'image' | 'video' | 'audio'>('image');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets
      .filter((a) => a.kind === tab)
      .filter((a) => (q ? (a.name ?? '').toLowerCase().includes(q) : true));
  }, [assets, tab, query]);

  const current = tab === 'image' ? images : tab === 'video' ? videos : audios;
  const setCurrent = tab === 'image' ? onImages : tab === 'video' ? onVideos : onAudios;
  const limit = LIMITS[tab];

  const toggle = (a: AssetItem) => {
    const rel = a.rel ?? '';
    if (!rel) return;
    if (current.some((x) => x.rel === rel)) {
      setCurrent(current.filter((x) => x.rel !== rel));
    } else if (current.length >= limit) {
      return;
    } else {
      setCurrent([...current, { rel, name: a.name }]);
    }
  };

  return (
    <Panel
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          素材
          <Badge tone={images.length ? 'accent' : 'default'}>图 {images.length}/{LIMITS.image}</Badge>
          <Badge tone={videos.length ? 'accent' : 'default'}>视 {videos.length}/{LIMITS.video}</Badge>
          <Badge tone={audios.length ? 'accent' : 'default'}>音 {audios.length}/{LIMITS.audio}</Badge>
        </span>
      }
      actions={
        onRefresh ? (
          <Button variant="ghost" onClick={onRefresh}>刷新</Button>
        ) : null
      }
      tight
    >
      {/* 分类 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {kinds.map((k) => (
          <Button
            key={k}
            variant={tab === k ? 'primary' : 'ghost'}
            onClick={() => setTab(k)}
          >
            {k === 'image' ? '图片' : k === 'video' ? '视频' : '音频'}
          </Button>
        ))}
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索素材名…"
        style={{ marginBottom: 8 }}
      />

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div className="jz-xs jz-muted">
          {tab === 'image' ? '素材库里没有图片。' : tab === 'video' ? '素材库里没有视频。' : '素材库里没有音频。'}
          {' '}先用「素材库」上传，或跑一次生成/立绘拆解。
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
          {filtered.map((a) => {
            const rel = a.rel ?? '';
            const on = current.some((x) => x.rel === rel);
            const disabled = !on && current.length >= limit;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a)}
                disabled={disabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 8px',
                  textAlign: 'left',
                  background: on ? 'var(--jz-accent-soft)' : 'var(--jz-bg-sunken)',
                  border: `1px solid ${on ? 'var(--jz-accent)' : 'var(--jz-border)'}`,
                  borderRadius: 'var(--jz-r-sm)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                  color: 'var(--jz-text-primary)',
                  font: 'inherit',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name}
                </span>
                {on ? <Badge tone="ok">已选</Badge> : null}
              </button>
            );
          })}
        </div>
      )}

      {/* 已选清单 */}
      {current.length > 0 ? (
        <div style={{ marginTop: 8, display: 'grid', gap: 2 }}>
          <div className="jz-xs jz-muted">已选（顺序即 &lt;{tab === 'image' ? 'Picture' : tab === 'video' ? 'Video' : 'Audio'} N&gt; 编号）：</div>
          {current.map((m, i) => (
            <div key={m.rel} className="jz-xs" style={{ display: 'flex', gap: 6 }}>
              <span className="jz-mono" style={{ color: 'var(--jz-accent)' }}>#{i + 1}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
