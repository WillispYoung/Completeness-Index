var fs = require("fs");

const trace_path = "trace2019-11-12T05-5.json";
var content = JSON.parse(fs.readFileSync(trace_path));
var events = content.traceEvents;

var cat_name = {};

events.forEach(e => {
    if (cat_name[e.cat]) {
        if (cat_name[e.cat][e.name])
            cat_name[e.cat][e.name]++;
        else
            cat_name[e.cat][e.name] = 1;
    } else {
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