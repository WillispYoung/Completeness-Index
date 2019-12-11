const fs = require("fs");

const trace_path = "trace2019-11-12T05-5.json";
var content = JSON.parse(fs.readFileSync(trace_path));
var events = content.traceEvents;

var sequence = [];
var metrics = [];

var eventOfInterst = [
    "ParseHTML",
    "EvaluateScript",
    "ParseAuthorStyleSheet",
    "ScheduleStyleRecalculation",
    "InvalidateLayout",
    "Layout",
    "UpdateLayoutTree",
    "PaintImage",
    "Paint",
    "ImageDecodeTask",
    "Decode Image",
    "Decode LazyPixelRef",
    "Draw LazyPixelRef"
];

var metricOfInterest = [
    "firstPaint",
    "firstContentfulPaint",
    "firstMeaningfulPaintCandidate",
    "firstImagePaint"
];

events.forEach(e => {
    if (eventOfInterst.indexOf(e.name) !== -1) {
        sequence.push(e);
    }
    else if (metricOfInterest.indexOf(e.name) !== -1) {
        metrics.push(e);
    }
});

// total_sequence = sequence.concat(metrics);

// sequence.sort((a,b) => a.ts - b.ts);
// metrics.sort((a,b) => a.ts - b.ts);
// total_sequence.sort((a,b) => a.ts - b.ts);

// total_sequence.forEach(e => {console.log(e.name)});

sequence.forEach(e => {
    console.log(e.name, e.ph, e.tid, e.ph === "B" ? e.args.beginData.startLine : e.args.endData.endLine, e.ts);
});
