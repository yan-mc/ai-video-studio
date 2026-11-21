/**
 * 一次性探针：验证续写模式的分段规划。
 *
 * 关掉 GPU，只验证算术：段数、重叠、交付时长、源视频区间是否自洽。
 */
import { planSegments, resolveReplaceInput } from '../../host/services/replace.js';
import { loadConfig } from '../../host/config.js';

const cfg = loadConfig();
// planSegments 内部直接用 probeMedia，它要求**绝对路径**
const src = resolveReplaceInput('assets/asset_replace_test_15s.mp4', cfg);

console.log('=== 独立模式（对照） ===');
const indep = await planSegments(src, cfg, { segmentSec: 10, continuation: false });
console.log(`  mode=${indep.mode} 段数=${indep.segments.length}`);
for (const s of indep.segments) {
  console.log(`    #${s.index} 源[${s.startSec}, ${(s.startSec + s.durationSec).toFixed(3)}) 交付 ${s.durationSec}s`);
}

for (const ctx of ['22', '39', '56']) {
  for (const segSec of [4, 5]) {
    console.log(`\n=== 续写 context=${ctx} segmentSec=${segSec} ===`);
    try {
      const p = await planSegments(src, cfg, {
        segmentSec: segSec, continuation: true, contextLength: ctx,
      });
      console.log(`  mode=${p.mode} 段数=${p.segments.length} trim=${p.trimFrames}f overlap=${p.overlapSec}s 规划总长=${p.plannedTotalSec}s`);
      let sumDeliver = 0;
      for (const s of p.segments) {
        sumDeliver += s.deliverSec;
        console.log(`    #${s.index} 源[${s.startSec.toFixed(2)}, ${(s.startSec + s.durationSec).toFixed(2)})`
          + ` 请求${s.requestSec}s 采样${s.sampleFrames}f 交付${s.deliverSec}s 重叠${s.overlapSec ?? 0}s`);
      }
      console.log(`  交付合计 = ${sumDeliver.toFixed(2)}s（源 ${p.durationSec}s）`);
      for (const w of p.warnings) console.log(`  ! ${w}`);
    } catch (e) {
      console.log(`  失败: ${e.message}`);
    }
  }
}
