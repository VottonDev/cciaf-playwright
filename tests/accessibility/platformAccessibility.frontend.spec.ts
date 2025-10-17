/**
📁 /tests/accessibility/platformAccessibility.frontend.spec.ts

=========================== Standard Run (with browser) ===========================
▶️ npx playwright test ./tests/accessibility/platformAccessibility.frontend.spec.ts --project=chromium-frontend --headed
*/

import { test, expect } from '@playwright/test';
import { axeScan } from '../../utils/axeScan';
import fs from 'node:fs';
import path from 'path';

const PAGE_TYPES = [
  {
    name: 'Dashboard (Assessment List)',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessPrevious',
    label: 'platform-dashboard'
  },
  {
    name: 'Assessment Overview',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessment?id=a01dw0000087pCZAAY',
    label: 'platform-assessment-overview'
  },
  {
    name: 'Cover Sheet (Read)',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessCoverSheet?id=a01dw0000087pCZAAY',
    label: 'platform-coversheet-read'
  },
  {
    name: 'Cover Sheet (Edit)',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessCoverSheetEdit?id=a01dw0000087pCZAAY&pg=ratings',
    label: 'platform-coversheet-edit'
  },
  {
    name: 'Document Library',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessLibrary?id=a01dw0000087pCZAAY',
    label: 'platform-library'
  },
  {
    name: 'Add Document Form',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessLibraryAddDocument?id=a01dw0000087pCZAAY',
    label: 'platform-add-document'
  },
  {
    name: 'Practice Area',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessPracticeArea?id=a01dw0000087pCZAAY&practiceArea=a08dw000005TM8sAAG',
    label: 'platform-practice-area'
  },
  {
    name: 'Indicator/Criteria',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessIndicator?id=a01dw0000087pCZAAY&practiceArea=a08dw000005TM8sAAG&criteria=a04dw000000DXF9AAO',
    label: 'platform-indicator'
  }
];

test.describe.configure({ mode: 'serial' });

test('Full Site Accessibility Audit - Complete Scan', async ({ page }) => {
  
  const auditResults: any[] = [];
  const allViolations = new Map<string, any>();

  for (const pageType of PAGE_TYPES) {
    
    await page.goto(pageType.url);
    await page.waitForLoadState('networkidle');
    
    // Scan EVERYTHING - no exclusions
    await axeScan(page, pageType.label, {
      softFail: true  // Don't fail build - just document everything
      // No include, no exclude = scan entire page
    });
    
    // Capture full page screenshot for visual reference
    const screenshot = await page.screenshot({ fullPage: true });
    await test.info().attach(`${pageType.label}-full-page`, {
      body: screenshot,
      contentType: 'image/png'
    });
    
    // Read the generated JSON to aggregate results
    const jsonPath = test.info().outputPath(`a11y-${pageType.label}.json`);
    if (fs.existsSync(jsonPath)) {
      const results = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      auditResults.push({
        pageType: pageType.name,
        url: pageType.url,
        violations: results.violations || [],
        passes: results.passes?.length || 0,
        incomplete: results.incomplete?.length || 0
      });
      
      // Aggregate unique violations across all pages
      if (results.violations) {
        results.violations.forEach((v: any) => {
          if (!allViolations.has(v.id)) {
            allViolations.set(v.id, {
              id: v.id,
              description: v.description,
              help: v.help,
              helpUrl: v.helpUrl,
              impact: v.impact,
              occurrences: 0,
              affectedPages: []
            });
          }
          const violation = allViolations.get(v.id);
          violation.occurrences += v.nodes?.length || 0;
          violation.affectedPages.push(pageType.name);
        });
      }
    }
    
  }
  
  // Generate comprehensive summary report
  const summary = generateFullSiteSummaryReport(auditResults, allViolations);
  
  const summaryPath = test.info().outputPath('FULL_SITE_ACCESSIBILITY_SUMMARY.md');
  fs.writeFileSync(summaryPath, summary, 'utf-8');
  
  await test.info().attach('FULL_SITE_ACCESSIBILITY_SUMMARY.md', {
    contentType: 'text/markdown',
    body: summary
  });
  
  
  const totalViolations = Array.from(allViolations.values())
    .reduce((sum, v) => sum + v.occurrences, 0);
  
  if (totalViolations > 0) {
  } else {
  }
});

