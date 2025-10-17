/**
📁 /tests/performance/performance.frontend.spec.ts

=========================== Standard Run (with browser) ===========================
▶️ npx playwright test ./tests/performance/performance.frontend.spec.ts --project=chromium-frontend --headed
=========================== Without Lighthouse (faster) ===========================
▶️ PERF_LIGHTHOUSE=0 npx playwright test ./tests/performance/performance.frontend.spec.ts --project=chromium-frontend
=========================== Extra Runs (slower / more evidence) ===========================
▶️ PERF_RUNS=4 npx playwright test ./tests/performance/performance.frontend.spec.ts --project=chromium-frontend
=========================== Slow internet Test ===========================
▶️ PERF_CONSTRAINED=1 npx playwright test ./tests/performance/performance.frontend.spec.ts --project=chromium-frontend

*/

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe.configure({ mode: 'serial' });

test.use({
  storageState: process.env.FRONTEND_STATE ?? 'playwright/.auth/govuk-frontend.json',
});

const BASE_URL = 'https://cogcg--autotests.sandbox.my.site.com/cciaf';
const ASSESSMENT_ID = 'a01dw0000087pCZAAY';
const PRACTICE_AREA_ID = 'a08dw000005TM8sAAG';
const CRITERIA_ID = 'a04dw000000DXF9AAO';

const RUNS_PER_PAGE = Math.max(1, Number(process.env.PERF_RUNS ?? '2'));
const USE_CONSTRAINED_PROFILE = process.env.PERF_CONSTRAINED === '1';
const RUN_LIGHTHOUSE = process.env.PERF_LIGHTHOUSE !== '0';

const BUDGETS_PATH = path.join(__dirname, '../../performance-budgets.json');

if (!fs.existsSync(BUDGETS_PATH)) {
  throw new Error(`Performance budgets file not found at: ${BUDGETS_PATH}`);
}

const budgetConfig = JSON.parse(fs.readFileSync(BUDGETS_PATH, 'utf-8'));

if (!budgetConfig.default) {
  throw new Error('performance-budgets.json must have a "default" section');
}

const DEFAULT_THRESHOLDS = budgetConfig.default;

console.log('✅ Loaded budgets from:', BUDGETS_PATH);
console.log('   Page-specific configs:', Object.keys(budgetConfig.pages || {}).length);

const COLD_MULTIPLIER = Number(process.env.PERF_COLD_FACTOR ?? 1.25);
const COLD_TTFB = Number(process.env.PERF_TTFB_COLD ?? Math.round(DEFAULT_THRESHOLDS.ttfb * COLD_MULTIPLIER));

type Thresholds = typeof DEFAULT_THRESHOLDS;

interface PerformanceScenario {
  name: string;
  url: string;
  label: string;
  thresholds?: Partial<Thresholds>;
}

type MetricTimings = {
  ttfb: number | null;
  domContentLoaded: number | null;
  firstContentfulPaint: number | null;
  largestContentfulPaint: number | null;
  loadEventEnd: number | null;
};

type ResourceSummary = { count: number; transferSize: number; maxDuration: number; };
type ResourceEntry = {
  name: string; initiatorType: string; transferSize: number;
  encodedBodySize: number; decodedBodySize: number; duration: number;
};
type SlowResource = ResourceEntry & { runLabel: string };
type ServerTimingEntry = { name: string; description?: string; duration: number; };

type LighthouseScores = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
};

type PageRunResult = {
  runLabel: string;
  timings: MetricTimings;
  cls: number;
  totalBlockingTime: number;
  requestCount: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  resourceBreakdown: Record<string, ResourceSummary>;
  resourceEntries: ResourceEntry[];
  slowestResources: SlowResource[];
  serverTiming: ServerTimingEntry[];
  lighthouse?: LighthouseScores;
};

type NumericSummary = { average: number; median: number; min: number; max: number; standardDeviation: number; };
type Summary = {
  timings: Record<keyof MetricTimings, NumericSummary | null>;
  cls: NumericSummary | null;
  totalBlockingTime: NumericSummary | null;
  requestCount: NumericSummary | null;
  transferSize: NumericSummary | null;
  slowestResources: SlowResource[];
  lighthouse?: {
    performance: NumericSummary | null;
    accessibility: NumericSummary | null;
    bestPractices: NumericSummary | null;
    seo: NumericSummary | null;
  };
};

type ScenarioOutcome = {
  name: string;
  url: string;
  label: string;
  summary: Summary;
  breaches: string[];
};

const GLOBAL_OUTCOMES: ScenarioOutcome[] = [];

