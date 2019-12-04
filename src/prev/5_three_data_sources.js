const puppeteer = require("puppeteer");
const fs = require("fs");

const target_url = "https://www.baidu.com";
const trace_path = `output/trace-${Date.now()}.json`;
const trace_categories = [
    'blink.user_timing',
    'devtools.timeline',
    'disabled-by-default-devtools.timeline',
];

const eventList = [
    "CSS.styleSheetAdded",
    "Debugger.scriptParsed",
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

// mutationRecords = [];
performanceRecords = [];
backendRecords = [];

domSnapshots = [];
// layerTrees = [];            // This information is almost userless. 
commandLogs = [];

requestCount = 0;
requestIndex = {};              // { id : index }
requestList = [];

puppeteer.launch().then(async browser => {
    page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 800 });

    page.on("load", async () => {
        await page.tracing.stop();
        await page.close();
        await browser.close();

        syntheticalAnalysis();
    });

    client = await page.target().createCDPSession();

    await client.send("DOM.enable");
    await client.send("DOMSnapshot.enable");
    await client.send("CSS.enable");
    await client.send("Debugger.enable");
    await client.send("Runtime.enable");
    await client.send("LayerTree.enable");
    await client.send("Network.enable");

    await bindEventListener(client);

    await page.tracing.start({
        path: trace_path,
        categories: trace_categories
    });

    await page.evaluateOnNewDocument(activateObserver);

    BACKEND_START = Date.now();         // millisecond

    await page.goto(target_url);
});

function activateObserver() {
    const pObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            console.log(`PO:${Date.now()}:${entry.entryType}:${Math.round(entry.startTime)}:${Math.round(entry.duration)}:${entry.name}`);
        }
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

async function bindEventListener(client) {
    for (var i = 0; i < eventList.length; i++) {
        bindedListener = listenerList[i].bind(client);
        client.on(eventList[i], bindedListener);
    }
}

async function onCssStyleSheetAdded(params) {
    backendRecords.push({
        type: "CSS_ADD",
        ts: Date.now() - BACKEND_START,
        startLine: params.header.startLine,
        endLine: params.header.endLine || 0,
        url: params.header.sourceURL
    })
}

async function onDebuggerScriptParsed(params) {
    backendRecords.push({
        type: "SCRIPT_PARSE",
        ts: Date.now() - BACKEND_START,
        startLine: params.startLine,
        endLine: params.endLine,
        url: params.url
    });
}

async function onLayerTreeLayerPainted(params) {
    start = Date.now();
    snapshot = await this.send("LayerTree.makeSnapshot", {layerId: params.layerId});
    end = Date.now();
    console.log("Layer snapshot takes", end-start, "ms");

    start = end;
    cLogs = await this.send("LayerTree.snapshotCommandLog", {snapshotId: snapshot.snapshotId});
    end = Date.now();
    console.log("Command logs take", end-start, "ms");

    commandLogs.push(cLogs);
}

async function onLayerTreeLayerTreeDidChange(params) {
    // snapshot={documents=[DocumentSnapshot],strings=[string]}
    // DocumentSnapshot contains NodeTreeSnapshot, LayerTreeSnapshot and TextBoxSnapshot.
    const start = Date.now();
    snapshot = await this.send("DOMSnapshot.captureSnapshot", {
        computedStyles: ["top", "left", "width", "height"],
        includePaintOrder: true,
        includeDOMRects: true
    });
    const end = Date.now();
    console.log("DOM snapshot takes", end-start, "ms")

    snapshot.ts = Date.now() - BACKEND_START;
    domSnapshots.push(snapshot);

    backendRecords.push({
        type: "LAYER_PAINT",
        ts: Date.now() - BACKEND_START,
        clip: params.clip,
        index: domSnapshots.length - 1
    });
}

async function onNetworkRequestWillBeSent(params) {
    requestIndex[params.requestId] = requestCount;
    requestCount += 1;
    requestList.push({
        type: "REQUEST",
        startTime: Date.now() - BACKEND_START,
        url: params.request.url,
        requestId: params.requestId
    });
}

async function onNetworkResponseReceived(params) {
    request = requestList[requestIndex[params.requestId]];
    request.endTime = Date.now() - BACKEND_START;
    backendRecords.push(request);
}

function parsePerformanceRecords(records) {
    parsedRecords = [];
    records.forEach(d => {
        colonIndex = [];
        for (var i = 0; i < d.length; i++) {
            if (d[i] === ':') colonIndex.push(i);
            if (colonIndex.length === 5) break;
        }
        if (colonIndex.length !== 5) return;
        parsedRecords.push({
            ts: parseInt(d.slice(colonIndex[0] + 1, colonIndex[1])) - BACKEND_START,
            type: d.slice(colonIndex[1] + 1, colonIndex[2]),
            startTime: parseInt(d.slice(colonIndex[2] + 1, colonIndex[3])),
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
                type = d.slice(colonIndex[1] + 1, colonIndex[2]);
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

function syntheticalAnalysis() {
    // mutationRecords = parseMutationRecords(mutationRecords);
    performanceRecords = parsePerformanceRecords(performanceRecords);

    traceEvents = JSON.parse(fs.readFileSync(trace_path)).traceEvents;
    NAVIGATION_START = traceEvents.find(d => d.name === "navigationStart").ts;      // microsecond
    traceEvents.forEach(d => { if (d.ts) { d.ts = Math.round((d.ts - NAVIGATION_START) / 1000); } });

    // Computation:
    tRequest = traceEvents.filter(d => d.name === "ResourceSendRequest");
    tResponse = traceEvents.filter(d => d.name === "ResourceReceiveResponse");
    bRequest = backendRecords.filter(d => d.type === "REQUEST");
    tRequest.forEach(d => {
        let t1, t2, t3, t4, t5, t6, t7;
        t1 = d.ts;
        url = d.args.data.url;
        for (var i = 0;i < performanceRecords.length;i ++)  {
            if (performanceRecords[i].name === url) {
                t2 = performanceRecords[i].ts;
                t3 = performanceRecords[i].startTime;
                t4 = performanceRecords[i].startTime + performanceRecords[i].duration;
                break;
            }
        }
        for (var i = 0;i < bRequest.length;i ++) {
            if (bRequest[i].url === url) {
                t5 = bRequest[i].startTime;
                t6 = bRequest[i].endTime;
                break;
            }
        }
        for (var i = 0;i < tResponse.length;i ++) {
            if (tResponse[i].args.data.requestId === d.args.data.requestId)  {
                t7 = tResponse[i].ts;
                break;
            }
        }
        console.log(url, ':', 'Trace', t1, t7, '|', 'Performance', t3, t4, t2, '|', 'Backend', t5, t6);
    });

    // fs.unlinkSync(trace_path);
    // console.log("Trace file removed.");
}

// Resource: fetch (trace, backend) -> parse (trace)
// DOM update: mutation observer (may not work), DOM snapshot, trace (require redundant HTML analysis)
// Paint: backend 
// Functionality: script evaluation (trace)