const ChromeLauncher = require("chrome-launcher");
const WebSocket = require("ws");
const http = require('http');

let _browser;
let _connection;
let script_id = 0;

ChromeLauncher.launch({ chromeFlags: ['--headless', '--disable-gpu'] })
    .then(chrome => {
        _browser = chrome;

        const request = http.get({
            hostname: "localhost",
            port: chrome.port,
            path: "/json/list"
        }, response => {
            let data = '';

            response.on('data', chunk => {
                data += chunk;
            });

            response.on('end', () => {
                if (response.statusCode === 200) {
                    try {
                        tabs = JSON.parse(data);
                        console.log(tabs);

                        debugger_url = tabs[0].webSocketDebuggerUrl;
                        const connection = new WebSocket(debugger_url);
                        _connection = connection;

                        connection.onopen = event => {
                            console.log("WebSocket is open now.")
                        };

                        connection.onmessage = msg => {
                            console.log(msg);
                        };

                        connection.onclose = msg => {
                            console.log("connection closed");
                        };
                    } catch (e) {
                        console.log(e);
                    }
                }
            });
        });

        var stdin = process.openStdin();
        stdin.addListener('data', d => {
            data = d.toString().trim(); // remove line feed.
            try {
                if (data === "exit") {
                    _connection.close();
                    _browser.kill();
                    process.exit();
                } else {
                    _connection.send(JSON.stringify({id: script_id ++, method: data}));
                }
            } catch (e) {
                console.log(e);
            }
        });
    });