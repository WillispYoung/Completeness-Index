const puppeteer = require("puppeteer");

async function delay(t, val) {
    return new Promise(function (resolve) {
        setTimeout(function () {
            resolve(val);
        }, t);
    });
}

const target_url = "https://www.baidu.com";

const eventList = [
    // "DOM.attributeModified",
    // "DOM.attributeRemoved",
    // "DOM.characterDataModified",
    // "DOM.childNodeInserted",
    // "DOM.childNodeRemoved",
    // "DOM.distributedNodesUpdated",
    // "DOM.documentUpdated",
    // "DOM.inlineStyleInvalidated",
    // "DOM.pseudoElementAdded",
    // "DOM.pseudoElementRemoved",

    "CSS.styleSheetAdded",
    // "CSS.styleSheetChanged",
    // "CSS.styleSheetRemoved",

    "Debugger.scriptParsed",
    // "Debugger.scriptFailedToParse",

    // "Runtime.consoleAPICalled",

    "LayerTree.layerPainted",
    "LayerTree.layerTreeDidChange"
];

const listenerList = [
    // onDomAttributeModified,
    // onDomAttributeRemoved,
    // onDomCharacterDataModified,
    // onDomChildNodeInserted,
    // onDomChildNodeRemoved,
    // onDomDistributedNodesUpdated,
    // onDomDocumentUpdated,
    // onDomInlineStyleInvalidated,
    // onDomPseudoElementAdded,
    // onDomPseudoElementRemoved,

    onCssStyleSheetAdded,
    // onCssStyleSheetChanged,
    // onCssStyleSheetRemoved,

    onDebuggerScriptParsed,
    // onDebuggerScriptFailedToParse,

    // onRuntimeConsoleApiCalled,

    onLayerTreeLayerPainted,
    onLayerTreeLayerTreeDidChange
];

puppeteer.launch().then(async browser => {
    page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 800 });
    // await page.tracing.start({path: `output/trace-${new Date().toISOString().slice(0,10)}.json`});

    page.on("load", async () => {
        // await page.tracing.stop();
        await page.close();
        await browser.close();
    });

    page.on("console", async msg => {
        // MutationObserver:
        if (msg.text().startsWith("MO")) {
            console.log(msg.text());
        }
        // PerformanceObserver:
        else if (msg.text().startsWith("PO")) {
            console.log(msg.text());
        }
    });

    const client = await page.target().createCDPSession();
    await client.send("DOM.enable");
    // await client.send("DOMSnapshot.enable");
    await client.send("CSS.enable");
    await client.send("Debugger.enable");
    // await client.send("Runtime.enable");
    await client.send("LayerTree.enable");

    for (var i = 0; i < eventList.length; i++) {
        addListener(client, eventList[i], listenerList[i]);
    }

    await page.evaluateOnNewDocument(activateObserver);

    const START_TIME = new Date().getTime();
    await page.goto(target_url);
});

function activateObserver() {
    var range = document.createRange();
    const mObserver = new MutationObserver((mutations) => {
        // console.log("MO:", mutations);
        mutations.forEach(record => {
            switch (record.type) {
                case "childList":
                    if (record.addedNodes) {
                        nodes = [];
                        Array.from(record.addedNodes).forEach(d => {
                            var area = 0;
                            switch (d.nodeType) {
                                case 1:     // ELEMENT_NODE
                                    rect = d.getBoundingClientRect();
                                    area = Math.round(rect.width * d.height);
                                    break;
                                case 3:     // TEXT_NODE
                                    range.selectNodeContents(d);
                                    rects = range.getClientRects();
                                    if (rects.length) {
                                        area = Math.round(rects[0].width * rects[0].height);
                                    }
                                    break;
                                default:
                                    break;
                            }
                            if (area)
                                nodes.push(`${d.nodeName}[${area}]`);
                        });
                        if (nodes.length)
                            console.log(`MO:${Date.now()}:${record.type}:${record.target.nodeName}:add:${nodes.join("|")}`);
                    }
                    else {
                        nodes = [];
                        Array.from(record.removedNodes).forEach(d => {
                            var area = 0;
                            switch (d.nodeType) {
                                case 1:     // ELEMENT_NODE
                                    rect = d.getBoundingClientRect();
                                    area = Math.round(rect.width * d.height);
                                    break;
                                case 3:     // TEXT_NODE
                                    range.selectNodeContents(d);
                                    rects = range.getClientRects();
                                    if (rects.length) {
                                        area = Math.round(rects[0].width * rects[0].height);
                                    }
                                    break;
                                default:
                                    break;
                            }
                            if (area)
                                nodes.push(`${d.nodeName}[${area}]`);
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

function labeledOutput(name) {
    return function log_(d) {
        console.log("\x1b[36m%s: \x1b[37m%s", name, d);
    };
}

function addListener(client, eventName, callback) {
    log_ = labeledOutput(eventName);
    bindedCallback = callback.bind({ client, log_ });
    client.on(eventName, bindedCallback);
}

async function onDomAttributeModified(params) {
    this.log_(params);
}

async function onDomAttributeRemoved(params) {
    this.log_(params);
}

async function onDomCharacterDataModified(params) {
    this.log_(params);
}

async function onDomChildNodeInserted(params) {
    this.log_(params);
}

async function onDomChildNodeRemoved(params) {
    this.log_(params);
}

async function onDomDistributedNodesUpdated(params) {
    this.log_(params);
}

async function onDomDocumentUpdated(params) {
    this.log_(params);
}

async function onDomInlineStyleInvalidated(params) {
    this.log_(params);
}

async function onDomPseudoElementAdded(params) {
    this.log_(params);
}

async function onDomPseudoElementRemoved(params) {
    this.log_(params);
}

async function onCssStyleSheetAdded(params) {
    // this.log_(params);
    this.log_(`CSS_ADD:${Date.now()}:${params.header.startLine}:${params.header.endLine}:${params.header.sourceURL}`);
}

async function onCssStyleSheetChanged(params) {
    this.log_(params);
}

async function onCssStyleSheetRemoved(params) {
    this.log_(params);
}

async function onDebuggerScriptParsed(params) {
    // this.log_(params);
    this.log_(`SCRIPT_ADD:${Date.now()}:${params.startLine}:${params.endLine}:${params.url}`);
}

async function onDebuggerScriptFailedToParse(params) {
    this.log_(params);
}

async function onRuntimeConsoleApiCalled(params) {
    this.log_(params);
}

async function onLayerTreeLayerPainted(params) {
    // this.log_(params);
    this.log_(`LAYER_PAINT:${Date.now()}:[${params.clip.x},${params.clip.y},${params.clip.width},${params.clip.height}]`)
}

async function onLayerTreeLayerTreeDidChange(params) {
    // this.log_(params);
    if (params.layers) {
        this.log_(`LAYER_TREE_CHANGE:${Date.now()}:`);
    }
}
