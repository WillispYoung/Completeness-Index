const fs = require("fs");

logs = JSON.parse(fs.readFileSync("../output/paint-logs.json"))

// console.log(logs);
styles = { "Fill": 0, "Stroke": 0 };
logs.forEach(d => {
    d.commandLog.forEach(x => {
        if (x.params && x.params.paint) {
            styles[x.params.paint.styleName] += 1;
        }
    });
});

console.log(styles);