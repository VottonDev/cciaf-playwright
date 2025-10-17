/**
📁 /tests/accessibility/keyboardAccessibility.frontend.spec.ts

=========================== Standard Run (with browser) ===========================
▶️  npx playwright test ./tests/accessibility/keyboardAccessibility.frontend.spec.ts --project=chromium-frontend --headed

# Purpose: Validates keyboard accessibility per WCAG 2.1.1 (Keyboard) and 2.4.7 (Focus Visible)
# What it tests: 
#   - Tab order is logical and follows visual flow
#   - No keyboard traps exist
#   - Focus indicators are visible
#   - Interactive elements work with keyboard alone
#   - Skip links function correctly

# WCAG Success Criteria Covered:
#   - 2.1.1 Keyboard (Level A)
#   - 2.1.2 No Keyboard Trap (Level A)
#   - 2.4.3 Focus Order (Level A)
#   - 2.4.7 Focus Visible (Level AA)
*/

import { test, expect } from '@playwright/test';
import fs from 'node:fs';

interface PageConfig {
  name: string;
  url: string;
  expectedFirstFocus: string;
  minTabStops: number;
  criticalActions: string[];
}

const CRITICAL_PAGES: PageConfig[] = [
  {
    name: 'Dashboard',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessPrevious',
    expectedFirstFocus: 'skip',
    minTabStops: 5,
    criticalActions: ['Xansium'],
  },
  {
    name: 'Assessment Overview',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessment?id=a01dw0000087pCZAAY',
    expectedFirstFocus: 'skip',
    minTabStops: 8,
    criticalActions: ['Cover sheet', '1.1.', 'Document library'],
  },
  {
    name: 'Cover Sheet Read',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessCoverSheet?id=a01dw0000087pCZAAY',
    expectedFirstFocus: 'skip',
    minTabStops: 10,
    criticalActions: ['Change'],
  },
  {
    name: 'Cover Sheet Edit',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessCoverSheetEdit?id=a01dw0000087pCZAAY&pg=ratings',
    expectedFirstFocus: 'skip',
    minTabStops: 8,
    criticalActions: ['Save changes'],
  },
  {
    name: 'Practice Area',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessPracticeArea?id=a01dw0000087pCZAAY&practiceArea=a08dw000005TM8sAAG',
    expectedFirstFocus: 'skip',
    minTabStops: 10,
    criticalActions: ['Criteria'],
  },
  {
    name: 'Indicator Detail',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessIndicator?id=a01dw0000087pCZAAY&practiceArea=a08dw000005TM8sAAG&criteria=a04dw000000DXF9AAO',
    expectedFirstFocus: 'skip',
    minTabStops: 12,
    criticalActions: ['Save and return'],
  },
  {
    name: 'Document Library',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessLibrary?id=a01dw0000087pCZAAY',
    expectedFirstFocus: 'skip',
    minTabStops: 8,
    criticalActions: ['Add a document'],
  },
];

