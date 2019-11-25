const puppeteer = require("puppeteer");
const fs = require("fs");

function main() {
    const trace_path = `output/trace_6_${Date.now()}.json`;
    const trace_categories = [
        'blink.user_timing',
        'devtools.timeline',
        'disabled-by-default-devtools.timeline',
    ]
    const target_url = "https://www.baidu.com";
    let BACKEND_START, NAVIGATION_START;

    domSnapshots = [];
    paintLogs = [];

    page_loaded = false;
    ongoing_paint = 0;

    puppeteer.launch().then(async browser => {
        page = await browser.newPage();
        console.log("Default viewport:", page.viewport());

        page.on("load", async () => {
            page_loaded = true;
            console.log("Page loaded at", Date.now());
            if (ongoing_paint === 0) {
                await page.tracing.stop();
                await page.close();
                await browser.close();

                fs.unlinkSync(trace_path);
                console.log("Tracing file removed.");
            }
        });

        client = await page.target().createCDPSession();
        await client.send("DOM.enable");
        await client.send("DOMSnapshot.enable");
        await client.send("LayerTree.enable");

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

                fs.unlinkSync(trace_path);
                console.log("Tracing file removed.");
            }
        });

        await page.tracing.start({
            path: trace_path,
            categories: trace_categories,
        })

        BACKEND_START = Date.now();
        await page.goto(target_url);
    });
}

main();