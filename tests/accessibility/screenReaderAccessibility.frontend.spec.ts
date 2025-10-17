/**
📁 /tests/accessibility/screenReaderAccessibility.frontend.spec.ts

=========================== Standard Run (with browser) ===========================
▶️ npx playwright test ./tests/accessibility/screenReaderAccessibility.frontend.spec.ts --project=chromium-frontend
*/

import { test, expect } from '@playwright/test';
import fs from 'node:fs';

interface PageConfig {
  name: string;
  url: string;
  expectedTitle: string;
  shouldHaveMainLandmark: boolean;
  shouldHaveNavigation: boolean;
  minHeadings: number;
}

const PAGES_TO_TEST: PageConfig[] = [
  {
    name: 'Dashboard',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessPrevious',
    expectedTitle: 'CCIAF',
    shouldHaveMainLandmark: true,
    shouldHaveNavigation: true,
    minHeadings: 2,
  },
  {
    name: 'Assessment Overview',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessment?id=a01dw0000087pCZAAY',
    expectedTitle: 'CCIAF',
    shouldHaveMainLandmark: true,
    shouldHaveNavigation: true,
    minHeadings: 3,
  },
  {
    name: 'Cover Sheet',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessCoverSheet?id=a01dw0000087pCZAAY',
    expectedTitle: 'CCIAF',
    shouldHaveMainLandmark: true,
    shouldHaveNavigation: true,
    minHeadings: 4,
  },
  {
    name: 'Practice Area',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessPracticeArea?id=a01dw0000087pCZAAY&practiceArea=a08dw000005TM8sAAG',
    expectedTitle: 'CCIAF',
    shouldHaveMainLandmark: true,
    shouldHaveNavigation: true,
    minHeadings: 3,
  },
  {
    name: 'Indicator Detail',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessIndicator?id=a01dw0000087pCZAAY&practiceArea=a08dw000005TM8sAAG&criteria=a04dw000000DXF9AAO',
    expectedTitle: 'CCIAF',
    shouldHaveMainLandmark: true,
    shouldHaveNavigation: true,
    minHeadings: 3,
  },
  {
    name: 'Document Library',
    url: 'https://cogcg--autotests.sandbox.my.site.com/cciaf/CCIAFAssessLibrary?id=a01dw0000087pCZAAY',
    expectedTitle: 'CCIAF',
    shouldHaveMainLandmark: true,
    shouldHaveNavigation: true,
    minHeadings: 2,
  },
];

