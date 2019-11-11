const puppeteer = require("puppeteer");

puppeteer.launch().then(async browser => {
    page = await browser.newPage();
    client = await page.target().createCDPSession();

    await client.send("Tracing.start", {
        traceConfig: {
            includedCategories: ['devtools.timeline','disabled-by-default-devtools.timeline'], 
            enableSampling: true,
            enableSystrace: true
        }
    });

    client.on("Tracing.dataCollected", args => {
        console.log(args.value.length);
    });

    client.on("Tracing.tracingComplete", args => {
        console.log(args.dataLossOccurred);
    });

    await page.goto("https://www.baidu.com");
});
