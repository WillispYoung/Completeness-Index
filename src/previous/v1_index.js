const { app, ipcMain, BrowserWindow } = require('electron');
const clonedeep = require("lodash.clonedeep");
const puppeteer = require("puppeteer");
const EventEmitter = require("events");
const request = require("request");
const fs = require("fs");

const WINDOW_SIZE = { width: 800, height: 600 };
const VIEWPORT = { width: 1200, height: 800 };
const TRACE_CATEGORIES = [
    'blink.user_timing',
    'devtools.timeline',
    'disabled-by-default-devtools.timeline',
]
const TRACE_PATH = `src/output/trace_${Date.now()}.json`;

let TARGET_URL, BACKEND_START, NAVIGATION_START;
let paintLogs, domSnapshots, traceEvents, paintRegions, pageComposition;

app.on('ready', () => {
    window = new BrowserWindow({
        width: WINDOW_SIZE.width,
        height: WINDOW_SIZE.height,
        webPreferences: {
            nodeIntegration: true
        }
    });

    window.loadFile('src/index.html');
});

ipcMain.on("asynchronous-message", (event, arg) => {
    switch (arg.name) {
        case "PASS-URL":
            if (!arg.url) {
                event.reply("asynchronous-reply", {
                    name: "PASS-URL",
                    type: "error",
                    value: "Input URL to continue!"
                });
            } else {
                request.get(arg.url, (error, response, body) => {
                    if (error || response.statusCode !== 200) {
                        event.reply("asynchronous-reply", {
                            name: "PASS-URL",
                            type: "error",
                            value: "URL cannot be retrived!"
                        });
                    } else {
                        event.reply("asynchronous-reply", { name: "PAINT-REGION", value: VIEWPORT });
                        TARGET_URL = arg.url;
                        pageLoading(TARGET_URL, event);
                    }
                });
            }
            break;
        case "SEE-PAINT":
        case "SEE-PAINT-REGION":
            index = arg.index - 1;
            paintRegions[index].forEach(d => {
                event.reply("asynchronous-reply", { name: arg.name, value: d });
            });
            break;
        case "SEE-PAGE-COMPOSITION":
            index = arg.index - 1;
            pageComposition[index].forEach(d => {
                event.reply("asynchronous-reply", { name: arg.name, value: d });
            });
            break;
        default:
            break;
    }
});

