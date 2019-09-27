const puppeteer = require("puppeteer");

puppeteer.launch().then(async browser => {
    const page = await browser.newPage();

    //var width = 1920, height = 1080;
    //await page.setViewport({
    //    width: width,
    //    height: height
    //});

    //console.log(page.viewport().width, page.viewport().height);

    var interval = setInterval(async function () {
        const now = new Date().getTime();
        console.log(now);

        try {
            const allDivs = await page.$$('div');
            var visibleCount = 0;
            // Need to remove same/similar bBoxes!
            for (var i = 0; i < allDivs.length; i++) {
                var bbox = await allDivs[i].boundingBox();
                if (bbox !== null) {
                    visibleCount += 1;
                    //console.log(bbox);
                    console.log("X:", bbox.x, "Y:", bbox.y, "Width:", bbox.width, "Height:", bbox.height);
                }
            }
            console.log("Visible Count:", visibleCount);
        }
        catch (e) {
            
        }
    }, 100);

    page.on("domcontentloaded", async function () {
        console.log('domContentLoaded');
        page.screenshot({ path: 'dcl.png' });
    });

    page.on('load', async function () {
        console.log('Page Loaded');
        clearInterval(interval);

        await page.screenshot({ path: 'l.png' });
        await browser.close();
    });

    await page.goto('https://www.baidu.com');

    var input = process.stdin.read();
});