const PERFORMANCE_PAGES: PerformanceScenario[] = [
  { name: 'Dashboard (Assessment List)', url: `${BASE_URL}/CCIAFAssessPrevious`, label: 'performance-dashboard' },
  { name: 'Assessment Overview', url: `${BASE_URL}/CCIAFAssessment?id=${ASSESSMENT_ID}`, label: 'performance-assessment-overview' },
  { name: 'Cover Sheet (Read)', url: `${BASE_URL}/CCIAFAssessCoverSheet?id=${ASSESSMENT_ID}`, label: 'performance-coversheet-read' },
  { name: 'Cover Sheet (Edit)', url: `${BASE_URL}/CCIAFAssessCoverSheetEdit?id=${ASSESSMENT_ID}&pg=ratings`, label: 'performance-coversheet-edit' },
  { name: 'Document Library', url: `${BASE_URL}/CCIAFAssessLibrary?id=${ASSESSMENT_ID}`, label: 'performance-document-library' },
  { name: 'Add Document Form', url: `${BASE_URL}/CCIAFAssessLibraryAddDocument?id=${ASSESSMENT_ID}`, label: 'performance-add-document' },
  { name: 'Practice Area', url: `${BASE_URL}/CCIAFAssessPracticeArea?id=${ASSESSMENT_ID}&practiceArea=${PRACTICE_AREA_ID}`, label: 'performance-practice-area' },
  { name: 'Indicator / Criteria', url: `${BASE_URL}/CCIAFAssessIndicator?id=${ASSESSMENT_ID}&practiceArea=${PRACTICE_AREA_ID}&criteria=${CRITERIA_ID}`, label: 'performance-indicator' },
];

test.describe('Performance - Critical CCIAF pages (load performance)', () => {
  for (const scenario of PERFORMANCE_PAGES) {
    test(`${scenario.name} - load performance`, async ({ page, browserName }) => {
      const pageThresholds = budgetConfig?.pages?.[scenario.label] ?? {};
      const thresholds: Thresholds = { ...DEFAULT_THRESHOLDS, ...pageThresholds, ...scenario.thresholds };
      const runs: PageRunResult[] = [];

      for (let attempt = 0; attempt < RUNS_PER_PAGE; attempt += 1) {
        const runLabel = attempt === 0 ? 'Cold start' : `Warm #${attempt}`;
        await resetBrowserState(page, browserName, { clearCache: attempt === 0 });

        if (USE_CONSTRAINED_PROFILE && browserName === 'chromium') {
          await applyConstrainedDeviceProfile(page);
        }

        const metrics = await measurePagePerformance(page, scenario.url, runLabel);
        runs.push(metrics);
      }

      if (RUN_LIGHTHOUSE && browserName === 'chromium') {
        console.log(`Running Lighthouse audit for ${scenario.name}...`);
        const lighthouseScores = await runLighthouseAudit(scenario.url, page);
        if (lighthouseScores) {
          runs[runs.length - 1].lighthouse = lighthouseScores;
        }
      }

      const summary = computeSummary(runs);
      const breaches = collectThresholdBreaches(runs, thresholds);
      const report = buildPerformanceReport(scenario, runs, summary, thresholds, breaches);

      console.log(report);

      await test.info().attach(`${scenario.label}-performance.txt`, { body: report, contentType: 'text/plain' });
      await test.info().attach(`${scenario.label}-performance.json`, {
        body: JSON.stringify({ scenario, thresholds, runs, summary, breaches, meta: { constrained: USE_CONSTRAINED_PROFILE, lighthouse: RUN_LIGHTHOUSE } }, null, 2),
        contentType: 'application/json',
      });
      GLOBAL_OUTCOMES.push({ name: scenario.name, url: scenario.url, label: scenario.label, summary, breaches });

    });
  }
});

async function resetBrowserState(
  page: Page,
  browserName: string,
  opts: { clearCache: boolean },
): Promise<void> {
  await page.goto('about:blank');
  await page.waitForLoadState('load');

  if (browserName !== 'chromium' || !opts.clearCache) return;

  try {
    const session = await page.context().newCDPSession(page);
    await session.send('Network.clearBrowserCache');
    await session.detach?.();
  } catch (error) {
    console.warn('Unable to clear browser cache for cold run:', error);
  }
}

async function applyConstrainedDeviceProfile(page: Page): Promise<void> {
  try {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 1_600_000,
      uploadThroughput: 750_000,
    });
    await session.detach?.();
  } catch (e) {
    console.warn('Constrained profile not applied:', e);
  }
}

async function assertLoggedIn(page: Page): Promise<void> {
  const href = page.url();
  const body = await page.evaluate(() => document.body?.innerText?.slice(0, 1000) ?? '');
  const looksLikeLogin = /\/s\/login/i.test(href) || /sign in|log in|enter your email|verify/i.test(body);
  if (looksLikeLogin) {
    await test.info().attach('not-logged-in-url.txt', { body: href, contentType: 'text/plain' });
    await test.info().attach('not-logged-in-dom.html', { body: await page.content(), contentType: 'text/html' });
    throw new Error('Not authenticated: redirected to login/unauthorised shell. Check FRONTEND_STATE or rebuild auth state.');
  }
}

async function runLighthouseAudit(url: string, page: Page): Promise<LighthouseScores | null> {
  let chrome;
  try {
    const cookies = await page.context().cookies();
    chrome = await launch({ chromeFlags: ['--headless', '--disable-gpu'] });
    
    const runnerResult = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      extraHeaders: {
        Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; '),
      },
    });

    if (!runnerResult?.lhr?.categories) {
      return null;
    }

    return {
      performance: Math.round((runnerResult.lhr.categories.performance?.score ?? 0) * 100),
      accessibility: Math.round((runnerResult.lhr.categories.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((runnerResult.lhr.categories['best-practices']?.score ?? 0) * 100),
      seo: Math.round((runnerResult.lhr.categories.seo?.score ?? 0) * 100),
    };
  } catch (error) {
    console.warn('Lighthouse audit failed:', error);
    return null;
  } finally {
    if (chrome) {
      await chrome.kill();
    }
  }
}

