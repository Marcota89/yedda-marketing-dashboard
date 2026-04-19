const puppeteer = require('puppeteer');
const path = require('path');

const posts = [
  'linkedin-post-1-ia-philosophy',
  'linkedin-post-2-fraud-detection',
  'linkedin-post-3-workplace-safety',
  'linkedin-post-4-decision-intelligence',
];

(async () => {
  const browser = await puppeteer.launch({ headless: true });

  for (const post of posts) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 628, deviceScaleFactor: 2 });

    const file = path.resolve(`templates/${post}.html`);
    await page.goto('file:///' + file.replace(/\\/g, '/'));
    await new Promise(r => setTimeout(r, 1500));

    await page.screenshot({
      path: `templates/${post}.png`,
      clip: { x: 0, y: 0, width: 1200, height: 628 }
    });

    await page.close();
    console.log(`✓ Screenshot saved: templates/${post}.png`);
  }

  await browser.close();
  console.log('\nAll 4 LinkedIn visuals generated.');
})();
