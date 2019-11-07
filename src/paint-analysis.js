const fs = require('fs');
const glob = require('glob'); 

var acreages = [];      // [ Number ]

function roundRect(rect) {
    Object.keys(rect).forEach(k => {
        rect[k] = Math.round(rect[k]);
    });
}

function rectAcreage(rect) {
    return (rect.bottom - rect.top) * (rect.right - rect.left);
}

glob("../1573*.json", {}, (_, files) => {
    files.forEach(f => {
        var content = JSON.parse(fs.readFileSync(f));
        var rects = [];

        content.commandLog.forEach(log => {
            switch (log.method) {
                case "drawRect":
                    rect = log.params.rect;
                    roundRect(rect);
                    rects.push(rect);
                    break;

                case "drawImageRect":
                    rect = log.params.dst;
                    roundRect(rect);
                    rects.push(rect);
                    break;

                case "drawTextBlob":
                    // TODO: ?
                    break;
                    
                default:
                    break;
            }
        });

        actual_paint_acreage = 0;

        rects.forEach(r => {
            actual_paint_acreage += rectAcreage(r);
        });

        acreages.push(actual_paint_acreage);
    });

    console.log(acreages);
});
