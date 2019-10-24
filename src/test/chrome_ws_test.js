const ChromeLauncher = require("chrome-launcher");
const WebSocket = require("ws");
const http = require('http');

ChromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu']
}).then(chrome => {
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

                    connection.on('open', () => {
                        console.log("connection established");
                    });

                    connection.on('message', data => {
                        object = JSON.parse(data);
                        console.log('message', object);
                    });

                    connection.on('close', () => {
                        console.log("connection closed");
                    });
                    
                    connection.on('error', error => {
                    	console.log(error);
                    });
                } catch (e) {
                    console.log(e);
                }
                finally {
                }
            }
        });
    });
});