async function measurePagePerformance(page: Page, url: string, runLabel: string): Promise<PageRunResult> {
  await injectPerformanceObservers(page);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await assertLoggedIn(page);
  await page.waitForTimeout(500);

  const raw = await page.evaluate(() => {
    const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const firstPaintEntry = performance.getEntriesByName('first-paint')[0] as PerformanceEntry | undefined;
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0] as PerformanceEntry | undefined;
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint') as PerformanceEntry[];
    const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const perfStore = (window as unknown as { __pwPerformance?: { lcp: number | null; cls: number; longTasks: number[] } }).__pwPerformance;

    performance.clearResourceTimings();

    return {
      navigation: navigation ? {
        domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
        loadEventEnd: navigation.loadEventEnd,
        responseStart: navigation.responseStart,
        requestStart: navigation.requestStart,
        transferSize: navigation.transferSize,
        encodedBodySize: navigation.encodedBodySize,
        decodedBodySize: navigation.decodedBodySize,
        serverTiming: navigation.serverTiming?.map((e) => ({ name: e.name, description: e.description, duration: e.duration })),
      } : null,
      paints: {
        firstPaint: firstPaintEntry?.startTime ?? null,
        firstContentfulPaint: fcpEntry?.startTime ?? null,
      },
      largestContentfulPaint: lcpEntries.at(-1)?.startTime ?? perfStore?.lcp ?? null,
      cls: perfStore?.cls ?? 0,
      longTasks: perfStore?.longTasks ?? [],
      resourceEntries: resourceEntries.map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType || 'other',
        transferSize: entry.transferSize ?? 0,
        encodedBodySize: entry.encodedBodySize ?? 0,
        decodedBodySize: entry.decodedBodySize ?? 0,
        duration: entry.duration ?? 0,
      })),
    };
  });

  const timings: MetricTimings = {
    ttfb: raw.navigation && isNumber(raw.navigation.responseStart) && isNumber(raw.navigation.requestStart)
      ? raw.navigation.responseStart - raw.navigation.requestStart
      : null,
    domContentLoaded: raw.navigation?.domContentLoadedEventEnd ?? null,
    firstContentfulPaint: raw.paints.firstContentfulPaint ?? null,
    largestContentfulPaint: raw.largestContentfulPaint ?? null,
    loadEventEnd: raw.navigation?.loadEventEnd ?? null,
  };

  const totalBlockingTime = (raw.longTasks ?? []).reduce((sum: number, duration: number) => sum + Math.max(0, duration - 50), 0);

  const resourceBreakdown = raw.resourceEntries.reduce<Record<string, ResourceSummary>>((acc, entry) => {
    const key = entry.initiatorType || 'other';
    if (!acc[key]) acc[key] = { count: 0, transferSize: 0, maxDuration: 0 };
    acc[key].count += 1;
    acc[key].transferSize += entry.transferSize;
    acc[key].maxDuration = Math.max(acc[key].maxDuration, entry.duration);
    return acc;
  }, {});

  const slowestResources: SlowResource[] = raw.resourceEntries
    .filter((entry) => entry.duration >= 300)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5)
    .map((entry) => ({ ...entry, runLabel }));

  const totalTransfer = (raw.navigation?.transferSize ?? 0)
    + raw.resourceEntries.reduce((s, e) => s + (e.transferSize ?? 0), 0);

  return {
    runLabel,
    timings,
    cls: raw.cls ?? 0,
    totalBlockingTime,
    requestCount: raw.resourceEntries.length + (raw.navigation ? 1 : 0),
    transferSize: totalTransfer,
    encodedBodySize: raw.navigation?.encodedBodySize ?? 0,
    decodedBodySize: raw.navigation?.decodedBodySize ?? 0,
    resourceBreakdown,
    resourceEntries: raw.resourceEntries,
    slowestResources,
    serverTiming: raw.navigation?.serverTiming ?? [],
  };
}

async function injectPerformanceObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const globalWindow = window as unknown as {
      __pwPerformance?: { lcp: number | null; cls: number; longTasks: number[] };
      __cciafPerfObservers?: boolean;
    };
    if (globalWindow.__cciafPerfObservers) return;
    globalWindow.__cciafPerfObservers = true;
    globalWindow.__pwPerformance = { lcp: null, cls: 0, longTasks: [] };

    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const lastEntry = entryList.getEntries().at(-1) as PerformanceEntry & { renderTime?: number; loadTime?: number; startTime?: number } | undefined;
        if (lastEntry) globalWindow.__pwPerformance!.lcp = lastEntry.renderTime ?? lastEntry.loadTime ?? lastEntry.startTime ?? null;
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    try {
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!layoutShift.hadRecentInput && typeof layoutShift.value === 'number') globalWindow.__pwPerformance!.cls += layoutShift.value;
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {}

    try {
      const longTaskObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) globalWindow.__pwPerformance!.longTasks.push((entry as PerformanceEntry).duration);
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch {}
  });
}

