/**
 * 画布模块测试入口 —— 一条命令跑完全部测试。
 *
 * 用法（工作目录 app-src）：
 *   node --import ./tests/register.mjs tests/runAll.mjs
 *   npm run test:canvas        （见 package.json 脚本；等价）
 *
 * Windows 注意事项：node 的 `--import` 只接受 **file:// URL 或相对路径**，
 * 传绝对路径 `F:\...` 会被当成 URL scheme `f:` 而报 ERR_UNSUPPORTED_ESM_URL_SCHEME。
 * 所以这里一律用相对路径（cwd = app-src）。
 */
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

const files = readdirSync(HERE)
  .filter((f) => f.endsWith('.test.mjs') || f === 'verifyNodeTypes.mjs')
  .sort()
  .map((f) => rel(path.join(HERE, f)));

console.log(`[canvas tests] 共 ${files.length} 个测试文件`);
for (const f of files) console.log(`  · ${f}`);
console.log('');

const child = spawn(
  process.execPath,
  ['--import', './tests/register.mjs', '--test', ...files],
  { stdio: 'inherit', cwd: ROOT },
);

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[canvas tests] 被信号终止：${signal}`);
    process.exit(1);
  }
  console.log(`\n[canvas tests] 结束，退出码 ${code ?? 0}`);
  process.exit(code ?? 0);
});