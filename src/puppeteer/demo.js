const puppeteer = require("puppeteer");
const fs = require("fs");

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

    page.on('')

    // ---> Combine CDP together.
    try {
        const client = await page.target().createCDPSession();
        await client.send('Network.enable');

        client.on("Network.responseReceived", async function(requestId) {
            try {
                var response = await client.send('Network.getResponseBody', requestId);
                // console.log(response.base64Encoded);
                if (!response.base64Encoded) {
                    // --> Contains JavaScript files.
                    var content = response.body;

                }
            } catch (e) {
                // console.log(e);
                console.log("Error receiving response.");
            }
        });

        await client.send('LayerTree.enable');

        // --> Combine layerTree change with layer paint?
        client.on('LayerTree.layerTreeDidChange', async function(layers) {
        	// var now = new Date().getTime();
         //    console.log(now, layers);
        });

        client.on('LayerTree.layerPainted', async function(layerId, clip) {
        	var now = new Date().getTime();
            try {
            	if (clip) 
            		console.log(now, layerId, clip);
            	else
            		console.log(now, layerId);

                var snapshotId = await client.send('LayerTree.makeSnapshot', layerId);
                var imgUrl = await client.send('LayerTree.replaySnapshot', snapshotId);

                // console.log(typeof(imgUrl));
                // console.log(imgUrl.dataURL);
                // fs.writeFile('a.txt', imgUrl.dataURL, () => {});
                // process.exit();

                var base64Data = imgUrl.dataURL.replace(/^data:image\/\w+;base64,/, "");
                var buffer = new Buffer(base64Data, 'base64');
                fs.writeFile("tmp/" + now + ".png", buffer, () => {});
            } catch (e) {
                console.log(e);
                // console.log("Error capturing layer paint events.");
                process.exit();
            }
        });

    } catch (e) {
        // console.log(e);
        console.log("Error creating CDP session.");
    }

    // --> Always put this line at the end of file!
    await page.goto('https://www.qq.com');

    // ---> Hold command line window.
    var input = process.stdin.read();
});