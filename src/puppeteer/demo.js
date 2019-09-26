const puppeteer = require("puppeteer");

puppeteer.launch().then(async browser => {
    const page = await browser.newPage();
    
    await page.tracing.start({path: 'trace.json'});
    await page.goto('https://www.baidu.com');
    await page.tracing.stop();

    await browser.close();
});