async function pageLoading(url, event) {
    domSnapshots = [];
    paintLogs = [];

    ongoing_dom = 0;
    ongoing_paint = 0;
    page_loaded = false;

    emitter = new EventEmitter();

    emitter.on("dom", async arg => {
        ongoing_dom += 1;
        try {
            start = Date.now();
            dom = await arg.client.send("DOMSnapshot.captureSnapshot", {
                computedStyles: ["font-size", "opacity", "z-index"],
                includePaintOrder: true,
                includeDOMRects: true
            });
            dom.ts = start;
            domSnapshots.push(dom);

            end = Date.now();
            event.reply("asynchronous-reply", { name: "LOG", value: `DOM snapshot takes ${end - start} ms.` });
        } catch (e) {
            console.log(e.message);
            domSnapshots.push({ ts: Date.now() });
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
            event.reply("asynchronous-reply", { name: "LOG", value: `Paint logs take ${end - start} ms.` });
        } catch (e) {
            console.log(e.message);
            paintLogs.push({ ts: Date.now() });
        }

        ongoing_paint -= 1;
        if (page_loaded && ongoing_paint === 0 && ongoing_dom === 0) {
            await closePageAndBrowser(arg.page, arg.browser);
        }
    });

    emitter.on("loaded", arg => {
    	clockSynchronization(arg.event);
    });

    puppeteer.launch().then(async browser => {
        page = await browser.newPage();
        await page.setViewport(VIEWPORT);

        page.on("load", async () => {
            page_loaded = true;
            event.reply("asynchronous-reply", { name: "LOG", value: `Page loaded.` });

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

        await page.tracing.start({
            path: TRACE_PATH,
            categories: TRACE_CATEGORIES,
        })

        BACKEND_START = Date.now();
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
        emitter.emit("loaded", { event });
    }
}

function clockSynchronization(event) {
    traceEvents = JSON.parse(fs.readFileSync(TRACE_PATH)).traceEvents;
    NAVIGATION_START = traceEvents.find(d => d.name === "navigationStart").ts;

    // MICROSECOND -> MILLISECOND.
    traceEvents.forEach(d => {
        d.ts = (d.ts - NAVIGATION_START) / 1000;
        if (d.dur) { d.dur /= 1000; }
    });

    paintLogs.forEach(d => d.ts -= BACKEND_START);
    paintLogs.sort((a, b) => { a.ts - b.ts });
    domSnapshots.forEach(d => d.ts -= BACKEND_START);
    domSnapshots.sort((a, b) => (a.ts - b.ts));
    event.reply("asynchronous-reply", { name: "PAINT-COUNT", value: paintLogs.length });

    fs.unlinkSync(TRACE_PATH);
    event.reply("asynchronous-reply", { name: "LOG", value: `Trace file removed.` });

    getPaintRegions();
    event.reply("asynchronous-reply", { name: "LOG", value: `Paint regions calculated.` });
}

function getPaintRegions() {
    paintRegions = [];
    for (var i = 0; i < paintLogs.length; i++) {
        paintRegions.push([]);

        if (paintLogs[i].commandLog) {
            strRef = domSnapshots[i].strings;
            layout = domSnapshots[i].documents[0].layout;
            textBoxes = domSnapshots[i].documents[0].textBoxes;

            // SKIA COLOR IS ARGB.
            paintLogs[i].commandLog.forEach(d => {
                switch (d.method) {
                    case "drawRect":
                        if (d.params.paint.styleName === "Fill") {

                            paintRegions[i].push({
                                color: '#' + d.params.paint.color.slice(3),
                                rect: d.params.rect,
                                type: "rect",
                                style: "fill"
                            });
                        } else if (d.params.paint.styleName === "Stroke") {

                            paintRegions[i].push({
                                color: '#' + d.params.paint.color.slice(3),
                                rect: d.params.rect,
                                type: "rect",
                                style: "stroke",
                                lineWidth: d.params.paint.strokeWidth
                            });
                        }
                        break;
                    case "drawRRect":
                        if (d.params.paint.styleName === "Fill") {

                            paintRegions[i].push({
                                color: '#' + d.params.paint.color.slice(3),
                                rect: d.params.rrect,
                                type: "rrect",
                                style: "fill"
                            });
                        } else if (d.params.paint.styleName === "Stroke") {

                            paintRegions[i].push({
                                color: '#' + d.params.paint.color.slice(3),
                                rect: d.params.rrect,
                                type: "rrect",
                                style: "stroke",
                                lineWidth: d.params.paint.strokeWidth
                            });
                        }
                        break;
                    case "drawImageRect":

                        paintRegions[i].push({
                            color: '#' + d.params.paint.color.slice(3),
                            rect: d.params.dst,
                            type: "image"
                        });
                        break;
                    case "drawTextBlob":
                        x = d.params.x;
                        y = d.params.y;

                        minDistance = Number.MAX_SAFE_INTEGER;
                        targetIndex = -1;

                        for (var i = 0; i < textBoxes.bounds.length; i++) {
                            distance = Math.hypot(x - textBoxes.bounds[i][0], y - textBoxes.bounds[i][1]);
                            if (distance < minDistance) {
                                minDistance = distance;
                                targetIndex = i;
                            }
                        }

                        targetIndex = textBoxes.layoutIndex[targetIndex];

                        if (layout.text[targetIndex] !== -1) {
                            text = strRef[layout.text[targetIndex]];
                            rect = {
                                left: layout.bounds[targetIndex][0],
                                top: layout.bounds[targetIndex][1],
                                right: layout.bounds[targetIndex][0] + layout.bounds[targetIndex][2],
                                bottom: layout.bounds[targetIndex][1] + layout.bounds[targetIndex][3],
                            };

                            paintRegions[i].push({
                                color: '#' + d.params.paint.color.slice(3),
                                type: "text",
                                point: { x, y },
                                rect,
                                text
                            });
                        }
                        break;
                    default:
                        break;
                }
            });
        }
    }
    console.log(paintRegions);
}

function isOverlapped(rect1, rect2) {
    return !(rect1.right < rect2.left || rect1.left > rect2.right ||
        rect1.bottom < rect2.top || rect1.top > rect2.bottom);
}

function getAcreage(rect) {
    return (rect.right - rect.left) * (rect.bottom - rect.top);
}

function getOverlapAcreage(rect1, rect2) {
    x_overlap = Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left);
    y_overlap = Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top);
    return x_overlap * y_overlap;
}

// RETURN SUB-RECTANGLES THAT DON'T OVERLAP THE UPPER RECTANGLE.
function segmentRectangle(upper, lower) {
    x = [upper.left, upper.right, lower.left, lower.right];
    y = [upper.top, upper.bottom, lower.top, lower.bottom];
    x.sort();
    y.sort();
    sub_rects = [];
    for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
            sub_rects.push({
                left: x[i],
                right: x[i + 1],
                top: y[j],
                bottom: y[j + 1]
            })
        }
    }
    res = [];
    sub_rects.forEach(rect => {
        if (rect.left === x[1] && rect.right === x[2] &&
            rect.top === y[1] && rect.bottom === y[2])
            return;
        else if (rect.left >= lower.left && rect.right <= lower.right &&
            rect.top >= lower.top && rect.bottom <= lower.bottom) {
            res.push(rect);
        }
    });
    return res;
}

function getPageComposition() {

}

function updateComposition(region, composition, painted) {

}