test.describe('Keyboard Accessibility - Comprehensive Page Audits', () => {
  
  for (const pageConfig of CRITICAL_PAGES) {
    test(`${pageConfig.name}: Complete keyboard accessibility audit`, async ({ page }) => {
      await page.goto(pageConfig.url);
      await page.waitForLoadState('networkidle');
      
      console.log(`\n🔍 Auditing keyboard accessibility: ${pageConfig.name}...`);
      
      const issues: string[] = [];
      const passes: string[] = [];
      const auditData: any = {
        url: page.url(),
        tabOrder: [],
        focusVisibility: [],
        trapTest: { forward: [], backward: [] },
      };
      
      // TEST 1: TAB ORDER
      console.log('  Testing tab order...');
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
        
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el) return null;
          
          const styles = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          
          return {
            tag: el.tagName,
            text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().substring(0, 60),
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            id: el.id || '',
            isVisible: styles.display !== 'none' && styles.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
            hasOutline: styles.outline !== 'none' && styles.outline !== '',
            hasBoxShadow: styles.boxShadow !== 'none',
            outlineWidth: parseFloat(styles.outlineWidth || '0'),
            position: { x: Math.round(rect.left), y: Math.round(rect.top) }
          };
        });
        
        if (focused && focused.isVisible) {
          auditData.tabOrder.push(focused);
        }
        
        if (i > 10 && focused?.tag === 'BODY') break;
      }
      
      // Analyze tab order
      if (auditData.tabOrder.length < pageConfig.minTabStops) {
        issues.push(`Only ${auditData.tabOrder.length} tab stops found (expected at least ${pageConfig.minTabStops})`);
      } else {
        passes.push(`Sufficient tab stops (${auditData.tabOrder.length})`);
      }
      
      // Check first focus
      const firstElement = auditData.tabOrder[0];
      if (firstElement && !firstElement.text.toLowerCase().includes(pageConfig.expectedFirstFocus)) {
        issues.push(`First focusable element is not skip link - found "${firstElement.text.substring(0, 40)}" instead`);
      } else if (firstElement) {
        passes.push('Skip link is first focusable element');
      }
      
      // Check critical actions in tab order
      const missingActions: string[] = [];
      for (const action of pageConfig.criticalActions) {
        const found = auditData.tabOrder.some((el: any) => 
          el.text.toLowerCase().includes(action.toLowerCase())
        );
        if (!found) {
          missingActions.push(action);
        }
      }
      
      if (missingActions.length > 0) {
        issues.push(`Critical actions not in tab order: ${missingActions.join(', ')}`);
      } else {
        passes.push('All critical actions are keyboard accessible');
      }
      
      // Check tab order flow (top to bottom)
      let outOfOrderCount = 0;
      for (let i = 1; i < Math.min(auditData.tabOrder.length, 20); i++) {
        if (auditData.tabOrder[i].position.y < auditData.tabOrder[i-1].position.y - 50) {
          outOfOrderCount++;
        }
      }
      const outOfOrderPercent = (outOfOrderCount / Math.min(auditData.tabOrder.length - 1, 19)) * 100;
      
      if (outOfOrderPercent > 30) {
        issues.push(`Tab order does not follow visual flow - ${outOfOrderPercent.toFixed(0)}% out of sequence`);
      } else {
        passes.push('Tab order follows visual flow (top to bottom)');
      }
      
      // TEST 2: KEYBOARD TRAPS
      console.log('  Testing for keyboard traps...');
      await page.goto(pageConfig.url); // Reset
      await page.waitForLoadState('networkidle');
      
      // Tab forward
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(50);
        const currentFocus = await page.evaluate(() => 
          document.activeElement?.textContent?.trim().substring(0, 50) || 'unknown'
        );
        auditData.trapTest.forward.push(currentFocus);
      }
      
      // Tab backward
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Shift+Tab');
        await page.waitForTimeout(50);
        const currentFocus = await page.evaluate(() => 
          document.activeElement?.textContent?.trim().substring(0, 50) || 'unknown'
        );
        auditData.trapTest.backward.push(currentFocus);
      }
      
      const hasForwardTrap = hasConsecutiveRepeats(auditData.trapTest.forward, 3);
      const hasBackwardTrap = hasConsecutiveRepeats(auditData.trapTest.backward, 3);
      
      if (hasForwardTrap) {
        issues.push('Keyboard trap detected when tabbing forward');
      }
      if (hasBackwardTrap) {
        issues.push('Keyboard trap detected when tabbing backward');
      }
      if (!hasForwardTrap && !hasBackwardTrap) {
        passes.push('No keyboard traps detected');
      }
      
      // TEST 3: FOCUS VISIBILITY
      console.log('  Testing focus visibility...');
      await page.goto(pageConfig.url); // Reset
      await page.waitForLoadState('networkidle');
      
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(150);
        
        const focusInfo = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          
          const styles = window.getComputedStyle(el);
          
          const hasOutline = styles.outline !== 'none' && styles.outline !== '';
          const hasOutlineWidth = parseFloat(styles.outlineWidth || '0') > 0;
          const hasBoxShadow = styles.boxShadow !== 'none' && styles.boxShadow !== '';
          const hasBorder = parseFloat(styles.borderWidth || '0') > 2;
          const hasBackground = styles.backgroundColor !== 'rgba(0, 0, 0, 0)';
          
          const isVisible = hasOutline || hasOutlineWidth || hasBoxShadow || hasBorder || hasBackground;
          
          return {
            text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 50),
            tag: el.tagName,
            visible: isVisible,
            hasOutline,
            hasBoxShadow,
            hasBorder,
          };
        });
        
        if (focusInfo) {
          let reason = '';
          if (focusInfo.hasOutline) reason = 'outline';
          else if (focusInfo.hasBoxShadow) reason = 'box-shadow';
          else if (focusInfo.hasBorder) reason = 'border';
          else reason = 'NO VISIBLE INDICATOR';
          
          auditData.focusVisibility.push({
            element: `${focusInfo.tag}: "${focusInfo.text}"`,
            visible: focusInfo.visible,
            reason,
          });
        }
        
        // Take screenshot of first 3 focus states
        if (i < 3) {
          const screenshot = await page.screenshot({ fullPage: false });
          await test.info().attach(`kb-${pageConfig.name.replace(/\s+/g, '-').toLowerCase()}-focus-${i + 1}.png`, {
            body: screenshot,
            contentType: 'image/png',
          });
        }
      }
      
      const visibleCount = auditData.focusVisibility.filter((r: any) => r.visible).length;
      const totalCount = auditData.focusVisibility.length;
      const percentVisible = totalCount > 0 ? (visibleCount / totalCount) * 100 : 0;
      
      if (percentVisible < 90) {
        issues.push(`Only ${percentVisible.toFixed(0)}% of elements have visible focus indicators (need 90%+)`);
      } else {
        passes.push(`${percentVisible.toFixed(0)}% of elements have visible focus indicators`);
      }
      
      // Generate comprehensive report
      const report = generateKeyboardReport(
        pageConfig.name,
        pageConfig.url,
        issues,
        passes,
        auditData,
        pageConfig
      );
      
      // Save report
      const filename = `kb-${pageConfig.name.toLowerCase().replace(/\s+/g, '-')}.md`;
      await test.info().attach(filename, {
        contentType: 'text/markdown',
        body: report,
      });
      
      const reportPath = test.info().outputPath(filename);
      fs.writeFileSync(reportPath, report, 'utf-8');
      
      console.log(`✓ ${pageConfig.name}: Report generated`);
      console.log(`  Issues: ${issues.length}, Passes: ${passes.length}`);
      console.log(`  📄 ${reportPath}\n`);
      
      // Soft assertions
      if (issues.length > 0) {
        console.log(`⚠️  ${pageConfig.name} has ${issues.length} keyboard accessibility issue(s)`);
      }
    });
  }
  
  // Skip link test (shared across all pages)
  test('Skip link functionality', async ({ page }) => {
    console.log('\n🔍 Testing skip link functionality...');
    
    await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessPrevious');
    await page.waitForLoadState('networkidle');
    
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    
    const skipLinkText = await page.evaluate(() => 
      document.activeElement?.textContent?.trim()
    );
    
    const positionBefore = await page.evaluate(() => {
      const el = document.activeElement;
      const rect = el?.getBoundingClientRect();
      return { y: rect?.top || 0, text: el?.textContent?.trim() };
    });
    
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    const positionAfter = await page.evaluate(() => {
      const el = document.activeElement;
      const main = document.querySelector('main, [role="main"], #main-content');
      const rect = el?.getBoundingClientRect();
      return { 
        y: rect?.top || 0, 
        text: el?.textContent?.trim().substring(0, 50),
        isMainOrWithinMain: el === main || main?.contains(el)
      };
    });
    
    const skipLinkScreenshot = await page.screenshot({ fullPage: false });
    await test.info().attach('kb-skip-link-test.png', {
      body: skipLinkScreenshot,
      contentType: 'image/png',
    });
    
    if (skipLinkText?.toLowerCase().includes('skip')) {
      console.log('✓ Skip link is first focusable element');
    } else {
      console.log(`⚠️  First element is not skip link: "${skipLinkText}"`);
    }
    
    if (positionAfter.isMainOrWithinMain) {
      console.log('✓ Skip link moves focus to main content');
    } else {
      console.log('⚠️  Skip link does not move focus to main content');
    }
  });
});

