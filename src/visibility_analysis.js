const puppeteer = require("puppeteer");
const fs = require("fs");

const target_url = "https://www.baidu.com";
const trace_path = `output/trace-${Date.now()}.json`;
const trace_categories = [
    'blink.user_timing',
    'devtools.timeline',
    'disabled-by-default-devtools.timeline',
]

const eventList = [
    "CSS.styleSheetAdded",
    "Debugger.scriptParsed",
    "Runtime.consoleAPICalled",
    "LayerTree.layerPainted",
    "LayerTree.layerTreeDidChange",
    "Network.requestWillBeSent",
    "Network.responseReceived",
];

const listenerList = [
    onCssStyleSheetAdded,
    onDebuggerScriptParsed,
    onRuntimeConsoleApiCalled,
    onLayerTreeLayerPainted,
    onLayerTreeLayerTreeDidChange,
    onNetworkRequestWillBeSent,
    onNetworkResponseReceived,
];

let BACKEND_START, NAVIGATION_START;

mutationRecords = []
performanceRecords = []
backendRecords = []
layerTrees = []

puppeteer.launch().then(async browser => {
    page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 800 });

    page.on("load", async () => {
        await page.tracing.stop();
        await page.close();
        await browser.close();
        syntheticalAnalysis();
    });

    // page.on("console", async msg => {
    //     if (msg.text().startsWith("MO")) {
    //         mutationRecords.push(msg.text());
    //     }
    //     else if (msg.text().startsWith("PO")) {
    //         performanceRecords.push(msg.text());
    //     }
    // });

    // page.on("request", async args => {
    //     console.log("request", args);
    // });

    // page.on("response", async args => {
    //     console.log("response", args);
    // });

    client = await page.target().createCDPSession();

    await client.send("DOM.enable");
    await client.send("CSS.enable");
    await client.send("Debugger.enable");
    await client.send("Runtime.enable");
    await client.send("LayerTree.enable");
    await client.send("Network.enable");

    for (var i = 0; i < eventList.length; i++) {
        client.on(eventList[i], listenerList[i]);
    }

    await page.tracing.start({
        path: trace_path,
        categories: trace_categories
    });

    await page.evaluateOnNewDocument(activateObserver);

    BACKEND_START = Date.now();
    await page.goto(target_url);
});

function activateObserver() {
    var range = document.createRange();
    const mObserver = new MutationObserver((mutations) => {
        // console.log("mutation:", mutations.length);
        mutations.forEach(record => {
            switch (record.type) {
                case "childList":
                    if (record.addedNodes) {
                        nodes = [];
                        Array.from(record.addedNodes).forEach(d => {
                            let rect;
                            switch (d.nodeType) {
                                case 1:     // ELEMENT_NODE
                                    rect = d.getBoundingClientRect();
                                    // console.log(d.nodeName, rect);
                                    break;
                                case 3:     // TEXT_NODE
                                    range.selectNodeContents(d);
                                    rects = range.getClientRects();
                                    if (rects.length) {
                                        // console.log(d.nodeName, rects[0]);
                                        rect = rects[0];
                                    }
                                    break;
                                default:
                                    break;
                            }
                            if (rect)
                                nodes.push(`${d.nodeName}[${rect.left},${rect.top},${rect.width},${rect.height}]`);
                        });
                        if (nodes.length)
                            console.log(`MO:${Date.now()}:${record.type}:${record.target.nodeName}:add:${nodes.join("|")}`);
                    }
                    else {
                        nodes = [];
                        Array.from(record.removedNodes).forEach(d => {
                            let rect;
                            switch (d.nodeType) {
                                case 1:     // ELEMENT_NODE
                                    rect = d.getBoundingClientRect();
                                    break;
                                case 3:     // TEXT_NODE
                                    range.selectNodeContents(d);
                                    rects = range.getClientRects();
                                    if (rects.length) {
                                        rect = rects[0];
                                    }
                                    break;
                                default:
                                    break;
                            }
                            if (rect)
                                nodes.push(`${d.nodeName}[${rect.left},${rect.top},${rect.width},${rect.height}]`);
                        });
                        if (nodes.length)
                            console.log(`MO:${Date.now()}:${record.type}:${record.target.nodeName}:remove:${nodes.join("|")}`);
                    }
                    break;
                case "attribute":
                    console.log(`MO:${Date.now()}:${record.type}:${record.target.nodeName}:${record.attributeName}`);
                    break;
                case "characterData":
                    console.log(`MO:${Date.now()}:${record.type}:${record.target.nodeName}:${record.attributeName}`);
                    break;
                default:
                    break;
            }
        });
    });
    const pObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            console.log(`PO:${Date.now()}:${entry.entryType}:${Math.round(entry.startTime)}:${Math.round(entry.duration)}:${entry.name}`);
        }
    });
    mObserver.observe(document, {
        attributes: true,
        childList: true,
        subtree: true,
        // attributeFilter: [],
    });
    pObserver.observe({ entryTypes: ['longtask', 'resource'] });
}

