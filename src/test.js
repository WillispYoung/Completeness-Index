const fs = require("fs");

nodeType = [
    "", "ELEMENT_NODE", "", "TEXT_NODE", "CDATA_SECTION_NODE", "", "", "PROCESSING_INSTRUCTION_NODE",
    "COMMENT_NODE", "DOCUMENT_NODE", "DOCUMENT_TYPE_NODE", "DOCUMENT_FRAGMENT_NODE"
];

function domSnapshotFormat() {
    snapshot = JSON.parse(fs.readFileSync("../output/dom-snapshot.json")).snapshot;

    nonStringIndex = [
        "nodes", "layout", "textBoxes",
        "scrollOffsetX", "scrollOffsetY", "contentWidth", "contentHeight"
    ];

    decodedSnapshot = [];

    snapshot.forEach(d => {
        strRef = d.strings;
        console.log(d.documents.length);
        document = d.documents[0];
        Object.keys(document).forEach(key => {
            if (nonStringIndex.indexOf(key) === -1) {
                if (document[key] !== -1) {
                    document[key] = strRef[document[key]];
                } else {
                    document[key] = "";
                }
            }
        });
        Object.keys(document.nodes).forEach(key => {
            if (key === "nodeType") {
                arr = document.nodes[key];
                document.nodes[key] = [];
                arr.forEach(i => {
                    document.nodes[key].push(nodeType[i]);
                });
            } else if (key === "nodeName" || key === "nodeValue") {
                arr = document.nodes[key];
                document.nodes[key] = [];
                arr.forEach(i => {
                    document.nodes[key].push(i === -1 ? "" : strRef[i]);
                });
            } else if (key === "attributes") {
                arr = document.nodes[key];
                document.nodes[key] = [];
                for (var i = 0; i < arr.length; i++) {
                    document.nodes[key].push([]);
                    arr[i].forEach(j => {
                        document.nodes[key][i].push(j === -1 ? "" : strRef[j]);
                    });
                }
            } else if (key === "textValue" || key === "inputValue" || key === "pseudoType" ||
                key === "currentSourceURL" || key === "originURL") {
                arr = document.nodes[key].value;
                document.nodes[key].value = [];
                arr.forEach(i => {
                    document.nodes[key].value.push(i === -1 ? "" : strRef[i]);
                });
            }
        });
        Object.keys(document.layout).forEach(key => {
            if (key === "styles") {
                arr = document.layout[key];
                document.layout[key] = [];
                for (var i = 0; i < arr.length; i++) {
                    document.layout[key].push([]);
                    arr[i].forEach(j => {
                        document.layout[key][i].push(j === -1 ? "" : strRef[j]);
                    });
                }
            } else if (key === "text") {
                arr = document.layout[key];
                document.layout[key] = [];
                arr.forEach(i => {
                    document.layout[key].push(i === -1 ? "" : strRef[i]);
                });
            }
        });

        decodedSnapshot.push(document);
    });

    fs.writeFileSync("dom-snapshot-decoded.json", JSON.stringify(decodedSnapshot));
}

function textBoxes() {
    snapshot = JSON.parse(fs.readFileSync("../output/dom-snapshot.json")).snapshot;
    snapshot.forEach(d => {
        strRef = d.strings;
        document = d.documents[0];
        document.textBoxes.layoutIndex.forEach(i => {
            console.log(strRef[document.layout.text[i]], nodeType[document.nodes.nodeType[i]]);
        });
    });
}