// Helper function
function hasConsecutiveRepeats(positions: string[], threshold: number): boolean {
  let consecutiveCount = 1;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] === positions[i - 1]) {
      consecutiveCount++;
      if (consecutiveCount >= threshold) {
        return true;
      }
    } else {
      consecutiveCount = 1;
    }
  }
  return false;
}

// Generate comprehensive keyboard report
function generateKeyboardReport(
  pageName: string,
  url: string,
  issues: string[],
  passes: string[],
  data: any,
  config: PageConfig
): string {
  const timestamp = new Date().toISOString();
  const totalIssues = issues.length;
  
  let report = `# Keyboard Accessibility Report: ${pageName}\n\n`;
  report += `**Date:** ${timestamp}\n\n`;
  report += `**Page:** ${url}\n\n`;
  report += `**Testing Standard:** WCAG 2.1 Level A (2.1.1 Keyboard, 2.1.2 No Keyboard Trap, 2.4.3 Focus Order, 2.4.7 Focus Visible)\n\n`;
  
  if (totalIssues === 0) {
    report += `## ✅ PASS - No Keyboard Issues Found\n\n`;
    report += `This page is fully keyboard accessible.\n\n`;
  } else {
    report += `## ❌ FAIL - ${totalIssues} Keyboard Issue(s) Found\n\n`;
    report += `This page has keyboard accessibility issues that prevent keyboard-only users from using it effectively.\n\n`;
  }
  
  report += `**Summary:**\n`;
  report += `- ✅ Passed checks: ${passes.length}\n`;
  report += `- ❌ Failed checks: ${issues.length}\n`;
  report += `- 📊 Total tab stops: ${data.tabOrder.length}\n`;
  report += `- 📊 Focus visibility: ${data.focusVisibility.filter((r: any) => r.visible).length}/${data.focusVisibility.length} (${((data.focusVisibility.filter((r: any) => r.visible).length / data.focusVisibility.length) * 100).toFixed(0)}%)\n\n`;
  
  report += `---\n\n`;
  
  // ISSUES SECTION
  if (issues.length > 0) {
    report += `## ❌ Issues That Must Be Fixed\n\n`;
    issues.forEach((issue, i) => {
      report += `### ${i + 1}. ${issue}\n\n`;
      report += getKeyboardIssueGuidance(issue) + '\n\n';
    });
    report += `---\n\n`;
  }
  
  // PASSED CHECKS
  if (passes.length > 0) {
    report += `## ✅ Passed Checks\n\n`;
    passes.forEach((pass, i) => {
      report += `${i + 1}. ${pass}\n`;
    });
    report += `\n---\n\n`;
  }
  
  // DETAILED FINDINGS
  report += `## 📊 Detailed Findings\n\n`;
  
  // Tab Order
  report += `### Tab Order (${data.tabOrder.length} stops)\n\n`;
  if (data.tabOrder.length > 0) {
    report += `**First 10 tab stops:**\n\n`;
    data.tabOrder.slice(0, 10).forEach((el: any, i: number) => {
      const focusIndicator = el.hasOutline || el.hasBoxShadow || el.outlineWidth > 0 ? '✓' : '⚠️';
      report += `${i + 1}. ${focusIndicator} **${el.tag}**: "${el.text}"\n`;
    });
    if (data.tabOrder.length > 10) {
      report += `\n... and ${data.tabOrder.length - 10} more tab stops\n`;
    }
    report += `\n`;
  }
  
  // Focus Visibility
  report += `### Focus Visibility\n\n`;
  const visibleFocus = data.focusVisibility.filter((r: any) => r.visible);
  const invisibleFocus = data.focusVisibility.filter((r: any) => !r.visible);
  
  report += `- ✅ Elements with visible focus: ${visibleFocus.length}\n`;
  report += `- ❌ Elements without visible focus: ${invisibleFocus.length}\n\n`;
  
  if (invisibleFocus.length > 0) {
    report += `**Elements missing focus indicators:**\n\n`;
    invisibleFocus.forEach((el: any, i: number) => {
      report += `${i + 1}. ${el.element}\n`;
    });
    report += `\n`;
  }
  
  // Keyboard Trap Test
  report += `### Keyboard Trap Test\n\n`;
  const hasForwardTrap = hasConsecutiveRepeats(data.trapTest.forward, 3);
  const hasBackwardTrap = hasConsecutiveRepeats(data.trapTest.backward, 3);
  
  if (!hasForwardTrap && !hasBackwardTrap) {
    report += `✅ No keyboard traps detected - users can tab forward and backward freely\n\n`;
  } else {
    if (hasForwardTrap) report += `❌ Keyboard trap detected when tabbing forward\n`;
    if (hasBackwardTrap) report += `❌ Keyboard trap detected when tabbing backward\n`;
    report += `\n`;
  }
  
  // ACTION ITEMS
  report += `---\n\n`;
  report += `## 🎯 Action Items\n\n`;
  
  if (issues.length === 0) {
    report += `✅ No action required - page is fully keyboard accessible.\n\n`;
    report += `**Next steps:**\n`;
    report += `1. Include this report in DAC audit evidence\n`;
    report += `2. Test complete user journeys with keyboard only\n`;
    report += `3. Verify with real keyboard-only users\n\n`;
  } else {
    report += `**Priority fixes:**\n\n`;
    issues.forEach((issue, i) => {
      report += `${i + 1}. ${issue}\n`;
    });
    report += `\n`;
    report += `**Before DAC submission:**\n`;
    report += `1. Fix all issues listed above\n`;
    report += `2. Re-run this automated test to verify fixes\n`;
    report += `3. Manually test complete user journeys using only keyboard\n`;
    report += `4. Verify all interactive elements work with Enter/Space keys\n\n`;
  }
  
  // MANUAL TESTING GUIDANCE
  report += `---\n\n`;
  report += `## 📋 Manual Testing Required\n\n`;
  report += `This automated scan checks basic keyboard accessibility. You must also:\n\n`;
  report += `1. **Complete user journeys with keyboard only:**\n`;
  report += `   - Unplug your mouse\n`;
  report += `   - Navigate through ${pageName} using only Tab, Shift+Tab, Enter, and Arrow keys\n`;
  report += `   - Verify all functionality is accessible\n`;
  report += `   - Ensure focus is always visible\n\n`;
  report += `2. **Test critical actions:**\n`;
  config.criticalActions.forEach(action => {
    report += `   - Can you access "${action}" with keyboard only?\n`;
  });
  report += `\n`;
  report += `3. **Test with real users:**\n`;
  report += `   - Recruit keyboard-only users (e.g., motor disability)\n`;
  report += `   - Observe how they interact with the page\n`;
  report += `   - Document any pain points or inefficiencies\n\n`;
  
  // COMMON KEYBOARD SHORTCUTS
  report += `---\n\n`;
  report += `## ⌨️  Common Keyboard Shortcuts\n\n`;
  report += `Users should be able to:\n\n`;
  report += `- **Tab** - Move to next interactive element\n`;
  report += `- **Shift+Tab** - Move to previous interactive element\n`;
  report += `- **Enter** - Activate buttons and links\n`;
  report += `- **Space** - Activate buttons, check checkboxes, toggle dropdowns\n`;
  report += `- **Arrow Keys** - Navigate within dropdowns, radio groups, menus\n`;
  report += `- **Esc** - Close modals and dialogs\n\n`;
  
  // REFERENCES
  report += `---\n\n`;
  report += `## 📚 References\n\n`;
  report += `- [WCAG 2.1.1 Keyboard](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html)\n`;
  report += `- [WCAG 2.1.2 No Keyboard Trap](https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html)\n`;
  report += `- [WCAG 2.4.3 Focus Order](https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html)\n`;
  report += `- [WCAG 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)\n`;
  report += `- [GDS: Testing for accessibility](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility)\n`;
  report += `- [WebAIM: Keyboard Accessibility](https://webaim.org/articles/keyboard/)\n\n`;
  
  return report;
}

