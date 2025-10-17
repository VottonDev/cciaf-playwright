import { Page, test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import fs from 'node:fs';

type Impact = 'minor' | 'moderate' | 'serious' | 'critical';

interface ScanOptions {
  include?: string[];
  exclude?: string[];
  failOnImpacts?: Impact[];
  softFail?: boolean;
  screenshot?: boolean;
  rules?: string[];
}

export async function axeScan(
  page: Page,
  label: string,
  opts: ScanOptions = {}
) {
  const failOn = opts.failOnImpacts ?? ['serious', 'critical'];
  const softFail = opts.softFail ?? false;
  const screenshot = opts.screenshot ?? true;

  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']);

  // Apply custom rules if provided (array of rule IDs)
  if (opts.rules && opts.rules.length > 0) {
    builder = builder.withRules(opts.rules);
  }
  // Otherwise let withTags handle rule selection

  if (opts.include?.length) {
    for (const s of opts.include) builder = builder.include(s);
  } else {
    builder = builder.include('main, .govuk-main-wrapper, #main-content, body');
  }

  if (opts.exclude?.length) {
    for (const s of opts.exclude) builder = builder.exclude(s);
  }

  const results = await builder.analyze();
  const url = results.url || page.url();
  const timestamp = new Date().toISOString();
  const vio = results.violations ?? [];
  const toFail = vio.filter(v => (v.impact ? failOn.includes(v.impact as Impact) : true));

  // Take screenshot if violations found
  if (toFail.length > 0 && screenshot) {
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    await test.info().attach(`${label}-screenshot.png`, {
      contentType: 'image/png',
      body: screenshotBuffer,
    });
    const screenshotPath = test.info().outputPath(`${label}-screenshot.png`);
    fs.writeFileSync(screenshotPath, screenshotBuffer);
  }

  const json = JSON.stringify(results, null, 2);
  await test.info().attach(`a11y-${label}.json`, {
    contentType: 'application/json',
    body: json,
  });
  const jsonPath = test.info().outputPath(`a11y-${label}.json`);
  fs.writeFileSync(jsonPath, json, 'utf-8');

  const report = buildStakeholderReport(label, url, timestamp, results, toFail, opts);
  await test.info().attach(`a11y-${label}.md`, {
    contentType: 'text/markdown',
    body: report,
  });
  const mdPath = test.info().outputPath(`a11y-${label}.md`);
  fs.writeFileSync(mdPath, report, 'utf-8');

  console.log(`\n📎 Accessibility reports saved:`);
  console.log(`   - ${jsonPath}`);
  console.log(`   - ${mdPath}`);
  if (toFail.length > 0 && screenshot) {
    console.log(`   - ${test.info().outputPath(`${label}-screenshot.png`)}`);
  }

  // Handle soft vs hard failure
  if (softFail) {
    if (toFail.length > 0) {
      const totalInstances = toFail.reduce((sum, v) => sum + (v.nodes?.length ?? 0), 0);
      console.log(`\n⚠️  Accessibility violations @ ${label}:`);
      toFail.forEach(v => {
        const icon = v.impact === 'critical' ? '🔴' : '🟠';
        console.log(`   ${icon} ${v.impact?.toUpperCase()}: ${v.description}`);
        console.log(`      ${v.nodes?.length ?? 0} instance(s) found`);
      });
      console.log(`   Total: ${totalInstances} violation(s)`);
      console.log('   (Soft fail - test continues)\n');
    } else {
      console.log(`✓ No critical accessibility violations @ ${label}`);
    }
  } else {
    expect(toFail, `Accessibility issues @ ${label}`).toEqual([]);
  }
}

function buildStakeholderReport(
  label: string,
  url: string,
  timestamp: string,
  results: any,
  criticalViolations: any[],
  opts: ScanOptions
): string {
  let report = `# Accessibility Report: ${label}\n\n`;
  report += `**Date:** ${timestamp}\n\n`;
  report += `**Page:** ${url}\n\n`;
  report += `**Tested with:** ${results.testEngine?.name || 'axe-core'} ${results.testEngine?.version || 'unknown'}\n\n`;
  report += `**WCAG Level:** 2.1 Level A and AA (GDS Standard)\n\n`;
  report += `**Scope:** ${opts.include?.join(', ') || 'main, .govuk-main-wrapper, #main-content, body'}\n\n`;
  if (opts.exclude?.length) {
    report += `**Excluded:** ${opts.exclude.join(', ')}\n\n`;
  }
  report += `---\n\n`;

  const allViolations = results.violations ?? [];

  if (criticalViolations.length === 0) {
    report += `## ✅ PASS - No Critical Violations\n\n`;
    if (allViolations.length === 0) {
      report += `This page meets WCAG 2.1 Level A and AA requirements (GDS Service Standard Point 5).\n\n`;
    } else {
      report += `This page has no critical or serious violations. Minor/moderate issues may exist but do not block service assessment.\n\n`;
    }
    report += `- **Critical/Serious violations:** 0\n`;
    report += `- **All violations:** ${allViolations.length}\n`;
    report += `- **Passed checks:** ${results.passes?.length ?? 0}\n`;
    report += `- **Not applicable:** ${results.inapplicable?.length ?? 0}\n\n`;
  } else {
    const totalInstances = criticalViolations.reduce((sum, v) => sum + (v.nodes?.length ?? 0), 0);
    report += `## ❌ FAIL - ${criticalViolations.length} Critical Issue(s) Found\n\n`;
    report += `This page has **${totalInstances} accessibility violation(s)** that must be fixed.\n\n`;

    const bySeverity = criticalViolations.reduce((acc, v) => {
      const impact = v.impact || 'unknown';
      acc[impact] = (acc[impact] || 0) + (v.nodes?.length ?? 0);
      return acc;
    }, {} as Record<string, number>);

    report += `### Severity Breakdown\n\n`;
    if (bySeverity.critical) {
      report += `- 🔴 **Critical:** ${bySeverity.critical} instance(s) - Must fix immediately\n`;
    }
    if (bySeverity.serious) {
      report += `- 🟠 **Serious:** ${bySeverity.serious} instance(s) - Must fix before release\n`;
    }
    report += `\n`;

    report += `---\n\n## Detailed Issues\n\n`;

    criticalViolations.forEach((violation, index) => {
      const icon = violation.impact === 'critical' ? '🔴' : '🟠';
      report += `### ${icon} Issue ${index + 1}: ${violation.help}\n\n`;
      report += `**Severity:** ${(violation.impact || 'unknown').toUpperCase()}\n\n`;
      report += `**WCAG Rule:** \`${violation.id}\`\n\n`;
      report += `**Problem:** ${violation.description}\n\n`;
      report += `**Instances:** ${violation.nodes?.length ?? 0}\n\n`;

      report += `**What this means:**\n\n`;
      report += getPlainEnglishExplanation(violation.id) + '\n\n';

      report += `**How to fix:**\n\n`;
      report += getFixInstructions(violation.id) + '\n\n';

      if (violation.nodes && violation.nodes.length > 0) {
        report += `**Affected elements:**\n\n`;
        violation.nodes.slice(0, 3).forEach((node: any, i: number) => {
          const selector = Array.isArray(node.target) ? node.target.join(' ') : node.target;
          const html = node.html ? `\n   \`${node.html.substring(0, 100)}${node.html.length > 100 ? '...' : ''}\`` : '';
          report += `${i + 1}. Selector: \`${selector}\`${html}\n`;
        });
        if (violation.nodes.length > 3) {
          report += `\n... and ${violation.nodes.length - 3} more instance(s)\n`;
        }
      }
      report += `\n**Reference:** ${violation.helpUrl}\n\n`;
      report += `---\n\n`;
    });

    report += `## 🎯 Action Items\n\n`;
    criticalViolations.forEach((v, i) => {
      report += `${i + 1}. Fix **${v.nodes?.length ?? 0}** instance(s) of: ${v.help}\n`;
    });
    report += `\n`;
  }

  // GDS Service Assessment guidance
  report += `\n---\n\n`;
  report += `## 📋 GDS Service Assessment Guidance\n\n`;
  report += `**Service Standard Point 5:** Make sure everyone can use the service\n\n`;
  
  if (criticalViolations.length === 0) {
    report += `✅ This page meets the accessibility requirements for GDS assessment.\n\n`;
    report += `**Next steps:**\n`;
    report += `- Include this report in your Service Assessment evidence\n`;
    report += `- Book a DAC audit to validate these automated findings\n`;
    report += `- Test with real assistive technology users\n\n`;
  } else {
    report += `❌ This page does NOT meet GDS accessibility requirements.\n\n`;
    report += `**Before Service Assessment:**\n`;
    report += `1. Fix all critical and serious violations listed above\n`;
    report += `2. Re-run automated tests to verify fixes\n`;
    report += `3. Test with real assistive technology (screen readers, keyboard-only)\n`;
    report += `4. Book a DAC audit once automated tests pass\n\n`;
  }
  
  report += `**References:**\n`;
  report += `- [Understanding WCAG 2.1](https://www.gov.uk/service-manual/helping-people-to-use-your-service/understanding-wcag)\n`;
  report += `- [Testing for accessibility](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility)\n`;
  report += `- [Making your service accessible](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction)\n\n`;

  return report;
}

function getPlainEnglishExplanation(ruleId: string): string {
  const explanations: Record<string, string> = {
    'list': 'A `<ul>` or `<ol>` contains elements that are not `<li>`, `<script>`, or `<template>`. This breaks the list structure for screen readers - they cannot properly announce list items and navigation becomes confusing.',
    'listitem': 'List items (`<li>`) exist outside of a proper `<ul>` or `<ol>` container. Screen readers cannot announce them as list items, breaking the semantic structure users rely on.',
    'select-name': 'Dropdown menus (select elements) are missing labels. Screen reader users cannot tell what the dropdown is for.',
    'label': 'Form inputs are missing labels. Users cannot tell what information to enter.',
    'button-name': 'Buttons are missing accessible names. Screen reader users cannot tell what the button does.',
    'link-name': 'Links are missing text or labels. Users cannot tell where the link goes.',
    'image-alt': 'Images are missing alternative text. Screen reader users cannot understand the image content.',
    'color-contrast': 'Text does not have enough contrast against its background. Low vision users cannot read it.',
    'heading-order': 'Headings skip levels (e.g., H1 to H3). Screen reader users may miss content.',
    'aria-required-attr': 'ARIA roles are missing required attributes. Assistive technology cannot interpret the element correctly.',
    'duplicate-id': 'Multiple elements have the same ID attribute. This breaks assistive technology navigation.',
    'form-field-multiple-labels': 'Form fields have multiple labels. Screen readers announce conflicting information.',
    'html-has-lang': 'The page is missing a language attribute. Screen readers cannot determine which language to use.',
    'landmark-one-main': 'The page is missing a main landmark or has multiple. Screen reader users cannot jump to main content.',
    'page-has-heading-one': 'The page is missing an H1 heading. Screen reader users cannot understand the page purpose.',
    'region': 'Content is not contained within landmarks. Screen reader users cannot navigate efficiently.',
  };

  return explanations[ruleId] || `This violates WCAG 2.1 requirements for \`${ruleId}\`. Refer to documentation for details.`;
}

function getFixInstructions(ruleId: string): string {
  const fixes: Record<string, string> = {
    'list': '**Inspect the HTML structure:**\n\n```html\n<!-- ❌ Wrong: Extra wrapper inside <ul> -->\n<ul>\n  <div class="wrapper">\n    <li>Item 1</li>\n    <li>Item 2</li>\n  </div>\n</ul>\n\n<!-- ✅ Correct: Only <li> directly inside <ul> -->\n<ul>\n  <li><div class="wrapper">Item 1</div></li>\n  <li><div class="wrapper">Item 2</div></li>\n</ul>\n```\n\n**Steps to fix:**\n1. Find the `<ul>` or `<ol>` element using the selector above\n2. Check what elements are direct children\n3. Move any `<div>` or other wrappers inside the `<li>` elements\n4. If using a component library, check the rendered HTML output',
    'listitem': '**Ensure list items are properly wrapped:**\n\n```html\n<!-- ❌ Wrong: <li> without parent list -->\n<div>\n  <li>Orphaned item</li>\n</div>\n\n<!-- ✅ Correct: <li> inside <ul> -->\n<ul>\n  <li>Proper item</li>\n</ul>\n```\n\n**Steps to fix:**\n1. Find the orphaned `<li>` elements using the selectors above\n2. Wrap them in a `<ul>` (unordered list) or `<ol>` (ordered list)\n3. If these elements shouldn\'t be list items, change them to `<div>` and style with CSS',
    'select-name': '- Add a `<label>` element that wraps or references the select\n- OR add `aria-label="Description"` to the select element\n- OR add `aria-labelledby="heading-id"` to connect it to existing text',
    'label': '- Wrap the input in a `<label>` element\n- OR add a separate `<label for="input-id">` that references the input\n- OR add `aria-label="Description"` to the input',
    'button-name': '- Add text content inside the button: `<button>Submit</button>`\n- OR add `aria-label="Action description"` to the button\n- OR add `title="Action description"` attribute',
    'link-name': '- Add text content inside the link\n- OR add `aria-label="Link description"` to the link\n- OR ensure any image inside has proper alt text',
    'image-alt': '- Add `alt="Description of image"` attribute\n- OR if decorative, add `alt=""` and `role="presentation"`',
    'color-contrast': '- Increase text size OR\n- Darken text color OR\n- Lighten background color\n- Target: 4.5:1 ratio for normal text, 3:1 for large text',
    'heading-order': '- Ensure headings follow sequential order (H1 → H2 → H3)\n- Do not skip heading levels\n- Use CSS for visual styling, not heading levels',
    'duplicate-id': '- Find all elements with the duplicate ID\n- Make each ID unique across the entire page\n- Update any `for` attributes or JavaScript that reference the old ID',
    'form-field-multiple-labels': '- Remove duplicate `<label>` elements\n- Ensure only one label is associated with the input\n- Use `aria-describedby` for additional hint text instead',
    'html-has-lang': '- Add `lang="en"` to the `<html>` element\n- Use the appropriate language code (e.g., `lang="cy"` for Welsh)',
    'landmark-one-main': '- Ensure exactly one `<main>` element exists\n- OR use `role="main"` on the main content container\n- Remove any duplicate main landmarks',
    'page-has-heading-one': '- Add an `<h1>` heading at the top of the main content\n- The H1 should describe the page purpose',
    'region': '- Wrap content in semantic landmarks: `<header>`, `<main>`, `<nav>`, `<footer>`\n- OR use ARIA roles: `role="banner"`, `role="main"`, `role="navigation"`, `role="contentinfo"`',
  };

  return fixes[ruleId] || `- Refer to WCAG documentation: consult the help URL for specific fix instructions\n- Consider consulting with an accessibility specialist`;
}