function computeSummary(runs: PageRunResult[]): Summary {
  const wrap = <K extends keyof MetricTimings>(k: K) => summariseNumbers(runs.map((r) => r.timings[k]).filter(isNumber));
  
  const lighthouseScores = runs.map(r => r.lighthouse).filter(Boolean) as LighthouseScores[];
  
  return {
    timings: {
      ttfb: wrap('ttfb'),
      domContentLoaded: wrap('domContentLoaded'),
      firstContentfulPaint: wrap('firstContentfulPaint'),
      largestContentfulPaint: wrap('largestContentfulPaint'),
      loadEventEnd: wrap('loadEventEnd'),
    },
    cls: summariseNumbers(runs.map((r) => r.cls).filter(isNumber)),
    totalBlockingTime: summariseNumbers(runs.map((r) => r.totalBlockingTime).filter(isNumber)),
    requestCount: summariseNumbers(runs.map((r) => r.requestCount).filter(isNumber)),
    transferSize: summariseNumbers(runs.map((r) => r.transferSize).filter(isNumber)),
    slowestResources: computeSlowResources(runs),
    lighthouse: lighthouseScores.length > 0 ? {
      performance: summariseNumbers(lighthouseScores.map(s => s.performance)),
      accessibility: summariseNumbers(lighthouseScores.map(s => s.accessibility)),
      bestPractices: summariseNumbers(lighthouseScores.map(s => s.bestPractices)),
      seo: summariseNumbers(lighthouseScores.map(s => s.seo)),
    } : undefined,
  };
}

function summariseNumbers(values: number[]): NumericSummary | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const average = sum / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const variance = values.reduce((acc, v) => acc + (v - average) ** 2, 0) / values.length;
  return { average, median, min: sorted[0], max: sorted[sorted.length - 1], standardDeviation: Math.sqrt(variance) };
}

function computeSlowResources(runs: PageRunResult[]): SlowResource[] {
  return runs.flatMap((run) => run.slowestResources.map((res) => ({ ...res, runLabel: run.runLabel })))
             .sort((a, b) => b.duration - a.duration)
             .slice(0, 5);
}

function collectThresholdBreaches(runs: PageRunResult[], thresholds: Thresholds): string[] {
  const breaches: string[] = [];
  for (const run of runs) {
    if (isNumber(run.timings.ttfb) && run.timings.ttfb > thresholds.ttfb) {
      breaches.push(`${run.runLabel}: TTFB ${formatMs(run.timings.ttfb)} (target ≤ ${formatMs(thresholds.ttfb)})`);
    }
    if (isNumber(run.timings.domContentLoaded) && run.timings.domContentLoaded > thresholds.domContentLoaded) {
      breaches.push(`${run.runLabel}: DOM Content Loaded ${formatMs(run.timings.domContentLoaded)} (target ≤ ${formatMs(thresholds.domContentLoaded)})`);
    }
    if (isNumber(run.timings.firstContentfulPaint) && run.timings.firstContentfulPaint > thresholds.firstContentfulPaint) {
      breaches.push(`${run.runLabel}: First Contentful Paint ${formatMs(run.timings.firstContentfulPaint)} (target ≤ ${formatMs(thresholds.firstContentfulPaint)})`);
    }
    if (isNumber(run.timings.largestContentfulPaint) && run.timings.largestContentfulPaint > thresholds.largestContentfulPaint) {
      breaches.push(`${run.runLabel}: Largest Contentful Paint ${formatMs(run.timings.largestContentfulPaint)} (target ≤ ${formatMs(thresholds.largestContentfulPaint)})`);
    }
    if (isNumber(run.timings.loadEventEnd) && run.timings.loadEventEnd > thresholds.loadEventEnd) {
      breaches.push(`${run.runLabel}: Load Complete ${formatMs(run.timings.loadEventEnd)} (target ≤ ${formatMs(thresholds.loadEventEnd)})`);
    }
    if (isNumber(run.cls) && run.cls > thresholds.cumulativeLayoutShift) {
      breaches.push(`${run.runLabel}: Cumulative Layout Shift ${formatFloat(run.cls)} (target ≤ ${formatFloat(thresholds.cumulativeLayoutShift)})`);
    }
    if (isNumber(run.totalBlockingTime) && run.totalBlockingTime > thresholds.totalBlockingTime) {
      breaches.push(`${run.runLabel}: Total Blocking Time ${formatMs(run.totalBlockingTime)} (target ≤ ${formatMs(thresholds.totalBlockingTime)})`);
    }
    if (isNumber(run.requestCount) && run.requestCount > thresholds.requestCount) {
      breaches.push(`${run.runLabel}: Request Count ${formatNumber(run.requestCount)} (target ≤ ${formatNumber(thresholds.requestCount)})`);
    }
    if (isNumber(run.transferSize) && run.transferSize > thresholds.transferSize) {
      breaches.push(`${run.runLabel}: Transfer Size ${formatBytes(run.transferSize)} (target ≤ ${formatBytes(thresholds.transferSize)})`);
    }
    
    if (run.lighthouse && thresholds.lighthouse) {
      if (run.lighthouse.performance < thresholds.lighthouse.performance) {
        breaches.push(`${run.runLabel}: Lighthouse Performance ${run.lighthouse.performance} (target ≥ ${thresholds.lighthouse.performance})`);
      }
      if (run.lighthouse.accessibility < thresholds.lighthouse.accessibility) {
        breaches.push(`${run.runLabel}: Lighthouse Accessibility ${run.lighthouse.accessibility} (target ≥ ${thresholds.lighthouse.accessibility})`);
      }
      if (run.lighthouse.bestPractices < thresholds.lighthouse.bestPractices) {
        breaches.push(`${run.runLabel}: Lighthouse Best Practices ${run.lighthouse.bestPractices} (target ≥ ${thresholds.lighthouse.bestPractices})`);
      }
      if (run.lighthouse.seo < thresholds.lighthouse.seo) {
        breaches.push(`${run.runLabel}: Lighthouse SEO ${run.lighthouse.seo} (target ≥ ${thresholds.lighthouse.seo})`);
      }
    }
  }
  return breaches;
}

