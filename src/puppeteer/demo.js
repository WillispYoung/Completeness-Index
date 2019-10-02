const puppeteer = require("puppeteer");

puppeteer.launch().then(async browser => {
    const page = await browser.newPage();

    //var width = 1920, height = 1080;
    await page.setViewport({
        width: 600,
        height: 1000
    });

    //console.log(page.viewport().width, page.viewport().height);

    var interval = setInterval(async function () {
        const now = new Date().getTime();
        console.log(now);

        await page.screenshot({ path: 'ss/' + now + ".png" });

        //try {
        //    const allDivs = await page.$$('div');
        //    var visibleCount = 0;
        //    // Need to remove same/similar bBoxes!
        //    for (var i = 0; i < allDivs.length; i++) {
        //        var bbox = await allDivs[i].boundingBox();
        //        if (bbox !== null) {
        //            visibleCount += 1;
        //            //console.log(bbox);
        //            console.log("X:", bbox.x, "Y:", bbox.y,
        //                "Width:", bbox.width, "Height:", bbox.height);
        //        }
        //    }
        //    console.log("Visible Count:", visibleCount);
        //}
        //catch (e) {
            
        //}
    }, 80);    // This interval is important.

    page.on("domcontentloaded", async function () {
        console.log('domContentLoaded');
        await page.screenshot({ path: 'dcl.png' });
    });

    page.on('load', async function () {
        console.log('Page Loaded');
        clearInterval(interval);

        await page.screenshot({ path: 'l.png' });
        await browser.close();
    });

    await page.goto('https://www.zhihu.com/topic/19565870/');

    var input = process.stdin.read();
});

