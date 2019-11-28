const { app, ipcMain, ipcRenderer, BrowserWindow } = require('electron');
const puppeteer = require("puppeteer");
const EventEmitter = require("events");
const cleaner = require("clean-html");
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
let mainDoc, paintLogs, domSnapshots, traceEvents;

let window;

app.on('ready', () => {
	window = new BrowserWindow({
		width: WINDOW_SIZE.width,
		height: WINDOW_SIZE.height,
		webPreferences: {
			nodeIntegration: true
		}
	});

	window.loadFile('src/index.html');
	// window.webContents.openDevTools();
});

ipcMain.on("asynchronous-message", (event, arg) => {
	switch (arg.name) {
		case "PASS-URL":
			if (!arg.url) {
				event.reply("asynchronous-reply", {
					name: "PASS-URL", type: "error", value: "Input URL to continue!"
				});
			}
			else {
				request.get(arg.url, (error, response, body) => {
					if (error || response.statusCode !== 200) {
						event.reply("asynchronous-reply", {
							name: "PASS-URL", type: "error", value: "URL cannot be retrived!"
						});
					}
					else {
						TARGET_URL = arg.url;
						cleaner.clean(body, output => { mainDoc = output; });
						mainDoc = documentSimplication(mainDoc);
						// event.reply("asynchronous-reply", { name: "MAIN-DOC", value: mainDoc });

						pageLoading(TARGET_URL, event);
					}
				});
			}
			break;
		case "UPDATE-WINDOW":
			window.setSize(arg.value.width, arg.value.height);
			break;
		case "SEE-PAINT":
			// console.log(paintLogs);
			index = arg.index - 1;
			logs = paintLogs[index].commandLog;
			if (!logs) return;
			for (var i = 0; i < logs.length; i++) {
				switch (logs[i].method) {
					case "drawRect":
					case "drawRRect":
					case "drawImageRect":
					case "drawTextBlob":
					case "drawCircle":
						event.reply("asynchronous-reply", { name: "SEE-PAINT", value: logs[i] });
						break;
					default:
						break;
				}
			}
			break;
		default:
			break;
	}
});

function documentSimplication(originDoc) {
	return originDoc;
}

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
				computedStyles: ["top", "left", "width", "height"],
				includePaintOrder: true,
				includeDOMRects: true
			});
			dom.ts = start;
			domSnapshots.push(dom);

			end = Date.now();
			console.log("DOM snapshot takes", end - start, "ms.");
		}
		catch (e) {
			console.log(e.message);
			domSnapshots.push({});
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
			console.log("Paint logs take", end - start, "ms.");
		}
		catch (e) {
			console.log(e.message);
			paintLogs.push({});
		}

		ongoing_paint -= 1;
		if (page_loaded && ongoing_paint === 0 && ongoing_dom === 0) {
			await closePageAndBrowser(arg.page, arg.browser);
		}
	});

	puppeteer.launch().then(async browser => {
		page = await browser.newPage();
		await page.setViewport(VIEWPORT);

		page.on("load", async () => {
			page_loaded = true;
			console.log("Page loaded.");

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
		clockSynchronization();
	}

	function clockSynchronization() {
		traceEvents = JSON.parse(fs.readFileSync(TRACE_PATH)).traceEvents;
		NAVIGATION_START = traceEvents.find(d => d.name === "navigationStart").ts;

		traceEvents.forEach(d => {
			d.ts = (d.ts - NAVIGATION_START) / 1000;
			if (d.dur) d.dur /= 1000;
		});

		paintLogs.forEach(d => d.ts -= BACKEND_START);
		domSnapshots.forEach(d => d.ts -= BACKEND_START);

		event.reply("asynchronous-reply", { name: "PAINT-REGION", value: VIEWPORT });
		event.reply("asynchronous-reply", { name: "PAINT-COUNT", value: paintLogs.length });

		fs.unlinkSync(TRACE_PATH);
		console.log("Trace file removed.");
	}
}