var start_page_load = new Date();

const pObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
        console.log("PO:", entry);
    }
});
const mObserver = new MutationObserver((mutations) => {
    // console.log("MO:", mutations);
    mutations.forEach(record => {
        switch (record.type) {
            case "childList":
                if (record.addedNodes) {
                    nodes = [];
                    Array.from(record.addedNodes).forEach(d => {
                        nodes.push(d.nodeName);
                    });
                    console.log(`MO:${record.type}:${record.target.nodeName}:add:${nodes.join("|")}`);
                }
                else {
                    nodes = [];
                    Array.from(record.removedNodes).forEach(d => {
                        nodes.push(d.nodeName);
                    });
                    console.log(`MO:${record.type}:${record.target.nodeName}:remove:${nodes.join("|")}`);
                }
                break;
            case "attribute":
                console.log(`MO:${record.type}:${record.target}:${record.attributeName}`);
                break;
            case "characterData":
                console.log(`MO:${record.type}:${record.target}:${record.attributeName}`);
            default:
                break;
        }
    });
});
// pObserver.observe({ entryTypes: ['longtask', 'resource'] });
mObserver.observe(document, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['href', 'src'],
});