function generateFullSiteSummaryReport(
  auditResults: any[],
  allViolations: Map<string, any>
): string {
  const timestamp = new Date().toISOString();
  const totalPages = auditResults.length;
  const totalViolations = Array.from(allViolations.values())
    .reduce((sum, v) => sum + v.occurrences, 0);
  
  let report = `# CCIAF Full Site Accessibility Audit Summary\n\n`;
  report += `**Generated:** ${timestamp}\n\n`;
  report += `**Scope:** Complete site audit - ALL page components (navigation, content, forms, etc.)\n\n`;
  report += `**Pages Tested:** ${totalPages}\n\n`;
  report += `---\n\n`;
  
  // Executive Summary
  if (totalViolations === 0) {
    report += `## ✅ Executive Summary\n\n`;
    report += `No accessibility violations found across the entire CCIAF site.\n\n`;
    report += `All pages meet WCAG 2.1 Level AA requirements (GDS Service Standard Point 5).\n\n`;
  } else {
    report += `## ⚠️ Executive Summary\n\n`;
    report += `**${totalViolations} accessibility violations** found across **${allViolations.size} unique WCAG rules**.\n\n`;
    
    const bySeverity = Array.from(allViolations.values()).reduce((acc, v) => {
      acc[v.impact || 'unknown'] = (acc[v.impact || 'unknown'] || 0) + v.occurrences;
      return acc;
    }, {} as Record<string, number>);
    
    report += `### Severity Breakdown\n\n`;
    if (bySeverity.critical) report += `- 🔴 **Critical:** ${bySeverity.critical}\n`;
    if (bySeverity.serious) report += `- 🟠 **Serious:** ${bySeverity.serious}\n`;
    if (bySeverity.moderate) report += `- 🟡 **Moderate:** ${bySeverity.moderate}\n`;
    if (bySeverity.minor) report += `- 🔵 **Minor:** ${bySeverity.minor}\n`;
    report += `\n`;
    
    report += `### Impact Assessment\n\n`;
    report += `These violations affect:\n`;
    const affectedPagesSet = new Set<string>();
    allViolations.forEach(v => v.affectedPages.forEach((p: string) => affectedPagesSet.add(p)));
    report += `- **${affectedPagesSet.size} of ${totalPages}** page types (${Math.round(affectedPagesSet.size/totalPages*100)}%)\n`;
    report += `- **${totalViolations}** total instances across the site\n\n`;
  }
  
  // Violations by Rule
  if (allViolations.size > 0) {
    report += `---\n\n## 🔍 Issues Found by WCAG Rule\n\n`;
    
    const sortedViolations = Array.from(allViolations.values())
      .sort((a, b) => {
        const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3, unknown: 4 };
        return impactOrder[a.impact as keyof typeof impactOrder] - impactOrder[b.impact as keyof typeof impactOrder];
      });
    
    sortedViolations.forEach((violation, index) => {
      const icon = violation.impact === 'critical' ? '🔴' : 
                   violation.impact === 'serious' ? '🟠' : 
                   violation.impact === 'moderate' ? '🟡' : '🔵';
      
      report += `### ${icon} ${index + 1}. ${violation.help}\n\n`;
      report += `**WCAG Rule:** \`${violation.id}\`\n\n`;
      report += `**Severity:** ${violation.impact?.toUpperCase() || 'UNKNOWN'}\n\n`;
      report += `**Total Occurrences:** ${violation.occurrences}\n\n`;
      report += `**Affected Pages:** ${violation.affectedPages.length}/${totalPages}\n`;
      
      // Show all affected pages (not just first 5)
      const uniquePages = [...new Set(violation.affectedPages)];
      report += `- ${uniquePages.join('\n- ')}\n\n`;
      
      report += `**Description:** ${violation.description}\n\n`;
      report += `**Reference:** ${violation.helpUrl}\n\n`;
      report += `---\n\n`;
    });
  }
  
  // Page-by-Page Results
  report += `## 📄 Results by Page Type\n\n`;
  
  auditResults.forEach((result, index) => {
    const icon = result.violations.length === 0 ? '✅' : '⚠️';
    report += `### ${icon} ${index + 1}. ${result.pageType}\n\n`;
    report += `**URL:** ${result.url}\n\n`;
    report += `**Status:** ${result.violations.length === 0 ? 'PASS' : `${result.violations.length} rule(s) violated`}\n\n`;
    report += `**Checks Passed:** ${result.passes}\n\n`;
    
    if (result.violations.length > 0) {
      const totalInstances = result.violations.reduce((sum: number, v: any) => 
        sum + (v.nodes?.length || 0), 0);
      report += `**Violations:** ${totalInstances} instance(s) across ${result.violations.length} rule(s)\n\n`;
      report += `**Issues:**\n`;
      result.violations.forEach((v: any) => {
        const impact = v.impact ? `[${v.impact.toUpperCase()}]` : '';
        report += `- \`${v.id}\` ${impact}: ${v.nodes?.length || 0} instance(s)\n`;
      });
      report += `\n**Detailed report:** \`a11y-${result.pageType.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}.md\`\n\n`;
    }
    
    report += `---\n\n`;
  });
  
  // Recommendations
  report += `## 🎯 Recommendations\n\n`;
  
  if (totalViolations === 0) {
    report += `Entire CCIAF site meets WCAG 2.1 Level AA requirements.\n\n`;
    report += `**Next Steps:**\n`;
    report += `1. Include this report in DAC submission evidence\n`;
    report += `2. Document for Service Assessment\n`;
    report += `3. Continue monitoring with regular audits\n`;
    report += `4. Conduct manual testing (keyboard, screen readers, zoom)\n\n`;
  } else {
    report += `Site has accessibility violations that must be addressed before DAC submission.\n\n`;
    
    report += `**Priority Actions:**\n\n`;
    
    const criticalAndSerious = Array.from(allViolations.values())
      .filter(v => v.impact === 'critical' || v.impact === 'serious')
      .sort((a, b) => b.occurrences - a.occurrences);
    
    if (criticalAndSerious.length > 0) {
      report += `**Critical/Serious (Must Fix):**\n`;
      criticalAndSerious.forEach((v, i) => {
        report += `${i + 1}. Fix **${v.occurrences} instance(s)** of: ${v.help}\n`;
        report += `   - Affects: ${[...new Set(v.affectedPages)].join(', ')}\n`;
      });
      report += `\n`;
    }
    
    const moderateAndMinor = Array.from(allViolations.values())
      .filter(v => v.impact === 'moderate' || v.impact === 'minor')
      .sort((a, b) => b.occurrences - a.occurrences);
    
    if (moderateAndMinor.length > 0) {
      report += `**Moderate/Minor (Should Fix):**\n`;
      moderateAndMinor.slice(0, 5).forEach((v, i) => {
        report += `${i + 1}. Fix **${v.occurrences} instance(s)** of: ${v.help}\n`;
      });
      if (moderateAndMinor.length > 5) {
        report += `... and ${moderateAndMinor.length - 5} more\n`;
      }
      report += `\n`;
    }
    
    report += `**Ownership & Escalation:**\n\n`;
    report += `Review each violation to determine ownership:\n`;
    report += `- **Platform/template issues** → Escalate to Salesforce platform team\n`;
    report += `- **Application content issues** → Fix in application code\n`;
    report += `- **Shared component issues** → Coordinate between teams\n\n`;
    
    report += `**Before DAC Submission:**\n`;
    report += `1. Fix all critical and serious violations\n`;
    report += `2. Re-run this audit to verify fixes\n`;
    report += `3. Conduct manual accessibility testing\n`;
    report += `4. Test with real assistive technology\n\n`;
  }
  
  report += `---\n\n`;
  report += `## 📋 About This Audit\n\n`;
  report += `**What was tested:** Complete page audit including:\n`;
  report += `- Site navigation and header\n`;
  report += `- Main content areas\n`;
  report += `- Forms and interactive elements\n`;
  report += `- Footer and supplementary content\n`;
  report += `- All visible page elements\n\n`;
  report += `**Testing Tool:** axe-core ${process.env.AXE_VERSION || '4.10.3'}\n\n`;
  report += `**Standards:** WCAG 2.1 Level A and AA (GDS Service Standard Point 5)\n\n`;
  report += `**Limitations:** This is an automated scan. Manual testing still required for:\n`;
  report += `- Keyboard navigation\n`;
  report += `- Screen reader compatibility\n`;
  report += `- Zoom/magnification behavior\n`;
  report += `- Cognitive accessibility\n`;
  report += `- Real assistive technology testing\n\n`;
  
  return report;
}