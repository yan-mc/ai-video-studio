/**
 * UI 设计系统统一出口。
 *
 * 组件层一律 `import { Button, Field, Input, ... } from '../ui'`，
 * 不直接 import 具体文件，也不写颜色字面量。
 */
export { ThemeProvider, useTheme, getThemeSnapshot, applyThemeToDom } from './theme';
export type { ThemeId, AccentId, DensityId, ThemeState } from './theme';
export { THEMES, ACCENTS, DENSITIES, DEFAULT_THEME } from './theme';

export { useT } from './useT';

export { Button } from './Button';
export type { ButtonProps } from './Button';

export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';

export { Field, Label } from './Field';
export type { FieldProps, LabelProps } from './Field';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';

export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';

export { Switch } from './Switch';
export type { SwitchProps } from './Switch';

export { Badge } from './Badge';
export type { BadgeProps, BadgeTone } from './Badge';

export { Card } from './Card';
export type { CardProps } from './Card';

export { Panel } from './Panel';
export type { PanelProps } from './Panel';

export { Page } from './Page';
export type { PageProps } from './Page';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { Alert } from './Alert';
export type { AlertProps, AlertTone } from './Alert';

export { Tabs } from './Tabs';
export type { TabsProps, TabItem } from './Tabs';

export { Spinner, Loading } from './Spinner';

export { Meter } from './Meter';
export type { MeterProps, MeterTone } from './Meter';

export { Toaster, useToast } from './Toast';

export { Icon } from './Icon';
export type { IconName, IconProps } from './Icon';

export { Kbd } from './Kbd';

export { KeyValue } from './KeyValue';
export type { KeyValueProps, KeyValueRow } from './KeyValue';

export { CodeBlock } from './CodeBlock';
export type { CodeBlockProps } from './CodeBlock';

export { formatBytes, formatDateTime, formatRelativeTime, formatNumber } from './format';