function activateObserver() {
    var range = document.createRange();
    const mObserver = new MutationObserver((mutations) => {
        // console.log("mutation:", mutations.length);
        mutations.forEach(record => {
            switch (record.type) {
                case "childList":
                    if (record.addedNodes) {
                        nodes = [];
                        Array.from(record.addedNodes).forEach(d => {
                            var area = 0;
                            switch (d.nodeType) {
                                case 1:     // ELEMENT_NODE
                                    rect = d.getBoundingClientRect();
                                    // console.log(d.nodeName, rect);
                                    area = Math.round(rect.width * rect.height);
                                    break;
                                case 3:     // TEXT_NODE
                                    range.selectNodeContents(d);
                                    rects = range.getClientRects();
                                    if (rects.length) {
                                        // console.log(d.nodeName, rects[0]);
                                        area = Math.round(rects[0].width * rects[0].height);
                                    }
                                    break;
                                default:
                                    break;
                            }
                            if (area)
                                nodes.push(`${d.nodeName}[${area}]`);
                        });
                        if (nodes.length)
                            console.log(`MO:${Date.now()}:${record.type}:${record.target.nodeName}:add:${nodes.join("|")}`);
                    }
                    else {
                        nodes = [];
                        Array.from(record.removedNodes).forEach(d => {
                            var area = 0;
                            switch (d.nodeType) {
                                case 1:     // ELEMENT_NODE
                                    rect = d.getBoundingClientRect();
                                    area = Math.round(rect.width * d.height);
                                    break;
                                case 3:     // TEXT_NODE
                                    range.selectNodeContents(d);
                                    rects = range.getClientRects();
                                    if (rects.length) {
                                        area = Math.round(rects[0].width * rects[0].height);
                                    }
                                    break;
                                default:
                                    break;
                            }
                            if (area)
                                nodes.push(`${d.nodeName}[${area}]`);
                        });
                        if (nodes.length)
                            console.log(`MO:${Date.now()}:${record.type}:${record.target.nodeName}:remove:${nodes.join("|")}`);
                    }
                    break;
                case "attribute":
                    console.log(`MO:${Date.now()}:${record.type}:${record.target.nodeName}:${record.attributeName}`);
                    break;
                case "characterData":
                    console.log(`MO:${Date.now()}:${record.type}:${record.target.nodeName}:${record.attributeName}`);
                    break;
                default:
                    break;
            }
        });
    });
    const pObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            console.log(`PO:${Date.now()}:${entry.entryType}:${Math.round(entry.startTime)}:${Math.round(entry.duration)}:${entry.name}`);
        }
    });
    mObserver.observe(document, {
        attributes: true,
        childList: true,
        subtree: true,
        // attributeFilter: [],
    });
    pObserver.observe({ entryTypes: ['longtask', 'resource'] });
}
activateObserver();