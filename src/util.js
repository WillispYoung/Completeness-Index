function getPaintRegions(paintLogs, domSnapshots) {
    paintRegions = [];
    for (var i = 0; i < paintLogs.length; i++) {
        paintRegions.push([]);

        if (paintLogs[i].commandLog) {
            strRef = domSnapshots[i].strings;
            layout = domSnapshots[i].documents[0].layout;
            textBoxes = domSnapshots[i].documents[0].textBoxes;

            // SKIA COLOR IS ARGB.
            paintLogs[i].commandLog.forEach(d => {
                switch (d.method) {
                    case "drawRect":
                        if (d.params.paint.styleName === "Fill") {
                            paintRegions[i].push({
                                color: '#' + d.params.paint.color.slice(3),
                                rect: d.params.rect,
                                type: "rect",
                                style: "fill"
                            });
                        } else if (d.params.paint.styleName === "Stroke") {
                            paintRegions[i].push({
                                color: '#' + d.params.paint.color.slice(3),
                                rect: d.params.rect,
                                type: "rect",
                                style: "stroke",
                                lineWidth: d.params.paint.strokeWidth
                            });
                        }
                        break;
                    case "drawRRect":
                        if (d.params.paint.styleName === "Fill") {
                            paintRegions[i].push({
                                color: '#' + d.params.paint.color.slice(3),
                                rect: d.params.rrect,
                                type: "rrect",
                                style: "fill"
                            });
                        } else if (d.params.paint.styleName === "Stroke") {
                            paintRegions[i].push({
                                color: '#' + d.params.paint.color.slice(3),
                                rect: d.params.rrect,
                                type: "rrect",
                                style: "stroke",
                                lineWidth: d.params.paint.strokeWidth
                            });
                        }
                        break;
                    case "drawImageRect":
                        paintRegions[i].push({
                            color: '#' + d.params.paint.color.slice(3),
                            rect: d.params.dst,
                            type: "image"
                        });
                        break;
                    case "drawTextBlob":
                        x = d.params.x;
                        y = d.params.y;

                        minDistance = Number.MAX_SAFE_INTEGER;
                        targetIndex = -1;

                        for (var j = 0; j < textBoxes.bounds.length; j++) {
                            distance = Math.hypot(x - textBoxes.bounds[j][0], y - textBoxes.bounds[j][1]);
                            if (distance < minDistance) {
                                minDistance = distance;
                                targetIndex = j;
                            }
                        }

                        targetIndex = textBoxes.layoutIndex[targetIndex];

                        if (layout.text[targetIndex] !== -1) {
                            text = strRef[layout.text[targetIndex]];
                            rect = {
                                left: layout.bounds[targetIndex][0],
                                top: layout.bounds[targetIndex][1],
                                right: layout.bounds[targetIndex][0] + layout.bounds[targetIndex][2],
                                bottom: layout.bounds[targetIndex][1] + layout.bounds[targetIndex][3],
                            };
                            paintRegions[i].push({
                                color: '#' + d.params.paint.color.slice(3),
                                type: "text",
                                point: { x, y },
                                rect,
                                text
                            });
                        }
                        break;
                    default:
                        break;
                }
            });
        }
    }
    return paintRegions;
}

function isOverlapped(rect1, rect2) {
    return !(rect1.right < rect2.left || rect1.left > rect2.right ||
        rect1.bottom < rect2.top || rect1.top > rect2.bottom);
}

function getAcreage(rect) {
    return (rect.right - rect.left) * (rect.bottom - rect.top);
}

function getOverlapAcreage(rect1, rect2) {
    x_overlap = Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left);
    y_overlap = Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top);
    return x_overlap * y_overlap;
}

// RETURN SUB-RECTANGLES THAT DON'T OVERLAP THE UPPER RECTANGLE.
function segmentRectangle(upper, lower) {
    x = [upper.left, upper.right, lower.left, lower.right];
    y = [upper.top, upper.bottom, lower.top, lower.bottom];
    x.sort();
    y.sort();
    sub_rects = [];
    for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
            sub_rects.push({
                left: x[i],
                right: x[i + 1],
                top: y[j],
                bottom: y[j + 1]
            })
        }
    }
    res = [];
    sub_rects.forEach(rect => {
        if (rect.left === x[1] && rect.right === x[2] &&
            rect.top === y[1] && rect.bottom === y[2])
            return;
        else if (rect.left >= lower.left && rect.right <= lower.right &&
            rect.top >= lower.top && rect.bottom <= lower.bottom) {
            res.push(rect);
        }
    });
    return res;
}

module.exports = { getPaintRegions };