test.describe('Screen Reader Accessibility - Comprehensive Page Audits', () => {
  
  for (const pageConfig of PAGES_TO_TEST) {
    test(`${pageConfig.name}: Complete screen reader accessibility audit`, async ({ page }) => {
      await page.goto(pageConfig.url);
      await page.waitForLoadState('networkidle');
      
      console.log(`\n🔍 Auditing ${pageConfig.name}...`);
      
      // Collect all data in one pass
      const auditData = await page.evaluate((config) => {
        const results: any = {
          url: window.location.href,
          title: document.title,
          landmarks: [],
          headings: [],
          formFields: [],
          links: [],
          images: [],
        };
        
        // 1. LANDMARKS
        const landmarkRoles = ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'form'];
        landmarkRoles.forEach(role => {
          const elements = document.querySelectorAll(`[role="${role}"]`);
          elements.forEach(el => {
            results.landmarks.push({
              role,
              label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || null,
              tagName: el.tagName,
              childCount: el.children.length,
            });
          });
        });
        
        // Semantic HTML5 landmarks
        const semanticLandmarks = [
          { selector: 'header', role: 'banner' },
          { selector: 'nav', role: 'navigation' },
          { selector: 'main', role: 'main' },
          { selector: 'aside', role: 'complementary' },
          { selector: 'footer', role: 'contentinfo' },
        ];
        
        semanticLandmarks.forEach(({ selector, role }) => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (!el.getAttribute('role')) {
              results.landmarks.push({
                role,
                label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || null,
                tagName: el.tagName,
                childCount: el.children.length,
              });
            }
          });
        });
        
        // 2. HEADINGS
        for (let level = 1; level <= 6; level++) {
          const elements = document.querySelectorAll(`h${level}`);
          elements.forEach(el => {
            results.headings.push({
              level,
              text: el.textContent?.trim() || '',
              id: el.id || '',
            });
          });
        }
        
        // 3. FORM FIELDS
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
          const element = input as HTMLInputElement;
          const type = element.type || element.tagName.toLowerCase();
          
          if (type === 'hidden') return;
          
          let labelText: string | null = null;
          let hasLabel = false;
          
          const parentLabel = element.closest('label');
          if (parentLabel) {
            labelText = parentLabel.textContent?.trim() || null;
            hasLabel = true;
          }
          
          if (!hasLabel && element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) {
              labelText = label.textContent?.trim() || null;
              hasLabel = true;
            }
          }
          
          results.formFields.push({
            type,
            label: labelText,
            hasLabel,
            ariaLabel: element.getAttribute('aria-label'),
            ariaLabelledBy: element.getAttribute('aria-labelledby'),
            ariaDescribedBy: element.getAttribute('aria-describedby'),
            required: element.hasAttribute('required') || element.getAttribute('aria-required') === 'true',
          });
        });
        
        // 4. LINKS
        const linkElements = document.querySelectorAll('a[href]');
        linkElements.forEach(link => {
          const element = link as HTMLAnchorElement;
          const text = element.textContent?.trim() || '';
          const ariaLabel = element.getAttribute('aria-label');
          const title = element.getAttribute('title');
          
          const hasContext = !!(
            element.closest('h1, h2, h3, h4, h5, h6') ||
            element.closest('li') ||
            element.closest('[role="listitem"]')
          );
          
          results.links.push({
            text,
            href: element.href,
            hasAriaLabel: !!ariaLabel,
            ariaLabel,
            title,
            hasContext,
          });
        });
        
        // 5. IMAGES
        const imgElements = document.querySelectorAll('img');
        imgElements.forEach(img => {
          const alt = img.getAttribute('alt');
          const role = img.getAttribute('role');
          const ariaLabel = img.getAttribute('aria-label');
          const isDecorative = alt === '' || role === 'presentation' || role === 'none';
          
          results.images.push({
            src: img.src,
            alt,
            hasAlt: alt !== null,
            role,
            ariaLabel,
            isDecorative,
          });
        });
        
        return results;
      }, pageConfig);
      
      // Analyze the collected data
      const issues: string[] = [];
      const passes: string[] = [];
      
      // PAGE TITLE CHECK
      if (!auditData.title || auditData.title.length === 0) {
        issues.push('Page has no title');
      } else if (!auditData.title.includes(pageConfig.expectedTitle)) {
        issues.push(`Page title "${auditData.title}" does not contain expected text "${pageConfig.expectedTitle}"`);
      } else {
        passes.push('Page has descriptive title');
      }
      
      // LANDMARK CHECKS
      const hasMain = auditData.landmarks.some((l: any) => l.role === 'main');
      const hasNav = auditData.landmarks.some((l: any) => l.role === 'navigation');
      
      if (pageConfig.shouldHaveMainLandmark && !hasMain) {
        issues.push('Missing main landmark - screen reader users cannot navigate to main content');
      } else if (hasMain) {
        passes.push('Main landmark present');
      }
      
      if (pageConfig.shouldHaveNavigation && !hasNav) {
        issues.push('Missing navigation landmark - screen reader users cannot find site navigation');
      } else if (hasNav) {
        passes.push('Navigation landmark present');
      }
      
      if (auditData.landmarks.length === 0) {
        issues.push('No ARIA landmarks found - screen reader users cannot navigate efficiently');
      }
      
      // HEADING CHECKS
      const h1Count = auditData.headings.filter((h: any) => h.level === 1).length;
      
      if (h1Count === 0) {
        issues.push('Missing H1 heading - screen reader users cannot understand page purpose');
      } else if (h1Count > 1) {
        issues.push(`Multiple H1 headings found (${h1Count}) - should have exactly one`);
      } else {
        passes.push('Exactly one H1 heading');
      }
      
      if (auditData.headings.length < pageConfig.minHeadings) {
        issues.push(`Only ${auditData.headings.length} headings found (expected at least ${pageConfig.minHeadings})`);
      }
      
      // Check for heading level skips
      const skippedLevels: string[] = [];
      for (let i = 1; i < auditData.headings.length; i++) {
        const current = auditData.headings[i];
        const previous = auditData.headings[i - 1];
        const levelDiff = current.level - previous.level;
        
        if (levelDiff > 1) {
          skippedLevels.push(`H${previous.level} → H${current.level} (skipped ${levelDiff - 1} level(s))`);
        }
      }
      
      if (skippedLevels.length > 0) {
        issues.push(`Heading levels skipped: ${skippedLevels.join(', ')}`);
      } else if (auditData.headings.length > 0) {
        passes.push('No heading level skips');
      }
      
      // FORM FIELD CHECKS
      if (auditData.formFields.length > 0) {
        const fieldsWithoutLabels = auditData.formFields.filter((f: any) => 
          !f.hasLabel && !f.ariaLabel && !f.ariaLabelledBy
        );
        
        if (fieldsWithoutLabels.length > 0) {
          issues.push(`${fieldsWithoutLabels.length} form field(s) without labels - screen reader users cannot identify field purpose`);
        } else {
          passes.push('All form fields have labels');
        }
      }
      
      // LINK CHECKS
      if (auditData.links.length > 0) {
        const ambiguousLinks = auditData.links.filter((l: any) => {
          const hasText = l.text.length > 0;
          const hasAriaLabel = l.hasAriaLabel;
          const hasTitle = !!l.title;
          
          if (!hasText && !hasAriaLabel && !hasTitle) return true;
          
          const genericTexts = ['click here', 'read more', 'more', 'here', 'link'];
          const isGeneric = genericTexts.some((generic: string) => 
            l.text.toLowerCase().trim() === generic
          );
          
          return isGeneric && !hasAriaLabel && !hasTitle && !l.hasContext;
        });
        
        if (ambiguousLinks.length > 0) {
          issues.push(`${ambiguousLinks.length} link(s) with unclear purpose (e.g., "click here", "read more")`);
        } else {
          passes.push('All links have clear purpose');
        }
      }
      
      // IMAGE CHECKS
      if (auditData.images.length > 0) {
        const missingAlt = auditData.images.filter((img: any) => !img.hasAlt);
        
        if (missingAlt.length > 0) {
          issues.push(`${missingAlt.length} image(s) missing alt attribute - screen reader users cannot understand image content`);
        } else {
          passes.push('All images have alt attributes');
        }
      }
      
      // Generate comprehensive report
      const report = generateComprehensiveReport(
        pageConfig.name,
        auditData,
        issues,
        passes,
        pageConfig
      );
      
      // Save report
      const filename = `sr-${pageConfig.name.toLowerCase().replace(/\s+/g, '-')}.md`;
      await test.info().attach(filename, {
        contentType: 'text/markdown',
        body: report,
      });
      
      const reportPath = test.info().outputPath(filename);
      fs.writeFileSync(reportPath, report, 'utf-8');
      
      console.log(`✓ ${pageConfig.name}: Report generated`);
      console.log(`  Issues: ${issues.length}, Passes: ${passes.length}`);
      console.log(`  📄 ${reportPath}\n`);
      
      // Test assertions (soft fail to generate all reports)
      if (issues.length > 0) {
        console.log(`⚠️  ${pageConfig.name} has ${issues.length} screen reader issue(s)`);
      }
    });
  }
  
  // Generate master checklist
  test('Generate master screen reader testing checklist', async () => {
    const checklist = generateScreenReaderChecklist();
    
    await test.info().attach('sr-testing-checklist.md', {
      contentType: 'text/markdown',
      body: checklist,
    });
    
    const checklistPath = test.info().outputPath('sr-testing-checklist.md');
    fs.writeFileSync(checklistPath, checklist, 'utf-8');
    
    console.log('\n📋 Master checklist generated');
    console.log(`   ${checklistPath}\n`);
  });
});

