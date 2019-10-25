const puppeteer = require("puppeteer");

puppeteer.launch().then(async browser => {
    now = new Date().toISOString().replace(':', '-').substring(0, 15);

    page = await browser.newPage();
    await page.tracing.start({path: `trace${now}.json`});
    await page.goto('https://www.baidu.com');
    await page.tracing.stop().then(() => {
        browser.close();
    });
});