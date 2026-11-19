/**
 * 构建期注入的全局常量声明。
 *
 * `__APP_VERSION__` 由 `vite.config.ts` 的 `define` 在构建时替换成
 * 插件根目录 `package.json` 的版本号 —— 版本号只有一个真源，
 * 界面上的「关于」不再手抄（曾经抄成 0.1.0，落后两个大版本）。
 */
declare const __APP_VERSION__: string;