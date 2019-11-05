const EventEmitter = require('events');
const puppeteer = require('puppeteer');

const eventEmitter = new EventEmitter();

eventEmitter.once("domCreated", async args => {
    mainDoc = await args.client.send("DOM.getDocument", {pierce: true});
    inputs = await args.client.send("DOM.querySelectorAll", {nodeId: mainDoc.root.nodeId, selector: "input"});

    console.log("Inputs:", inputs);
    inputs.nodeIds.forEach(async id => {
        remoteObj = await args.client.send("DOM.resolveNode", {nodeId: id});
    });
});

puppeteer.launch().then(async browser => {
    page = await browser.newPage();
    const client = await page.target().createCDPSession();

    await client.send("Debugger.enable");
    await client.send("DOM.enable");
    await client.send("Runtime.enable");
    await client.send("LayerTree.enable");
    
    client.on("Debugger.scriptParsed", async args => {
        console.log("DEBUG.SrciptParsed", args.scriptId, args.url);
    });

    client.on("DOM.attributeModified", async args => {
        console.log("DOM.AttrMod:", args.nodeId, args.name, args.value);
    });

    client.on("DOM.childNodeInserted", async args => {
        console.log("DOM.ChildNodeInsert:", args.parentNodeId, args.previousNodeId, args.node);
    });

    client.on("DOM.documentUpdated", () => {
        console.log("DOM.DocUpdate");
        eventEmitter.emit("domCreated", {page, client});
    });

    client.on("Runtime.bindingCalled", args => {
        console.log("Runtime.BindCall:", args.name, args.payload);
    });

    client.on("Runtime.consoleAPICalled", args => {
        console.log("Runtime.ConsoleAPI:", args.type, args.args);
    });

    client.on("Runtime.executionContextCreated", args => {
        console.log("Runtime.ContextCreate:", args.context.name);
    });

    client.on("LayerTree.layerPainted", async args => {
        console.log("LayerTree.LayerPaint:", args.clip);

        snapshotId = await client.send("LayerTree.makeSnapshot", {layerId: args.layerId});
        commandLog = await client.send("LayerTree.snapshotCommandLog", {snapshotId: snapshotId});

        console.log(new Date(), commandLog.commandLog.length);
    });

    await page.goto("http://localhost:8000");
});