function buildPerformanceReport(
  scenario: PerformanceScenario, runs: PageRunResult[], summary: Summary, thresholds: Thresholds, breaches: string[],
): string {
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════════════════');
  lines.push(` CCIAF Performance Report — ${scenario.name}`);
  lines.push(` URL: ${scenario.url}`);
  lines.push(` Runs: ${runs.length} (${runs.map((r) => r.runLabel).join(', ')})`);
  lines.push(` Profile: ${USE_CONSTRAINED_PROFILE ? 'Constrained (Slow 4G + 4× CPU)' : 'Default'}`);
  if (RUN_LIGHTHOUSE) lines.push(` Lighthouse: Enabled`);
  lines.push('═══════════════════════════════════════════════════════');

  for (const run of runs) {
    lines.push('');
    lines.push(` ${run.runLabel}`);
    lines.push(`   • TTFB .................. ${formatMs(run.timings.ttfb)} ${statusIcon(run.timings.ttfb, thresholds.ttfb)}`);
    lines.push(`   • DOM Content Loaded ..... ${formatMs(run.timings.domContentLoaded)} ${statusIcon(run.timings.domContentLoaded, thresholds.domContentLoaded)}`);
    lines.push(`   • First Contentful Paint .. ${formatMs(run.timings.firstContentfulPaint)} ${statusIcon(run.timings.firstContentfulPaint, thresholds.firstContentfulPaint)}`);
    lines.push(`   • Largest Contentful Paint  ${formatMs(run.timings.largestContentfulPaint)} ${statusIcon(run.timings.largestContentfulPaint, thresholds.largestContentfulPaint)}`);
    lines.push(`   • Load Complete ........... ${formatMs(run.timings.loadEventEnd)} ${statusIcon(run.timings.loadEventEnd, thresholds.loadEventEnd)}`);
    lines.push(`   • Cumulative Layout Shift . ${formatFloat(run.cls)} ${statusIcon(run.cls, thresholds.cumulativeLayoutShift)}`);
    lines.push(`   • Total Blocking Time ..... ${formatMs(run.totalBlockingTime)} ${statusIcon(run.totalBlockingTime, thresholds.totalBlockingTime)}`);
    lines.push(`   • Requests ................ ${formatNumber(run.requestCount)} ${statusIcon(run.requestCount, thresholds.requestCount)}`);
    lines.push(`   • Transfer Size (total) ... ${formatBytes(run.transferSize)} ${statusIcon(run.transferSize, thresholds.transferSize)}`);

    if (run.lighthouse) {
      lines.push(`   • Lighthouse Scores:`);
      lines.push(`       Performance ....... ${run.lighthouse.performance} ${statusIcon(run.lighthouse.performance, thresholds.lighthouse?.performance ?? 75, 'gte')}`);
      lines.push(`       Accessibility ..... ${run.lighthouse.accessibility} ${statusIcon(run.lighthouse.accessibility, thresholds.lighthouse?.accessibility ?? 90, 'gte')}`);
      lines.push(`       Best Practices .... ${run.lighthouse.bestPractices} ${statusIcon(run.lighthouse.bestPractices, thresholds.lighthouse?.bestPractices ?? 80, 'gte')}`);
      lines.push(`       SEO ............... ${run.lighthouse.seo} ${statusIcon(run.lighthouse.seo, thresholds.lighthouse?.seo ?? 90, 'gte')}`);
    }

    const slowResources = run.slowestResources.slice(0, 3);
    if (slowResources.length) {
      lines.push('   • Slow resources (>300ms):');
      for (const resource of slowResources) {
        lines.push(`       - ${formatMs(resource.duration)} ${resource.initiatorType.padEnd(8)} ${resource.name}`);
      }
    }
  }

  lines.push('');
  lines.push(' Aggregate view (average | worst)');
  const add = (label: string, stat: NumericSummary | null, fmt: (v: number | null) => string, thr: number) => {
    if (!stat) return lines.push(`   • ${label.padEnd(24)} n/a`);
    lines.push(`   • ${label.padEnd(24)} avg ${fmt(stat.average)} | worst ${fmt(stat.max)} ${statusIcon(stat.max, thr)}`);
  };

  add('TTFB', summary.timings.ttfb, formatMs, thresholds.ttfb);
  add('DOM Content Loaded', summary.timings.domContentLoaded, formatMs, thresholds.domContentLoaded);
  add('First Contentful Paint', summary.timings.firstContentfulPaint, formatMs, thresholds.firstContentfulPaint);
  add('Largest Contentful Paint', summary.timings.largestContentfulPaint, formatMs, thresholds.largestContentfulPaint);
  add('Load Complete', summary.timings.loadEventEnd, formatMs, thresholds.loadEventEnd);
  add('Total Blocking Time', summary.totalBlockingTime, formatMs, thresholds.totalBlockingTime);
  add('Requests', summary.requestCount, formatNumber, thresholds.requestCount);
  add('Transfer Size', summary.transferSize, formatBytes, thresholds.transferSize);

  if (summary.cls) {
    lines.push(`   • Cumulative Layout Shift   avg ${formatFloat(summary.cls.average)} | worst ${formatFloat(summary.cls.max)} ${statusIcon(summary.cls.max, thresholds.cumulativeLayoutShift)}`);
  }

  if (summary.lighthouse) {
    lines.push('');
    lines.push(' Lighthouse Scores (average)');
    if (summary.lighthouse.performance) {
      lines.push(`   • Performance ......... ${Math.round(summary.lighthouse.performance.average)} ${statusIcon(summary.lighthouse.performance.average, thresholds.lighthouse?.performance ?? 75, 'gte')}`);
    }
    if (summary.lighthouse.accessibility) {
      lines.push(`   • Accessibility ....... ${Math.round(summary.lighthouse.accessibility.average)} ${statusIcon(summary.lighthouse.accessibility.average, thresholds.lighthouse?.accessibility ?? 90, 'gte')}`);
    }
    if (summary.lighthouse.bestPractices) {
      lines.push(`   • Best Practices ...... ${Math.round(summary.lighthouse.bestPractices.average)} ${statusIcon(summary.lighthouse.bestPractices.average, thresholds.lighthouse?.bestPractices ?? 80, 'gte')}`);
    }
    if (summary.lighthouse.seo) {
      lines.push(`   • SEO ................. ${Math.round(summary.lighthouse.seo.average)} ${statusIcon(summary.lighthouse.seo.average, thresholds.lighthouse?.seo ?? 90, 'gte')}`);
    }
  }

  lines.push('');
  if (summary.slowestResources.length) {
    lines.push(' Global slow resources (top 5)');
    for (const resource of summary.slowestResources) {
      lines.push(`   - ${formatMs(resource.duration)} ${resource.initiatorType.padEnd(8)} ${resource.name} (${resource.runLabel})`);
    }
  } else {
    lines.push(' No resources above 300ms detected.');
  }

  lines.push('');
  if (breaches.length) {
    lines.push(' Alerts / exceeds budget');
    for (const breach of breaches) lines.push(`   ⚠️  ${breach}`);
  } else {
    lines.push(' All tracked metrics are within budgets ✅');
  }

  lines.push('');
  lines.push(' Budget Configuration');
  lines.push(`   Source: ${budgetConfig ? 'performance-budgets.json' : 'Environment variables / defaults'}`);
  if (budgetConfig?.pages?.[scenario.label]) {
    lines.push(`   Page-specific budgets applied for: ${scenario.label}`);
  }

  lines.push('');
  lines.push(' INP note: This suite validates load; measure INP via RUM or add a synthetic interaction step if needed.');
  lines.push('═══════════════════════════════════════════════════════');
  return lines.join('\n');
}


