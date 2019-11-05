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
                    if (cat_name[e.cat][e.name])
                        cat_name[e.cat][e.name] ++;
                    else
                        cat_name[e.cat][e.name] = 1;
                }
                else {
                    cat_name[e.cat] = {};
                    cat_name[e.cat][e.name] = 1;
                }
            });

            // Object.keys(cat_name).forEach(key => {
            //     cat_name[key] = Array.from(new Set(cat_name[key]));
            // });

            output = JSON.stringify(cat_name);
            // while (output.includes('[')) {
            //     output = output.replace('[', '{');
            // }
            // while (output.includes(']')) {
            //     output = output.replace(']', '}');
            // }
            fs.writeFileSync(trace_path.replace('trace', 'category'), output);
        }
    }, 1000);
});

puppeteer.launch().then(async browser => {
    now = new Date().toISOString();
    while (now.includes(':')) {
        now = now.replace(':', '-');
    }
    now.replace('\.', '-');
    
    final_url = url;
    while (url.includes(':') || url.includes("/")) {
        url = url.replace(':', '');
        url = url.replace('/', '');
    }

    if (url.startsWith("https"))
        trace_path = `trace-${url.substring(6)}-${now}.json`;
    else if (url.startsWith("http"))
        trace_path = `trace-${url.substring(5)}-${now}.json`;

    page = await browser.newPage();
    await page.tracing.start({
        path: trace_path,
        screenshot: true
    });
    await page.goto(final_url);
    await page.tracing.stop().then(() => {
        browser.close();
        emitter.emit('traceEnd');
    });
});
