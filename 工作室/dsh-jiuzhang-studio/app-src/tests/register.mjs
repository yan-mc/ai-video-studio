/**
 * 测试注册器 —— 把解析钩子装进当前进程。
 * 用法：`node --import ./tests/register.mjs tests/xxx.test.mjs`
 * 或在一个入口里 `import './register.mjs'` 后再动态 import 被测模块。
 */
import { register } from 'node:module';

register(new URL('./ts-resolver.mjs', import.meta.url));