function getKeyboardIssueGuidance(issue: string): string {
  if (issue.includes('tab stops found')) {
    return `**What this means:** The page has too few interactive elements in the tab order. Users may not be able to access all functionality.\n\n**How to fix:** Ensure all interactive elements are keyboard accessible:\n\`\`\`html\n<!-- Make sure buttons, links, and form fields are in the tab order -->\n<button>Accessible</button>\n<a href="/page">Accessible</a>\n<input type="text">\n\n<!-- Avoid using divs that look interactive but aren't -->\n<div onclick="...">Not accessible</div> <!-- ❌ Bad -->\n<button onclick="...">Accessible</button> <!-- ✅ Good -->\n\`\`\``;
  }
  
  if (issue.includes('not skip link')) {
    return `**What this means:** Keyboard users must tab through all navigation to reach main content. A skip link lets them bypass repetitive elements.\n\n**How to fix:** Add a skip link as the first focusable element:\n\`\`\`html\n<a href="#main-content" class="skip-link">Skip to main content</a>\n\n<nav><!-- navigation --></nav>\n\n<main id="main-content">\n  <!-- Your content -->\n</main>\n\`\`\`\n\nCSS to show on focus:\n\`\`\`css\n.skip-link {\n  position: absolute;\n  top: -40px;\n  left: 0;\n  background: #000;\n  color: #fff;\n  padding: 8px;\n}\n\n.skip-link:focus {\n  top: 0;\n}\n\`\`\``;
  }
  
  if (issue.includes('Critical actions not in tab order')) {
    return `**What this means:** Important buttons or links cannot be reached with the keyboard.\n\n**How to fix:**\n1. Check if the element exists but is missing \`tabindex\`\n2. Ensure it's using proper HTML elements (\`<button>\`, \`<a>\`)\n3. Don't use \`tabindex="-1"\` on interactive elements\n\n\`\`\`html\n<!-- ❌ Bad - not keyboard accessible -->\n<div onclick="submit()">Submit</div>\n\n<!-- ✅ Good - keyboard accessible -->\n<button onclick="submit()">Submit</button>\n\`\`\``;
  }
  
  if (issue.includes('does not follow visual flow')) {
    return `**What this means:** Tab order jumps around the page unpredictably, confusing keyboard users.\n\n**How to fix:**\n1. Remove custom \`tabindex\` values (use \`tabindex="0"\` only when needed)\n2. Structure HTML to match visual layout\n3. Use CSS for positioning instead of reordering HTML\n\n\`\`\`html\n<!-- ❌ Bad - HTML order doesn't match visual order -->\n<div style="order: 2">First visually</div>\n<div style="order: 1">Second visually</div>\n\n<!-- ✅ Good - HTML order matches visual order -->\n<div>First visually</div>\n<div>Second visually</div>\n\`\`\``;
  }
  
  if (issue.includes('Keyboard trap detected')) {
    return `**What this means:** Users get stuck in a section and cannot tab out - a serious accessibility blocker.\n\n**How to fix:**\n1. Check custom JavaScript that manages focus\n2. Ensure modals allow ESC key to close\n3. Test focus management in dynamic content\n\n\`\`\`javascript\n// ❌ Bad - traps focus\nmodal.addEventListener('keydown', (e) => {\n  if (e.key === 'Tab') {\n    e.preventDefault(); // Don't do this!\n  }\n});\n\n// ✅ Good - allows escape\nmodal.addEventListener('keydown', (e) => {\n  if (e.key === 'Escape') {\n    closeModal();\n  }\n});\n\`\`\``;
  }
  
  if (issue.includes('visible focus indicators')) {
    return `**What this means:** Users cannot see where focus is on the page, making keyboard navigation impossible.\n\n**How to fix:** Add visible focus styles using CSS:\n\n\`\`\`css\n/* GDS-style focus indicator (recommended) */\n*:focus {\n  outline: 3px solid #ffdd00;\n  outline-offset: 0;\n  box-shadow: 0 0 0 4px #0b0c0c;\n}\n\n/* Ensure focus is never hidden */\n*:focus {\n  outline: none; /* ❌ Never do this */\n}\n\n/* Alternative high-contrast focus */\n*:focus {\n  outline: 2px solid #005ea5;\n  outline-offset: 2px;\n}\n\`\`\`\n\n**Test your focus styles:**\n1. Tab through the page\n2. Ensure you can always see where focus is\n3. Focus should have sufficient color contrast (3:1 ratio)`;
  }
  
  return `**How to fix:** Refer to WCAG 2.1 keyboard accessibility guidelines for specific remediation steps.`;
}