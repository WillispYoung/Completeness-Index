const { app, ipcMain, BrowserWindow } = require('electron');
const clonedeep = require("lodash.clonedeep");
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
let validPaintArea, pageContent;
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
			index = arg.index - 1;
			logs = paintLogs[index].commandLog;
			if (!logs) return;

			strRef = domSnapshots[index].strings;
			layout = domSnapshots[index].documents[0].layout;

			validTextIndex = [];
			for (var j = 0; j < layout.text.length; j++) {
				if (layout.text[j] !== -1) {
					validTextIndex.push(j);
				}
			}

			for (var i = 0; i < logs.length; i++) {
				switch (logs[i].method) {
					case "drawRect":
					case "drawRRect":
					case "drawImageRect":
					case "drawCircle":
						event.reply("asynchronous-reply", { name: "SEE-PAINT", value: logs[i] });
						break;
					case "drawTextBlob":
						// SOMETIMES THIS IS FAULTY.
						x = logs[i].params.x;
						y = logs[i].params.y;

						minDistance = Number.MAX_SAFE_INTEGER;
						targetIndex = 0;
						validTextIndex.forEach(d => {
							distance = Math.hypot(x - layout.bounds[d][0], y - layout.bounds[d][1]);
							if (distance < minDistance) {
								minDistance = distance;
								targetIndex = d;
							}
						});

						if (layout.text[targetIndex] !== -1) {
							event.reply("asynchronous-reply", { name: "SEE-PAINT", value: logs[i], content: strRef[layout.text[targetIndex]] });
						}
						break;
					default:
						break;
				}
			}
			break;
		case "SEE-PAINT-AREA":
			index = arg.index - 1;
			validPaintArea[index].forEach(d => {
				event.reply("asynchronous-reply", { name: "SEE-PAINT-AREA", value: d });
			});
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
				computedStyles: ["font-size", "opacity", "z-index"],
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
			console.log("Paint logs take", end - start, "ms.");
		}
		catch (e) {
			console.log(e.message);
			paintLogs.push({ ts: Date.now() });
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
		paintLogs.sort((a, b) => { a.ts - b.ts });
		domSnapshots.forEach(d => d.ts -= BACKEND_START);
		domSnapshots.sort((a, b) => (a.ts - b.ts));

		event.reply("asynchronous-reply", { name: "PAINT-REGION", value: VIEWPORT });
		event.reply("asynchronous-reply", { name: "PAINT-COUNT", value: paintLogs.length });

		fs.unlinkSync(TRACE_PATH);
		console.log("Trace file removed.");

		validPaintArea = [];
		for (var i = 0; i < paintLogs.length; i++) {
			validPaintArea.push([]);

			strRef = domSnapshots[i].strings;
			layout = domSnapshots[i].documents[0].layout;

			validTextIndex = [];
			for (var j = 0; j < layout.text.length; j++) {
				if (layout.text[j] !== -1) {
					validTextIndex.push(j);
				}
			}

			paintLogs[i].commandLog.forEach(d => {
				let rect;
				switch (d.method) {
					case "drawRect":
						rect = d.params.rect;
						rect.type = "rect";
						break;
					case "drawRRect":
						rect = d.params.rrect;
						rect.type = "rrect";
						break;
					case "drawImageRect":
						rect = d.params.dst;
						rect.type = "image";
						break;
					case "drawTextBlob":
						x = d.params.x;
						y = d.params.y;

						minDistance = Number.MAX_SAFE_INTEGER;
						targetIndex = 0;
						validTextIndex.forEach(z => {
							distance = Math.hypot(x - layout.bounds[z][0], y - layout.bounds[z][1]);
							if (distance < minDistance) {
								minDistance = distance;
								targetIndex = z;
							}
						});

						if (layout.text[targetIndex] !== -1) {
							rect = {
								left: layout.bounds[targetIndex][0],
								top: layout.bounds[targetIndex][1],
								right: layout.bounds[targetIndex][0] + layout.bounds[targetIndex][2],
								bottom: layout.bounds[targetIndex][1] + layout.bounds[targetIndex][3],
								type: "text",
								value: strRef[layout.text[targetIndex]]
							};
						}
						break;
					default:
						break;
				}
				if (rect) {
					validPaintArea[i].push(rect);
				}
			});
		}

		console.log("Valid paint areas computed.");

		// CALCULATE ACTUAL PAGE CONTENTS.
		// ALL INDEXS REFER TO VALID-PAINT-AREA.
		pageContent = [];
		vpa = clonedeep(validPaintArea);
		for (var i = 0; i < vpa.length; i++) {
			pageContent.push([]);
			vpa[i].forEach(d => {
				d.paint_time = i;
				d.overlap = [];
				pageContent[i].push(d);
			});
			updateAreaRelationship(pageContent[i]);
			if (i > 0) {
				updatePaintTime(pageContent[i], pageContent[i - 1]);
			}
		}

		console.log("Actual page content computed.");
	}

	// CHECK IF RECTANGLE OVERLAP EXISTS.
	function updateAreaRelationship(regions) {
		totalAcreage = 0;
		totalOverlapAcreage = 0;
		for (var i = regions.length - 1; i >= 0; i--) {
			rect1 = regions[i];
			totalAcreage += getAcreage(rect1);
			if (rect1.type === "text") continue;
			for (var j = 0; j < i && j >= 0; j--) {
				rect2 = regions[j];
				if (rect1.right < rect2.left || rect1.left > rect2.right ||
					rect1.bottom < rect2.top || rect1.top > rect2.bottom)
					continue;
				else {
					rect1.overlap.push(j);
					// console.log("In paint overlap:", getOverlapAcreage(rect1, rect2));
					totalOverlapAcreage += getOverlapAcreage(rect1, rect2);
				}
			}
		}
		console.log("Paint area", totalAcreage, ", with overlap", totalOverlapAcreage, ", percentage:", (totalOverlapAcreage / totalAcreage).toFixed(3));
	}

	function getAcreage(rect) {
		return (rect.right - rect.left) * (rect.bottom - rect.top);
	}

	// COMPUTE THE ACREAGE OF THE OVERLAP AREA OF TWO RECTANGLES.
	function getOverlapAcreage(rect1, rect2) {
		x_overlap = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
		y_overlap = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
		overlapArea = x_overlap * y_overlap;
		return overlapArea;
	}

	// GET INDEXS OF REGIONS THAT ARE FULLY OVERLAPPED BY OTHERS.
	function getFullyOverlappedRegions(regions) {
		invalidRegionIndex = [];
		for (var i = regions.length - 1; i >= 0; i--) {
			if (invalidRegionIndex.indexOf(i) !== -1) continue;
			rect1 = regions[i];
			regions[i].overlap.forEach(d => {
				rect2 = regions[d];
				if (rect1.top <= rect2.top && rect1.bottom >= rect2.bottom &&
					rect1.left <= rect2.left && rect1.right >= rect2.right) {
					invalidRegionIndex.push(d);
				}
			});
		}
		return invalidRegionIndex;
	}

	// ADD AREAS FROM LAST PAINT THAT ARE NOT FULLY OVERLAPPED BY THIS PAINT.
	function updatePaintTime(regions, former_regions) {
		currentInvalidRegions = getFullyOverlappedRegions(regions);
		previousInvalidRegions = getFullyOverlappedRegions(former_regions);

		crossPaintOverlapAcreage = 0;
		for (var i = regions.length - 1; i >= 0; i--) {
			if (currentInvalidRegions.indexOf(i) !== -1) continue;
			if (regions[i].type === "text") continue;
			rect1 = regions[i];

			for (var j = former_regions.length - 1; j >= 0; j--) {
				if (previousInvalidRegions.indexOf(j) !== -1) continue;
				rect2 = former_regions[j];
				if (rect1.top <= rect2.top && rect1.bottom >= rect2.bottom &&
					rect1.left <= rect2.left && rect1.right >= rect2.right) {
					previousInvalidRegions.push(j);
					// console.log("Cross paint overlap:", (rect2.right - rect2.left) * (rect2.bottom - rect2.top));
					crossPaintOverlapAcreage += (rect2.right - rect2.left) * (rect2.bottom - rect2.top);
				}
			}
		}

		console.log("Cross paint overlap acreage", crossPaintOverlapAcreage);
		for (var i = 0; i < former_regions.length; i++) {
			if (previousInvalidRegions.indexOf(i) === -1) {
				regions.push(former_regions[i]);
			}
		}
	}
}
