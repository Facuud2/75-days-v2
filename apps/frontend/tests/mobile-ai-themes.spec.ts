import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  MOBILE_VIEWPORT,
  installVoiceMock,
  mockSessionApis,
  openAiPlanStudio,
  seedMobileSession,
  type AppearanceSeed,
  type PaletteSeed,
} from './helpers/mobile-ai';

const contrastEvaluator = () => {
  function parseRgb(cssColor: string): [number, number, number] {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = cssColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  }
  function luminance([r, g, b]: [number, number, number]): number {
    const srgb = [r, g, b].map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }
  function ratio(fg: string, bg: string): number {
    const l1 = luminance(parseRgb(fg));
    const l2 = luminance(parseRgb(bg));
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const read = (token: string) => rootStyles.getPropertyValue(token).trim();

  return {
    appearance: document.documentElement.getAttribute('data-appearance'),
    palette: document.documentElement.getAttribute('data-palette'),
    bodyOnCard: ratio(read('--text-primary'), read('--surface-card')),
    mutedOnCard: ratio(read('--text-muted'), read('--surface-card')),
    ctaOnAccent: ratio(read('--on-accent'), read('--accent-fill')),
    accentTextOnCard: ratio(read('--accent-text'), read('--surface-card')),
  };
};

const APPEARANCES: AppearanceSeed[] = ['dark', 'light'];
const PALETTES: PaletteSeed[] = ['pink-neon', 'fitness', 'bamboo-green', 'custom'];

for (const appearance of APPEARANCES) {
  for (const palette of PALETTES) {
    test.describe(`AI studio appearance matrix — ${appearance} / ${palette}`, () => {
      test.use({
        viewport: MOBILE_VIEWPORT,
        hasTouch: true,
        isMobile: true,
        colorScheme: appearance,
      });

      test(`renders at 360x740 without overflow and passes axe (${appearance}/${palette})`, async ({
        page,
      }, testInfo) => {
        await installVoiceMock(page);
        await seedMobileSession(page, { appearance, palette });
        await mockSessionApis(page);

        const aiDialog = await openAiPlanStudio(page);
        await expect(aiDialog).toBeVisible();

        // Palette/appearance actually applied to the document.
        const contrast = await page.evaluate(contrastEvaluator);
        expect(contrast.appearance).toBe(appearance);
        expect(contrast.palette).toBe(palette);
        expect(contrast.bodyOnCard, 'body text contrast on sheet surface').toBeGreaterThanOrEqual(4.5);
        expect(contrast.ctaOnAccent, 'CTA label contrast on accent fill').toBeGreaterThanOrEqual(4.5);

        const overflow = await page.evaluate(() => ({
          viewport: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          dialogWidth: document.querySelector('[role="dialog"]')?.scrollWidth ?? 0,
          dialogClientWidth: document.querySelector('[role="dialog"]')?.clientWidth ?? 0,
        }));
        expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewport);
        expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewport);
        expect(overflow.dialogWidth).toBeLessThanOrEqual(overflow.dialogClientWidth + 1);

        const axeResults = await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();

        await testInfo.attach(`axe-${appearance}-${palette}.json`, {
          body: JSON.stringify(axeResults.violations, null, 2),
          contentType: 'application/json',
        });

        const blocking = axeResults.violations.filter(
          (violation) => violation.impact === 'critical' || violation.impact === 'serious'
        );
        expect(
          blocking.map((violation) => `${violation.id} (${violation.nodes.length})`),
          `axe critical/serious violations for ${appearance}/${palette}`
        ).toEqual([]);

        await page.screenshot({
          path: testInfo.outputPath(`ai-360x740-${appearance}-${palette}.png`),
          fullPage: true,
        });
      });
    });
  }
}
