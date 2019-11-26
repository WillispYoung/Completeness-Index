const puppeteer = require("puppeteer");
const fs = require("fs");

function main() {
    const TRACE_PATH = `output/trace_6_${Date.now()}.json`;
    const TRACE_CATEGORIES = [
        'blink.user_timing',
        'devtools.timeline',
        'disabled-by-default-devtools.timeline',
    ]
    const TARGET_URL = "https://www.baidu.com";
    let BACKEND_START, NAVIGATION_START;

    paintLogs = [];
    domSnapshots = [];

    ongoing_paint = 0;
    page_loaded = false;

    puppeteer.launch().then(async browser => {
        page = await browser.newPage();
        console.log("Default viewport:", page.viewport());

        page.on("load", async () => {
            page_loaded = true;
            console.log("Page loaded.");

            if (ongoing_paint === 0) {
                await page.tracing.stop();
                await page.close();
                await browser.close();

                analysis();

                fs.unlinkSync(TRACE_PATH);
                console.log("Tracing file removed.");
            }
        });

        client = await page.target().createCDPSession();
        await client.send("DOM.enable");
        await client.send("DOMSnapshot.enable");
        await client.send("LayerTree.enable");

        // Never happens. WHY?
        client.on("DOM.inlineStyleInvalidated", async params => {
            console.log("Inline style invalidated:", params);
        });

        client.on("LayerTree.layerPainted", async params => {
            if (page_loaded) return;

            ongoing_paint += 1;
            try {
                start = Date.now();
                dom = await client.send("DOMSnapshot.captureSnapshot", {
                    computedStyles: ["top", "left", "width", "height"],
                    includePaintOrder: true,
                    includeDOMRects: true
                });
                dom.ts = start;
                domSnapshots.push(dom);

                start_ = Date.now();
                layer = await client.send("LayerTree.makeSnapshot", { layerId: params.layerId });
                cLogs = await client.send("LayerTree.snapshotCommandLog", { snapshotId: layer.snapshotId });
                cLogs.ts = start_;
                paintLogs.push(cLogs);

                end = Date.now();
                console.log("Paint event takes", end - start, "ms to process.");
            }
            catch (e) {
                
            }

            ongoing_paint -= 1;
            console.log("Ongoing paint number:", ongoing_paint);
            if (page_loaded && ongoing_paint === 0) {
                if (page) {
                    await page.tracing.stop();
                    await page.close();
                }
                if (browser) await browser.close();

                ananlysis();

                fs.unlinkSync(TRACE_PATH);
                console.log("Tracing file removed.");
            }
        });

        await page.tracing.start({
            path: TRACE_PATH,
            categories: TRACE_CATEGORIES,
        })

        BACKEND_START = Date.now();
        await page.goto(TARGET_URL);
    });

    function ananlysis() {
        traceEvents = JSON.parse(fs.readFileSync(TRACE_PATH)).traceEvents;
        NAVIGATION_START = traceEvents.find(d => d.name === "navigationStart").ts;

        traceEvents.forEach(d => {
            d.ts = (d.ts - NAVIGATION_START) / 1000;
            if (d.dur) d.dur /= 1000;
        });

        paintLogs.forEach(d => d.ts -= BACKEND_START);
        domSnapshots.forEach(d => d.ts -= BACKEND_START);

        
    }
}

main();