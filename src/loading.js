const puppeteer = require("puppeteer");
const EventEmitter = require("events");
const fs = require("fs");

const tracePath = `src/output/trace.json`;
const traceCategories = [
    'blink.user_timing',
    'devtools.timeline',
    'disabled-by-default-devtools.timeline',
];

function pageLoading(viewport, url, event, reminder) {
    paintLogs = [];
    domSnapshots = [];
    timePoints = { doms: [], paints: [] };

    ongoing_dom = 0;
    ongoing_paint = 0;
    page_loaded = false;

    emitter = new EventEmitter();

    emitter.on("dom", async arg => {
        ongoing_dom += 1;
        start = Date.now();
        try {
            dom = await arg.client.send("DOMSnapshot.captureSnapshot", {
                computedStyles: ["font-size", "opacity", "z-index"],
                includePaintOrder: true,
                includeDOMRects: true
            });
            dom.ts = start;
            domSnapshots.push(dom);

            end = Date.now();
            timePoints.doms.push({ start: start, end: end });
            event.reply("asynchronous-reply", { name: "LOG", value: `DOM snapshot takes ${end - start} ms.` });
        } catch (e) {
            end = Date.now();
            timePoints.doms.push({ start: start, end: end });
            domSnapshots.push({ ts: end });
        }

        ongoing_dom -= 1;
        if (page_loaded && ongoing_paint === 0 && ongoing_dom === 0) {
            await closePageAndBrowser(arg.page, arg.browser);
        }
    });

    emitter.on("paint", async arg => {
        ongoing_paint += 1;
        try {
            start = Date.now();
            layer = await arg.client.send("LayerTree.makeSnapshot", { layerId: arg.params.layerId });
            cLogs = await arg.client.send("LayerTree.snapshotCommandLog", { snapshotId: layer.snapshotId });
            cLogs.ts = start;
            paintLogs.push(cLogs);

            end = Date.now();
            timePoints.paints.push({ start: start, end: end });
            event.reply("asynchronous-reply", { name: "LOG", value: `Paint logs take ${end - start} ms.` });
        } catch (e) {
            end = Date.now();
            timePoints.doms.push({ start: start, end: end });
            paintLogs.push({ ts: end });
        }

        ongoing_paint -= 1;
        if (page_loaded && ongoing_paint === 0 && ongoing_dom === 0) {
            await closePageAndBrowser(arg.page, arg.browser);
        }
    });

    puppeteer.launch().then(async browser => {
        page = await browser.newPage();
        await page.setViewport(viewport);

        page.on("load", async () => {
            page_loaded = true;
            event.reply("asynchronous-reply", { name: "LOG", value: "Page loaded." });

            if (page_loaded && ongoing_paint === 0 && ongoing_dom === 0) {
                await closePageAndBrowser(page, browser);
            }
        });

        client = await page.target().createCDPSession();
        await client.send("DOM.enable");
        await client.send("DOMSnapshot.enable");
        await client.send("LayerTree.enable");

        client.on("LayerTree.layerPainted", async params => {
            if (page_loaded) return;

            emitter.emit("dom", { client, page, browser });
            emitter.emit("paint", { params, client, page, browser });
        });

        await page.tracing.start({ path: tracePath, categories: traceCategories });

        timePoints.backendStart = Date.now();
        await page.goto(url);
    });

    async function closePageAndBrowser(page, browser) {
        if (page) {
            await page.tracing.stop();
            await page.close();
        }
        if (browser) {
            await browser.close();
        }

        traceEvents = JSON.parse(fs.readFileSync(tracePath)).traceEvents;
        output = { paintLogs, domSnapshots, traceEvents, timePoints };
        reminder.emit("load_finish", { output, event });

        fs.unlinkSync(tracePath);
        event.reply("asynchronous-reply", { name: "LOG", value: "Trace file removed." });
    }
}

module.exports = pageLoading;