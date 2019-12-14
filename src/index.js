const { app, ipcMain, BrowserWindow } = require('electron');
const EventEmitter = require("events");
const request = require("request");
const util = require("./util");
const pageLoading = require("./loading");

const windowSize = { width: 800, height: 600 };
const viewportSize = { width: 1000, height: 700 };

let targetLink, loadData, paintRegions, pageComposition;

app.on('ready', () => {
    window = new BrowserWindow({
        width: windowSize.width,
        height: windowSize.height,
        webPreferences: {
            nodeIntegration: true
        }
    });

    window.loadFile('./src/index.html');
});

reminder = new EventEmitter();

reminder.on("load_finish", arg => {
    loadData = arg.output;
    paintRegions = util.getPaintRegions(loadData.paintLogs, loadData.domSnapshots);
    arg.event.reply("asynchronous-reply", { name: "PAINT-REGION", value: viewportSize });
    arg.event.reply("asynchronous-reply", { name: "PAINT-COUNT", value: loadData.paintLogs.length });
});

ipcMain.on("asynchronous-message", (event, arg) => {
    switch (arg.name) {
        case "PASS-URL":
            if (!arg.url) {
                event.reply("asynchronous-reply", {
                    name: "ERROR",
                    value: "Input URL to continue!"
                });
            } else {
                request.get(arg.url, (error, response, body) => {
                    if (error || response.statusCode !== 200) {
                        event.reply("asynchronous-reply", {
                            name: "ERROR",
                            value: "URL cannot be retrived!"
                        });
                    } else {
                        targetLink = arg.url;
                        pageLoading(viewportSize, arg.url, event, reminder);
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
        default:
            break;
    }
});