async function delay(t, val) {
    return new Promise(function (resolve) {
        setTimeout(function () {
            resolve(val);
        }, t);
    });
}

async function onCssStyleSheetAdded(params) {
    backendRecords.push(`CSS_ADD:${Date.now()}:${params.header.startLine}:${params.header.endLine}:${params.header.sourceURL}`);
}

async function onDebuggerScriptParsed(params) {
    backendRecords.push(`SCRIPT_ADD:${Date.now()}:${params.startLine}:${params.endLine}:${params.url}`);
}

async function onRuntimeConsoleApiCalled(params) {
    // params.args.forEach(d => { console.log(d.value); });
}

async function onLayerTreeLayerPainted(params) {
    backendRecords.push(`LAYER_PAINT:${Date.now()}:[${params.clip.x},${params.clip.y},${params.clip.width},${params.clip.height}]`)
}

async function onLayerTreeLayerTreeDidChange(params) {
    if (params.layers) {
        layerTrees.push(params.layers)
        backendRecords.push(`LAYER_TREE_CHANGE:${Date.now()}:${layerTrees.length - 1}`);
    }
}

async function onNetworkRequestWillBeSent(params) {
    console.log(params.requestId, params.documentURL);
}

async function onNetworkResponseReceived(params) {
    console.log(params.requestId);
}

function parsePerformanceRecords(records) {
    parsedRecords = []
    records.forEach(d => {
        colonIndex = []
        for (var i = 0; i < d.length; i++) {
            if (d[i] === ':') colonIndex.push(i);
            if (colonIndex.length === 5) break;
        }
        if (colonIndex.length !== 5) return;
        parsedRecords.push({
            ts: parseInt(d.slice(colonIndex[0] + 1, colonIndex[1])) - BACKEND_START,
            type: d.slice(colonIndex[1] + 1, colonIndex[2]),
            startTime: parseInt(d.slice(colonIndex[2] + 1, colonIndex[3])) - BACKEND_START,
            duration: parseInt(d.slice(colonIndex[3] + 1, colonIndex[4])),
            name: d.slice(colonIndex[4] + 1)
        })
    });
    return parsedRecords;
}

function parseMutationRecords(records) {
    parsedRecords = [];
    records.forEach(d => {
        colonIndex = [];
        let type;
        for (var i = 0; i < d.length; i++) {
            if (d[i] === ':') colonIndex.push(i);
            if (type) {
                if (type === "attribute" || type === "characterDate") {
                    if (colonIndex.length === 4) break;
                }
                else if (type === "childList") {
                    if (colonIndex.length === 5) break;
                }
            }
            if (!type && colonIndex.length === 3) {
                type = d.slice(colonIndex[1] + 1, colonIndex[2])
            }
        }
        if (type) {
            switch (type) {
                case 'childList':
                    if (colonIndex.length !== 5) return;
                    parsedRecords.push({
                        ts: parseInt(d.slice(colonIndex[0] + 1, colonIndex[1])) - BACKEND_START,
                        type: type,
                        nodeName: d.slice(colonIndex[2] + 1, colonIndex[3]),
                        action: d.slice(colonIndex[3] + 1, colonIndex[4]),
                        nodes: d.slice(colonIndex[4] + 1).split('|')
                    });
                    break;
                case 'attribute':
                case 'characterData':
                    if (colonIndex.length !== 4) return;
                    parsedRecords.push({
                        ts: parseInt(d.slice(colonIndex[0] + 1, colonIndex[1])) - BACKEND_START,
                        type: type,
                        nodeName: d.slice(colonIndex[2] + 1, colonIndex[3]),
                        attrName: d.slice(colonIndex[3] + 1)
                    });
                    break;
                default:
                    break;
            }
        }
    });
    return parsedRecords;
}