function statusIcon(value: number | null | undefined, threshold: number, comparator: 'lte' | 'gte' = 'lte'): string {
  if (!isNumber(value)) return '•';
  if (comparator === 'lte') return value <= threshold ? '✅' : '⚠️';
  return value >= threshold ? '✅' : '⚠️';
}

function formatMs(value: number | null | undefined): string {
  if (!isNumber(value)) return 'n/a';
  if (value < 1000) return `${value.toFixed(0)} ms`;
  if (value < 10_000) return `${(value / 1000).toFixed(2)} s`;
  return `${(value / 1000).toFixed(1)} s`;
}

function formatBytes(value: number | null | undefined): string {
  if (!isNumber(value)) return 'n/a';
  const units = ['B', 'KB', 'MB', 'GB'];
  let index = 0; let size = value;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  const decimals = index === 0 ? 0 : size < 10 ? 2 : 1;
  return `${size.toFixed(decimals)} ${units[index]}`;
}

function formatNumber(value: number | null | undefined): string {
  if (!isNumber(value)) return 'n/a';
  return Math.round(value).toString();
}

function formatFloat(value: number | null | undefined, digits = 3): string {
  if (!isNumber(value)) return 'n/a';
  return value.toFixed(digits);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

test.afterAll(async () => {
  if (!GLOBAL_OUTCOMES.length) return;

  const warmWorstBy = <T extends keyof MetricTimings | 'cls' | 'tbt' | 'reqs' | 'bytes'>(o: ScenarioOutcome, key: T) => {
    if (key === 'cls') return o.summary.cls?.max ?? null;
    if (key === 'tbt') return o.summary.totalBlockingTime?.max ?? null;
    if (key === 'reqs') return o.summary.requestCount?.max ?? null;
    if (key === 'bytes') return o.summary.transferSize?.max ?? null;
    return o.summary.timings[key as keyof MetricTimings]?.max ?? null;
  };

  const thr = {
    ttfb: DEFAULT_THRESHOLDS.ttfb,
    dcl: DEFAULT_THRESHOLDS.domContentLoaded,
    fcp: DEFAULT_THRESHOLDS.firstContentfulPaint,
    lcp: DEFAULT_THRESHOLDS.largestContentfulPaint,
    load: DEFAULT_THRESHOLDS.loadEventEnd,
    cls: DEFAULT_THRESHOLDS.cumulativeLayoutShift,
    tbt: DEFAULT_THRESHOLDS.totalBlockingTime,
    reqs: DEFAULT_THRESHOLDS.requestCount,
    bytes: DEFAULT_THRESHOLDS.transferSize,
  };

  type Row = {
    page: string; url: string;
    ttfb: number | null; dcl: number | null; fcp: number | null; lcp: number | null; load: number | null;
    cls: number | null; tbt: number | null; reqs: number | null; bytes: number | null;
    lighthousePerf: number | null; lighthouseA11y: number | null;
  };

  const rows: Row[] = GLOBAL_OUTCOMES.map(o => ({
    page: o.name,
    url: o.url,
    ttfb: warmWorstBy(o, 'ttfb'),
    dcl: warmWorstBy(o, 'domContentLoaded'),
    fcp: warmWorstBy(o, 'firstContentfulPaint'),
    lcp: warmWorstBy(o, 'largestContentfulPaint'),
    load: warmWorstBy(o, 'loadEventEnd'),
    cls: warmWorstBy(o, 'cls'),
    tbt: warmWorstBy(o, 'tbt'),
    reqs: warmWorstBy(o, 'reqs'),
    bytes: warmWorstBy(o, 'bytes'),
    lighthousePerf: o.summary.lighthouse?.performance?.average ?? null,
    lighthouseA11y: o.summary.lighthouse?.accessibility?.average ?? null,
  }));

  const pass = (v: number | null, limit: number, lte = true) =>
    v == null ? null : (lte ? v <= limit : v >= limit);

  const metrics = [
    { key: 'lcp', label: 'LCP', fmt: formatMs, limit: thr.lcp },
    { key: 'cls', label: 'CLS', fmt: (n: number | null) => formatFloat(n, 3), limit: thr.cls },
    { key: 'tbt', label: 'TBT', fmt: formatMs, limit: thr.tbt },
    { key: 'ttfb', label: 'TTFB', fmt: formatMs, limit: thr.ttfb },
    { key: 'bytes', label: 'Bytes', fmt: formatBytes, limit: thr.bytes },
    { key: 'reqs', label: 'Requests', fmt: (n: number | null) => n == null ? 'n/a' : Math.round(n).toString(), limit: thr.reqs },
  ] as const;

  const passRates = metrics.map(m => {
    const vals = rows.map(r => r[m.key as keyof Row] as number | null).filter(v => v != null) as number[];
    const passes = vals.filter(v => pass(v, m.limit)).length;
    const pct = vals.length ? Math.round((passes / vals.length) * 100) : 0;
    return { label: m.label, passed: passes, total: vals.length, pct, limit: m.limit };
  });

  const overBy = (value: number | null, limit: number) =>
    value == null ? null : (value - limit);

  const rank = (k: keyof Row, limit: number) =>
    [...rows]
      .map(r => ({ r, over: overBy(r[k] as number | null, limit) }))
      .filter(x => x.over != null && x.over! > 0)
      .sort((a, b) => b.over! - a.over!);

  const worstLCP = rank('lcp', thr.lcp).slice(0, 5);
  const worstTBT = rank('tbt', thr.tbt).slice(0, 5);
  const worstBytes = rank('bytes', thr.bytes).slice(0, 5);

  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════════════════');
  lines.push(' CCIAF Performance — Overall Summary (warm-run worst per page)');
  lines.push(` Pages: ${rows.length}`);
  lines.push(` Budget Source: ${budgetConfig ? 'performance-budgets.json' : 'Environment variables'}`);
  if (RUN_LIGHTHOUSE) lines.push(` Lighthouse: Enabled`);
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');
  lines.push(' Suite pass-rate by budget:');
  for (const p of passRates) {
    lines.push(`  • ${p.label.padEnd(8)} ${String(p.pct).padStart(3)}%  (${p.passed}/${p.total})  budget ≤ ${p.limit}`);
  }

  if (RUN_LIGHTHOUSE) {
    const lighthousePerfScores = rows.map(r => r.lighthousePerf).filter(isNumber);
    const lighthouseA11yScores = rows.map(r => r.lighthouseA11y).filter(isNumber);
    
    if (lighthousePerfScores.length > 0) {
      const avgPerf = Math.round(lighthousePerfScores.reduce((a, b) => a + b, 0) / lighthousePerfScores.length);
      const avgA11y = lighthouseA11yScores.length > 0 
        ? Math.round(lighthouseA11yScores.reduce((a, b) => a + b, 0) / lighthouseA11yScores.length)
        : null;
      
      lines.push('');
      lines.push(' Lighthouse Scores (site average):');
      lines.push(`  • Performance ..... ${avgPerf} ${statusIcon(avgPerf, DEFAULT_THRESHOLDS.lighthouse?.performance ?? 75, 'gte')}`);
      if (avgA11y !== null) {
        lines.push(`  • Accessibility ... ${avgA11y} ${statusIcon(avgA11y, DEFAULT_THRESHOLDS.lighthouse?.accessibility ?? 90, 'gte')}`);
      }
    }
  }

  lines.push('');
  lines.push(' Per-page warm worst vs budget (✅ within | ⚠️ over):');
  const flag = (ok: boolean | null) => ok == null ? '•' : (ok ? '✅' : '⚠️');
  for (const r of rows) {
    const okLCP = pass(r.lcp, thr.lcp);
    const okCLS = pass(r.cls, thr.cls);
    const okTBT = pass(r.tbt, thr.tbt);
    const okBytes = pass(r.bytes, thr.bytes);
    lines.push(`  - ${r.page}`);
    lines.push(`     LCP ${formatMs(r.lcp)} ${flag(okLCP)} (≤ ${formatMs(thr.lcp)}) | CLS ${formatFloat(r.cls, 3)} ${flag(okCLS)} (≤ ${formatFloat(thr.cls, 3)})`);
    lines.push(`     TBT ${formatMs(r.tbt)} ${flag(okTBT)} (≤ ${formatMs(thr.tbt)}) | Bytes ${formatBytes(r.bytes)} ${flag(okBytes)} (≤ ${formatBytes(thr.bytes)})`);
    
    if (r.lighthousePerf !== null) {
      const okLH = r.lighthousePerf >= (DEFAULT_THRESHOLDS.lighthouse?.performance ?? 75);
      lines.push(`     Lighthouse Perf ${Math.round(r.lighthousePerf)} ${flag(okLH)} (≥ ${DEFAULT_THRESHOLDS.lighthouse?.performance ?? 75})`);
    }
  }

  const showWorst = (title: string, arr: { r: Row; over: number | null }[], fmt: (n: number | null) => string, limitFmt: string) => {
    lines.push('');
    lines.push(` Worst pages by ${title} (over budget):`);
    if (!arr.length) {
      lines.push('   None — all within budget ✅');
      return;
    }
    for (const w of arr) {
      lines.push(`   - ${w.r.page} → ${fmt(w.r[title.toLowerCase() as keyof Row] as number | null)} (+${fmt(w.over)} over ${limitFmt})`);
    }
  };

  showWorst('LCP', worstLCP, formatMs, formatMs(thr.lcp));
  showWorst('TBT', worstTBT, formatMs, formatMs(thr.tbt));
  showWorst('Bytes', worstBytes, formatBytes, formatBytes(thr.bytes));

  const avgReqs = rows.map(r => r.reqs ?? 0).reduce((a, b) => a + b, 0) / rows.length;
  const avgBytes = rows.map(r => r.bytes ?? 0).reduce((a, b) => a + b, 0) / rows.length;
  if (avgReqs < 30 && avgBytes < 1_000_000) {
    lines.push('');
    lines.push(' ℹ️ Sanity note: very low requests/bytes on average. If this seems off, confirm pages are authenticated and assets are not blocked.');  
  }

  lines.push('═══════════════════════════════════════════════════════');

  const overallTxt = lines.join('\n');

  const csvEsc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = [
    ['Page', 'URL', 'WarmWorst_LCP_ms', 'Budget_LCP_ms', 'WarmWorst_CLS', 'Budget_CLS', 'WarmWorst_TBT_ms', 'Budget_TBT_ms', 'WarmWorst_Bytes', 'Budget_Bytes', 'Lighthouse_Perf', 'Lighthouse_A11y', 'Within_LCP', 'Within_CLS', 'Within_TBT', 'Within_Bytes'].join(','),
    ...rows.map(r => [
      csvEsc(r.page), csvEsc(r.url),
      (r.lcp ?? '').toString(), thr.lcp.toString(),
      (r.cls ?? '').toString(), thr.cls.toString(),
      (r.tbt ?? '').toString(), thr.tbt.toString(),
      (r.bytes ?? '').toString(), thr.bytes.toString(),
      r.lighthousePerf !== null ? Math.round(r.lighthousePerf).toString() : '',
      r.lighthouseA11y !== null ? Math.round(r.lighthouseA11y).toString() : '',
      pass(r.lcp, thr.lcp) ?? '',
      pass(r.cls, thr.cls) ?? '',
      pass(r.tbt, thr.tbt) ?? '',
      pass(r.bytes, thr.bytes) ?? '',
    ].join(',')),
  ].join('\n');

  await test.info().attach('overall-performance-summary.txt', { body: overallTxt, contentType: 'text/plain' });
  await test.info().attach('overall-performance-summary.csv', { body: csv, contentType: 'text/csv' });
  console.log(overallTxt);
});