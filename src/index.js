const EventEmitter = require('events');
const puppeteer = require('puppeteer');
const fs = require('fs');

let url, trace_path;

if (process.argv.length < 3) {
    url = "about:blank";
}
else {
    url = process.argv[2];
}

const emitter = new EventEmitter();

emitter.on('traceEnd', () => {
    console.log("Tracing finished.");

    setTimeout(() => {
        if (fs.existsSync(trace_path)) {
            var content = JSON.parse(fs.readFileSync(trace_path));
            var events = content.traceEvents;

            var cat_name = {};

            events.forEach(e => {
                if (cat_name[e.cat]) {
                    cat_name[e.cat].push(e.name);
                }
                else {
                    cat_name[e.cat] = [e.name];
                }
            });

            Object.keys(cat_name).forEach(key => {
                cat_name[key] = Array.from(new Set(cat_name[key]));
            });

            fs.writeFileSync(trace_path.replace('trace', 'category'), JSON.stringify(cat_name));
        }
    }, 1000);
});

puppeteer.launch().then(async browser => {
    now = new Date().toISOString();
    while (now.includes(':')) {
        now = now.replace(':', '-');
    }
    now.replace('\.', '-');

    if (url.startsWith("https"))
        trace_path = `trace-${url.substring(8)}-${now}.json`;
    else if (url.startsWith("http"))
        trace_path = `trace-${url.substring(7)}-${now}.json`;

    page = await browser.newPage();
    await page.tracing.start({
        path: trace_path,
        screenshot: true
    });
    await page.goto(url);
    await page.tracing.stop().then(() => {
        browser.close();
        emitter.emit('traceEnd');
    });
});
