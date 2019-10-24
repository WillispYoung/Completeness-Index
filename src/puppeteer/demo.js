const puppeteer = require("puppeteer");
const fs = require("fs");

var args = process.argv;

var debug = false;
if (args.length === 2)
    debug = false;
else if (args[2] === "debug=false")
    debug = false;
else if (args[2] === "debug=true")
    debug = true;

if (debug) {
    if (fs.existsSync('tmp')) {
        var files = fs.readdirSync('tmp');
        files.forEach((file, index) => {
            fs.unlinkSync('tmp/' + file);
        });
    }
    else
        fs.mkdirSync('tmp');
}

puppeteer.launch().then(async browser => {
    const page = await browser.newPage();

    await page.setViewport({
        width: 1000,
        height: 800
    });

    page.on("domcontentloaded", async function() {
        console.log('DOM Content Loaded');
        // await page.screenshot({ path: 'dcl.png' });
    });

    page.on('load', async function() {
        console.log('Page Loaded');

        // await page.screenshot({ path: 'l.png' });
        // await browser.close();
    });

    // ---> Combine CDP together.
    try {
        const client = await page.target().createCDPSession();
        await client.send('Network.enable');

        client.on("Network.responseReceived", async function(args) {
            try {
                console.log(args.response.url);    // Contains resources requested.

                // var request = await client.send('Network.getRequestPostData', requestId);
                // var response = await client.send('Network.getResponseBody', requestId);

                // if (!response.base64Encoded) {
                //     // --> Contains JavaScript files.
                //     var content = response.body;
                // }
            } catch (e) {
                // console.log(e);
                console.log("Error receiving response for", args.response.url);
            }
        });

        await client.send('LayerTree.enable');

        // --> Combine layerTree change with layer paint?
        client.on('LayerTree.layerTreeDidChange', async function(layers) {
            // var now = new Date().getTime();
            if (debug)
                console.log(now, layers);
        });

        client.on('LayerTree.layerPainted', async function(layerId, clip) {
            var now = new Date().getTime();
            try {
                if (debug) {
                    if (clip)
                        console.log(now, layerId, clip);
                    else
                        console.log(now, layerId);
                }

                var snapshotId = await client.send('LayerTree.makeSnapshot', layerId);

                // Get detailed canvas paint informations, seemingly used by Chrome to update a page.
                var commandLog = await client.send('LayerTree.snapshotCommandLog', snapshotId);
                for (var i = 0; i < commandLog.commandLog.length; i++) {
                    if (debug) {
                        console.log(commandLog.commandLog[i].method);
                        if (commandLog.commandLog[i].params)
                            console.log(commandLog.commandLog[i].params);
                    }
                }

                // Save the image of updated layer.
                if (debug) {
                    var imgUrl = await client.send('LayerTree.replaySnapshot', snapshotId);
                    var base64Data = imgUrl.dataURL.replace(/^data:image\/\w+;base64,/, "");
                    var buffer = new Buffer(base64Data, 'base64');
                    fs.writeFile("tmp/" + now + ".png", buffer, () => {});
                }
            } catch (e) {
                // console.log(e);
            }
        });

    } catch (e) {
        // console.log(e);
        console.log("Error creating CDP session.");
    }

    // --> Always put this line at the end of file!
    await page.goto('https://www.baidu.com');

    // ---> Hold command line window.
    var input = process.stdin.read();
});