// Generate comprehensive report (similar to platformAccessibility style)
function generateComprehensiveReport(
  pageName: string,
  data: any,
  issues: string[],
  passes: string[],
  config: PageConfig
): string {
  const timestamp = new Date().toISOString();
  const totalIssues = issues.length;
  
  let report = `# Screen Reader Accessibility Report: ${pageName}\n\n`;
  report += `**Date:** ${timestamp}\n\n`;
  report += `**Page:** ${data.url}\n\n`;
  report += `**Testing Standard:** WCAG 2.1 Level A and AA (GDS Service Standard Point 5)\n\n`;
  
  if (totalIssues === 0) {
    report += `## ✅ PASS - No Screen Reader Issues Found\n\n`;
    report += `This page meets screen reader accessibility requirements.\n\n`;
  } else {
    report += `## ❌ FAIL - ${totalIssues} Screen Reader Issue(s) Found\n\n`;
    report += `This page has accessibility issues that affect screen reader users.\n\n`;
  }
  
  report += `**Summary:**\n`;
  report += `- ✅ Passed checks: ${passes.length}\n`;
  report += `- ❌ Failed checks: ${issues.length}\n`;
  report += `- 📊 Landmarks: ${data.landmarks.length}\n`;
  report += `- 📊 Headings: ${data.headings.length}\n`;
  report += `- 📊 Form fields: ${data.formFields.length}\n`;
  report += `- 📊 Links: ${data.links.length}\n`;
  report += `- 📊 Images: ${data.images.length}\n\n`;
  
  report += `---\n\n`;
  
  // ISSUES SECTION
  if (issues.length > 0) {
    report += `## ❌ Issues That Must Be Fixed\n\n`;
    issues.forEach((issue, i) => {
      report += `### ${i + 1}. ${issue}\n\n`;
      report += getIssueGuidance(issue) + '\n\n';
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
  
  // Page Title
  report += `### Page Title\n\n`;
  report += `**Current title:** "${data.title}"\n\n`;
  if (data.title && data.title.length > 0) {
    report += `✅ Page has a title that screen readers will announce on page load.\n\n`;
  } else {
    report += `❌ Missing page title - screen readers cannot announce page purpose.\n\n`;
  }
  
  // Landmarks
  report += `### ARIA Landmarks (${data.landmarks.length})\n\n`;
  if (data.landmarks.length === 0) {
    report += `❌ No landmarks found - screen reader users cannot navigate efficiently.\n\n`;
  } else {
    const landmarksByRole = data.landmarks.reduce((acc: any, l: any) => {
      if (!acc[l.role]) acc[l.role] = [];
      acc[l.role].push(l);
      return acc;
    }, {});
    
    Object.entries(landmarksByRole).forEach(([role, items]: [string, any]) => {
      report += `**${role}:** ${items.length}\n`;
      items.forEach((item: any, i: number) => {
        report += `  ${i + 1}. \`<${item.tagName.toLowerCase()}>\``;
        if (item.label) report += ` — "${item.label}"`;
        report += `\n`;
      });
    });
    report += `\n`;
  }
  
  // Headings
  report += `### Heading Structure (${data.headings.length})\n\n`;
  if (data.headings.length === 0) {
    report += `❌ No headings found - screen reader users cannot navigate by headings.\n\n`;
  } else {
    const h1 = data.headings.find((h: any) => h.level === 1);
    if (h1) {
      report += `**H1:** "${h1.text}"\n\n`;
    }
    
    report += `**Hierarchy:**\n`;
    data.headings.slice(0, 10).forEach((h: any, i: number) => {
      const indent = '  '.repeat(h.level - 1);
      report += `${indent}- H${h.level}: "${h.text.substring(0, 60)}${h.text.length > 60 ? '...' : ''}"\n`;
    });
    if (data.headings.length > 10) {
      report += `... and ${data.headings.length - 10} more headings\n`;
    }
    report += `\n`;
  }
  
  // Form Fields
  if (data.formFields.length > 0) {
    report += `### Form Fields (${data.formFields.length})\n\n`;
    const labeled = data.formFields.filter((f: any) => f.hasLabel || f.ariaLabel || f.ariaLabelledBy).length;
    const unlabeled = data.formFields.length - labeled;
    
    report += `- ✅ With labels: ${labeled}\n`;
    if (unlabeled > 0) {
      report += `- ❌ Without labels: ${unlabeled}\n`;
    }
    report += `\n`;
    
    if (unlabeled > 0) {
      report += `**Fields missing labels:**\n`;
      data.formFields
        .filter((f: any) => !f.hasLabel && !f.ariaLabel && !f.ariaLabelledBy)
        .slice(0, 5)
        .forEach((f: any, i: number) => {
          report += `${i + 1}. ${f.type}\n`;
        });
      report += `\n`;
    }
  }
  
  // Links
  if (data.links.length > 0) {
    report += `### Links (${data.links.length})\n\n`;
    const ambiguous = data.links.filter((l: any) => {
      if (!l.text && !l.ariaLabel && !l.title) return true;
      const genericTexts = ['click here', 'read more', 'more', 'here', 'link'];
      return genericTexts.some((g: string) => l.text.toLowerCase().trim() === g) && !l.ariaLabel && !l.title && !l.hasContext;
    });
    
    report += `- ✅ Clear purpose: ${data.links.length - ambiguous.length}\n`;
    if (ambiguous.length > 0) {
      report += `- ❌ Ambiguous: ${ambiguous.length}\n\n`;
      report += `**Examples of ambiguous links:**\n`;
      ambiguous.slice(0, 5).forEach((l: any, i: number) => {
        report += `${i + 1}. "${l.text}" → \`${l.href.substring(0, 60)}\`\n`;
      });
    }
    report += `\n`;
  }
  
  // Images
  if (data.images.length > 0) {
    report += `### Images (${data.images.length})\n\n`;
    const withAlt = data.images.filter((img: any) => img.hasAlt).length;
    const missingAlt = data.images.length - withAlt;
    const decorative = data.images.filter((img: any) => img.isDecorative).length;
    const content = data.images.length - decorative;
    
    report += `- Content images: ${content}\n`;
    report += `- Decorative images: ${decorative}\n`;
    report += `- ✅ With alt attribute: ${withAlt}\n`;
    if (missingAlt > 0) {
      report += `- ❌ Missing alt attribute: ${missingAlt}\n`;
    }
    report += `\n`;
  }
  
  // ACTION ITEMS
  report += `---\n\n`;
  report += `## 🎯 Action Items\n\n`;
  
  if (issues.length === 0) {
    report += `✅ No action required - page meets screen reader accessibility requirements.\n\n`;
    report += `**Next steps:**\n`;
    report += `1. Include this report in DAC audit evidence\n`;
    report += `2. Conduct manual screen reader testing to verify\n`;
    report += `3. Test with real assistive technology users\n\n`;
  } else {
    report += `**Priority fixes:**\n\n`;
    issues.forEach((issue, i) => {
      report += `${i + 1}. ${issue}\n`;
    });
    report += `\n`;
    report += `**Before DAC submission:**\n`;
    report += `1. Fix all issues listed above\n`;
    report += `2. Re-run this automated test to verify fixes\n`;
    report += `3. Conduct manual testing with screen readers (NVDA, JAWS, VoiceOver)\n`;
    report += `4. Test complete user journeys with screen reader only\n\n`;
  }
  
  // MANUAL TESTING GUIDANCE
  report += `---\n\n`;
  report += `## 📋 Manual Testing Required\n\n`;
  report += `This automated scan cannot test everything. You must also:\n\n`;
  report += `1. **Test with real screen readers:**\n`;
  report += `   - NVDA (Windows) - https://www.nvaccess.org/\n`;
  report += `   - JAWS (Windows) - https://www.freedomscientific.com/\n`;
  report += `   - VoiceOver (Mac) - Built-in (Cmd+F5)\n\n`;
  report += `2. **Complete user journeys:**\n`;
  report += `   - Navigate this page using only keyboard + screen reader\n`;
  report += `   - Verify all content is announced correctly\n`;
  report += `   - Check that interactive elements work as expected\n`;
  report += `   - Ensure form submissions provide appropriate feedback\n\n`;
  report += `3. **Test with real users:**\n`;
  report += `   - Recruit screen reader users for testing\n`;
  report += `   - Observe how they interact with the page\n`;
  report += `   - Document any pain points or confusion\n\n`;
  
  report += `**See the master checklist:** \`sr-testing-checklist.md\`\n\n`;
  
  // REFERENCES
  report += `---\n\n`;
  report += `## 📚 References\n\n`;
  report += `- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)\n`;
  report += `- [GDS: Making your service accessible](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction)\n`;
  report += `- [GDS: Testing for accessibility](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility)\n`;
  report += `- [WebAIM: Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)\n\n`;
  
  return report;
}

function getIssueGuidance(issue: string): string {
  const guidance: Record<string, string> = {
    'Page has no title': `**What this means:** Screen readers announce the page title when users navigate to a page. Without a title, users cannot understand where they are.\n\n**How to fix:** Add a \`<title>\` element in the \`<head>\` of the page:\n\`\`\`html\n<title>Dashboard - CCIAF Assessment Platform</title>\n\`\`\``,
    
    'Missing main landmark': `**What this means:** Screen reader users rely on landmarks to navigate efficiently. The "main" landmark identifies the primary content area.\n\n**How to fix:** Add a \`<main>\` element or \`role="main"\` to the primary content container:\n\`\`\`html\n<main id="main-content">\n  <!-- Your page content -->\n</main>\n\`\`\``,
    
    'Missing navigation landmark': `**What this means:** Screen reader users cannot quickly locate site navigation without a navigation landmark.\n\n**How to fix:** Add a \`<nav>\` element or \`role="navigation"\` to navigation areas:\n\`\`\`html\n<nav aria-label="Main navigation">\n  <!-- Navigation links -->\n</nav>\n\`\`\``,
    
    'No ARIA landmarks found': `**What this means:** Without landmarks, screen reader users must listen to every element sequentially. They cannot skip to sections.\n\n**How to fix:** Use semantic HTML5 elements or ARIA roles:\n- \`<header>\` or \`role="banner"\` for site header\n- \`<nav>\` or \`role="navigation"\` for navigation\n- \`<main>\` or \`role="main"\` for main content\n- \`<footer>\` or \`role="contentinfo"\` for footer`,
    
    'Missing H1 heading': `**What this means:** The H1 describes the page purpose. Screen reader users often jump to the H1 first to understand the page.\n\n**How to fix:** Add exactly one H1 heading that describes the page:\n\`\`\`html\n<h1>Assessment Dashboard</h1>\n\`\`\``,
    
    'Multiple H1 headings': `**What this means:** Multiple H1 headings confuse the page structure. There should be only one main heading.\n\n**How to fix:** Use only one H1. Convert additional H1s to H2, H3, etc. based on their hierarchy.`,
    
    'form field(s) without labels': `**What this means:** Screen reader users cannot tell what information to enter in unlabeled form fields.\n\n**How to fix:** Add a \`<label>\` element for each input:\n\`\`\`html\n<label for="email">Email address</label>\n<input type="email" id="email" name="email">\n\`\`\`\n\nOr use \`aria-label\`:\n\`\`\`html\n<input type="email" aria-label="Email address" name="email">\n\`\`\``,
    
    'link(s) with unclear purpose': `**What this means:** Links like "click here" or "read more" don't make sense out of context. Screen reader users often navigate by links alone.\n\n**How to fix:** Make link text descriptive:\n\`\`\`html\n<!-- ❌ Bad -->\n<a href="/report">Click here</a>\n\n<!-- ✅ Good -->\n<a href="/report">View the Q4 assessment report</a>\n\`\`\`\n\nOr add \`aria-label\`:\n\`\`\`html\n<a href="/report" aria-label="View the Q4 assessment report">Read more</a>\n\`\`\``,
    
    'image(s) missing alt attribute': `**What this means:** Screen readers cannot describe images without alt text. Users miss important visual information.\n\n**How to fix:** Add descriptive alt text:\n\`\`\`html\n<!-- Content image -->\n<img src="chart.png" alt="Bar chart showing Q4 performance increased 25%">\n\n<!-- Decorative image -->\n<img src="decoration.png" alt="">\n\`\`\``,
    
    'Heading levels skipped': `**What this means:** Skipping heading levels (e.g., H2 → H4) breaks the document outline. Screen reader users may think content is missing.\n\n**How to fix:** Use sequential heading levels:\n\`\`\`html\n<h1>Main Title</h1>\n  <h2>Section</h2>\n    <h3>Subsection</h3>  <!-- Don't skip to H4 -->\n\`\`\``,
  };
  
  // Find matching guidance
  for (const [key, value] of Object.entries(guidance)) {
    if (issue.includes(key)) {
      return value;
    }
  }
  
  return `**How to fix:** Refer to WCAG 2.1 guidelines for specific remediation steps.`;
}

function generateScreenReaderChecklist(): string {
  let report = `# Manual Screen Reader Testing Checklist for CCIAF\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  report += `Use this checklist alongside automated reports to ensure complete screen reader accessibility.\n\n`;
  report += `---\n\n`;
  
  report += `## ✅ Setup\n\n`;
  report += `Before testing, ensure you have:\n\n`;
  report += `- [ ] Installed a screen reader (NVDA, JAWS, or VoiceOver)\n`;
  report += `- [ ] Read the keyboard shortcuts for your screen reader\n`;
  report += `- [ ] Reviewed the automated reports for each page\n`;
  report += `- [ ] Prepared test scenarios for critical user journeys\n\n`;
  
  report += `---\n\n`;
  
  report += `## 📋 Testing Checklist\n\n`;
  
  report += `### Test Each Page Type\n\n`;
  report += `For Dashboard, Assessment Overview, Cover Sheet, Practice Area, Indicator Detail, and Document Library:\n\n`;
  
  report += `**1. Page Load & Title**\n`;
  report += `- [ ] Page title is announced on load\n`;
  report += `- [ ] Title accurately describes the page\n\n`;
  
  report += `**2. Landmarks & Navigation**\n`;
  report += `- [ ] Can navigate by landmarks (D key in NVDA/JAWS)\n`;
  report += `- [ ] Main landmark contains primary content\n`;
  report += `- [ ] Navigation landmark(s) clearly labeled\n`;
  report += `- [ ] Skip link works and moves focus to main content\n\n`;
  
  report += `**3. Headings**\n`;
  report += `- [ ] Can navigate by headings (H key)\n`;
  report += `- [ ] H1 describes the page purpose\n`;
  report += `- [ ] Heading hierarchy is logical (no skipped levels)\n`;
  report += `- [ ] Section headings describe their content\n\n`;
  
  report += `**4. Forms (if present)**\n`;
  report += `- [ ] All form fields have labels announced\n`;
  report += `- [ ] Required fields announced as required\n`;
  report += `- [ ] Error messages announced and associated with fields\n`;
  report += `- [ ] Hint text announced with fields\n`;
  report += `- [ ] Can complete and submit form using screen reader only\n\n`;
  
  report += `**5. Links**\n`;
  report += `- [ ] Can navigate by links (K key)\n`;
  report += `- [ ] Link purpose is clear from link text alone\n`;
  report += `- [ ] No generic "click here" or "read more" without context\n\n`;
  
  report += `**6. Images**\n`;
  report += `- [ ] Content images have descriptive alt text announced\n`;
  report += `- [ ] Decorative images are not announced (skipped)\n`;
  report += `- [ ] Alt text provides equivalent information\n\n`;
  
  report += `**7. Interactive Elements**\n`;
  report += `- [ ] Buttons announce their purpose\n`;
  report += `- [ ] Button state changes announced (pressed, expanded, etc.)\n`;
  report += `- [ ] Dropdowns announce options and selection\n`;
  report += `- [ ] Checkboxes/radios announce state (checked/unchecked)\n\n`;
  
  report += `**8. Dynamic Content**\n`;
  report += `- [ ] Loading states announced\n`;
  report += `- [ ] Success/error messages announced automatically\n`;
  report += `- [ ] Content updates announced (ARIA live regions)\n\n`;
  
  report += `---\n\n`;
  
  report += `## 🎯 Critical User Journeys\n\n`;
  report += `Complete these tasks using ONLY the screen reader:\n\n`;
  
  report += `### Journey 1: Access Assessment\n`;
  report += `- [ ] Sign in to platform\n`;
  report += `- [ ] Navigate to dashboard\n`;
  report += `- [ ] Find and select "Xansium QA - October" assessment\n`;
  report += `- [ ] Understand assessment status from screen reader alone\n\n`;
  
  report += `### Journey 2: Update Criteria\n`;
  report += `- [ ] Navigate to a practice area\n`;
  report += `- [ ] Find and open a specific criteria\n`;
  report += `- [ ] Fill in "Supporting evidence" field\n`;
  report += `- [ ] Select an "Attainment" level\n`;
  report += `- [ ] Save changes\n`;
  report += `- [ ] Confirm success message announced\n\n`;
  
  report += `### Journey 3: Manage Documents\n`;
  report += `- [ ] Navigate to Document Library\n`;
  report += `- [ ] Understand document list structure\n`;
  report += `- [ ] Add a new document (if testing upload)\n`;
  report += `- [ ] Find a specific document\n`;
  report += `- [ ] Understand document metadata (title, date, status)\n\n`;
  
  report += `---\n\n`;
  
  report += `## 🐛 Issue Documentation\n\n`;
  report += `When you find an issue, document:\n\n`;
  report += `**Issue #:** ___\n`;
  report += `**Page:** ___\n`;
  report += `**Element:** ___\n`;
  report += `**Screen Reader:** ___\n`;
  report += `**What happened:** ___\n`;
  report += `**What should happen:** ___\n`;
  report += `**Severity:** [ ] Blocker [ ] Major [ ] Minor\n`;
  report += `**Can workaround?** [ ] Yes [ ] No\n\n`;
  
  report += `---\n\n`;
  
  report += `## ✍️ Sign-Off\n\n`;
  report += `**Tester Name:** _________________\n\n`;
  report += `**Date:** _________________\n\n`;
  report += `**Screen Readers Used:** _________________\n\n`;
  report += `**Pages Tested:** _________________\n\n`;
  report += `**Critical Issues Found:** ___\n`;
  report += `**Major Issues Found:** ___\n`;
  report += `**Minor Issues Found:** ___\n\n`;
  report += `**Result:** [ ] PASS  [ ] FAIL  [ ] PASS WITH MINOR ISSUES\n\n`;
  report += `**Ready for DAC Audit:** [ ] YES  [ ] NO\n\n`;
  report += `**Notes:**\n\n\n\n`;
  
  return report;
}