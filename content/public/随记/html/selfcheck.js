/* 自检：抽取 index.html 中的核心计算脚本，验证示例口径与关键规则 */
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = Math.abs(actual - expected) < 1e-9;
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + ' | 期望 ' + expected + '，实际 ' + actual);
  ok ? pass++ : fail++;
}

// 1) 语法检查：所有 <script> 块均可编译
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length < 2) throw new Error('script 块数量异常: ' + scripts.length);
scripts.forEach((src, i) => { new Function(src); console.log('PASS | script#' + i + ' 语法编译通过'); });

// 2) 提取核心计算
const m = html.match(/\/\* === CORE-BEGIN === \*\/([\s\S]*?)\/\* === CORE-END === \*\//);
if (!m) throw new Error('未找到 CORE 标记');
const mod = { exports: {} };
new Function('module', 'exports', m[1])(mod, mod.exports);
const core = mod.exports;

// 3) 委托示例：月 30000、专项扣除 4500，1-12 月
const months = Array.from({ length: 12 }, () => ({ income: 30000, exempt: 0, special: 4500, specialAdd: 0, other: 0 }));
const sim = core.simulateMonthly(months, { start: 1, end: 12, mode: 'standard' });
check('1月实际预扣 = 615', sim.rows[0].actual, 615);
check('2月累计税额 = 1580', sim.rows[1].cumTax, 1580);
check('2月实际预扣 = 965', sim.rows[1].actual, 965);
check('全年已预扣合计 = 32280', sim.totalWithheld, 32280);

const ann = core.computeAnnual(months, { start: 1, end: 12 }, { labor: 0, author: 0, royalty: 0, serious: 0 });
check('年度应纳税所得额 = 246000', ann.taxable, 246000);
check('年度应纳税额 = 32280', ann.tax, 32280);
check('应补/应退 = 0', core.round2(ann.tax - sim.totalWithheld), 0);

// 4) 累计录入模式与每月模式一致性（2 月口径）
const c = core.computeCumulative({ month: 2, mode: 'standard', income: 60000, exempt: 0, special: 9000, specialAdd: 0, other: 0, relief: 0, withheld: 615, employedMonths: 2 });
check('累计模式：2月累计应纳税所得额 = 41000', c.taxable, 41000);
check('累计模式：2月累计税额 = 1580', c.cumTax, 1580);
check('累计模式：2月公式余额/实际预扣 = 965', c.actual, 965);

// 5) 负余额：暂不退税，实际预扣按 0
const neg = core.computeCumulative({ month: 1, mode: 'standard', income: 4000, exempt: 0, special: 0, specialAdd: 0, other: 0, relief: 0, withheld: 100, employedMonths: 1 });
check('负余额：公式余额 = -100', neg.balance, -100);
check('负余额：实际预扣 = 0', neg.actual, 0);

// 6) 负余额后续月份自然抵回（1 月收入低、2 月起正常）
const months2 = [{ income: 2000, exempt: 0, special: 0, specialAdd: 0, other: 0 },
                 { income: 30000, exempt: 0, special: 4500, specialAdd: 0, other: 0 }];
const sim2 = core.simulateMonthly(months2.concat(months.slice(2)), { start: 1, end: 12, mode: 'standard' });
check('低收入首月实际预扣 = 0', sim2.rows[0].actual, 0);
// 2月：累计收入32000-累计专项4500-减除10000=17500 → 税 525
check('抵回后2月累计税额 = 525', sim2.rows[1].cumTax, 525);
check('抵回后2月实际预扣 = 525', sim2.rows[1].actual, 525);

// 7) 减除方式变体
check('firstYear：5000×公历月份(3月)=15000', core.basicDeduction('firstYear', 3, 1), 15000);
check('low60k：直接 60000', core.basicDeduction('low60k', 3, 3), 60000);
check('standard：5000×任职月份数=10000', core.basicDeduction('standard', 3, 2), 10000);

// 8) 大病医疗公式 min(max(自付-15000,0),80000)
const a1 = core.computeAnnual(months, { start: 1, end: 12 }, { labor: 0, author: 0, royalty: 0, serious: 200000 });
check('大病医疗封顶 80000', a1.serious, 80000);
const a2 = core.computeAnnual(months, { start: 1, end: 12 }, { labor: 0, author: 0, royalty: 0, serious: 10000 });
check('大病医疗起付线下为 0', a2.serious, 0);
const a3 = core.computeAnnual(months, { start: 1, end: 12 }, { labor: 0, author: 0, royalty: 0, serious: 40000 });
check('大病医疗常规 = 25000', a3.serious, 25000);

// 9) 年度调整并入：劳务×80%、稿酬×56%、特许×80%
const a4 = core.computeAnnual(months, { start: 1, end: 12 }, { labor: 10000, author: 10000, royalty: 10000, serious: 0 });
check('劳务并入 = 8000', a4.laborIncl, 8000);
check('稿酬并入 = 5600', a4.authorIncl, 5600);
check('特许并入 = 8000', a4.royaltyIncl, 8000);

// 10) 跨级速算扣除数校验（第 4、7 级边界）
check('税率级次：420000 → 第4级25%', core.findBracket(420000).level, 4);
check('税率级次：420000.01 → 第5级30%', core.findBracket(420000.01).level, 5);
check('税额：1000000×45%-181920 = 268080', core.taxOn(1000000), 268080);
check('税额：0 → 0', core.taxOn(0), 0);
check('税额：负数 → 0', core.taxOn(-5000), 0);

// 10.5) 年度减免税额：年度应补/应退 = 年度应纳税额 − 减免税额 − 全年已预扣合计
const annR = core.computeAnnual(months, { start: 1, end: 12 }, { labor: 0, author: 0, royalty: 0, serious: 0, relief: 2000 });
check('年度减免税额透传 = 2000', annR.relief, 2000);
check('含减免：应补/应退 = 32280 − 2000 − 32280 = -2000', core.round2(annR.tax - annR.relief - sim.totalWithheld), -2000);
const annR0 = core.computeAnnual(months, { start: 1, end: 12 }, { labor: 0, author: 0, royalty: 0, serious: 0 });
check('未填减免税额时按 0 处理', annR0.relief, 0);

// 10.6) 任职月份数夹取：1 ≤ n ≤ 当前月份序号（≤12）
check('任职月份夹取：9 超过当前月份 6 → 6', core.clampEmployedMonths(9, 6), 6);
check('任职月份夹取：0 小于 1 → 1', core.clampEmployedMonths(0, 6), 1);
check('任职月份夹取：范围内 4 保持 4', core.clampEmployedMonths(4, 6), 4);
check('任职月份夹取：小数 3.6 四舍五入为 4', core.clampEmployedMonths(3.6, 6), 4);

// 11) 工作月份范围：年中入职（7-12月），任职月份数从 7 月起算
const midYear = months.map((r, i) => i >= 6 ? { income: 30000, exempt: 0, special: 4500, specialAdd: 0, other: 0 } : { income: 0, exempt: 0, special: 0, specialAdd: 0, other: 0 });
const sim3 = core.simulateMonthly(midYear, { start: 7, end: 12, mode: 'standard' });
check('年中入职：7月预扣 = 615（减除 5000×1）', sim3.rows[6].actual, 615);
check('年中入职：范围外月份标记 out of range', sim3.rows[5].inRange, false);

console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
process.exit(fail ? 1 : 0);