function parseBackendRecords(records) {
    parsedRecords = [];
    records.forEach(d => {
        let type;
        if (d.startsWith("CSS_ADD")) type = "CSS_ADD";
        else if (d.startsWith("SCRIPT_ADD")) type = "SCRIPT_ADD";
        else if (d.startsWith("LAYER_PAINT")) type = "LAYER_PAINT";
        else if (d.startsWith("LAYER_TREE_CHANGE")) type = "LAYER_TREE_CHANGE";

        if (!type) return;

        colonIndex = [];
        for (var i = 0; i < d.length; i++) {
            if (d[i] == ':') colonIndex.push(i);
            if (type === "CSS_ADD" || type === "SCRIPT_ADD") {
                if (colonIndex.length === 4) break;
            }
            else if (type === "LAYER_PAINT" || type === "LAYER_TREE_CHANGE") {
                if (colonIndex.length === 2) break;
            }
        }

        switch (type) {
            case "CSS_ADD":
            case "SCRIPT_ADD":
                if (colonIndex.length !== 4) return;
                parsedRecords.push({
                    type: type,
                    ts: parseInt(d.slice(colonIndex[0] + 1, colonIndex[1])) - BACKEND_START,
                    startLine: parseInt(d.slice(colonIndex[1] + 1, colonIndex[2])),
                    endLine: parseInt(d.slice(colonIndex[2] + 1, colonIndex[3])),
                    url: d.slice(colonIndex[3] + 1)
                });
                break;
            case "LAYER_PAINT":
                if (colonIndex.length !== 2) return;
                parsedRecords.push({
                    type: type,
                    ts: parseInt(d.slice(colonIndex[0] + 1, colonIndex[1])) - BACKEND_START,
                    clip: d.slice(colonIndex[1] + 1)
                });
                break;
            case "LAYER_TREE_CHANGE":
                if (colonIndex.length !== 2) return;
                parsedRecords.push({
                    type: type,
                    ts: parseInt(d.slice(colonIndex[0] + 1, colonIndex[1])) - BACKEND_START,
                    treeIndex: parseInt(d.slice(colonIndex[1] + 1))
                });
                break;
            default:
                break;
        }
    });
    return parsedRecords;
}

function syntheticalAnalysis() {
    traceEvents = JSON.parse(fs.readFileSync(trace_path)).traceEvents;

    NAVIGATION_START = traceEvents.find(d => d.name === "navigationStart").ts;

    // Parse string to object, with clock synchronization.
    performanceRecords = parsePerformanceRecords(performanceRecords);
    mutationRecords = parseMutationRecords(mutationRecords);
    backendRecords = parseBackendRecords(backendRecords);
    traceEvents.forEach(d => { if (d.ts) { d.ts = Math.round((d.ts - NAVIGATION_START) / 1000); } });
    resourceRequests = traceEvents.filter(d => d.name === "ResourceSendRequest")

    // console.log(performanceRecords);
    // console.log(mutationRecords);
    // console.log(backendRecords);
    // console.log(traceEvents);

    performanceRecords.forEach(d => {
        url = d.name;
        for (var i = 0; i < resourceRequests.length; i++) {
            if (url === resourceRequests[i].args.data.url) {
                console.log(d.ts, resourceRequests[i].ts, url);
                return;
            }
        }
    });

    fs.unlinkSync(trace_path);
    console.log("Trace file removed.");
}
