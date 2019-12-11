const { ipcRenderer } = require("electron");
const colors = { "rect": "#00DDDD", "rrect": "#0000DD", "image": "#00FF00", "text": "#DD00DD" };

notice = document.getElementById("notice");
Object.keys(colors).forEach(type => {
    text = document.createElement('text');
    text.innerText = type;
    text.style = "display: inline-block; margin-right: 5px";
    rect = document.createElement('div');
    rect.style = `width: 10px; height: 10px; background-color: ${colors[type]}; display: inline-block; margin-right: 5px`;
    notice.appendChild(text);
    notice.appendChild(rect);
});

canvas = document.getElementById("paint");
context = canvas.getContext("2d");

ipcRenderer.on("asynchronous-reply", (event, arg) => {
    switch (arg.name) {
        case "PASS-URL":
            if (arg.type && arg.type === "error") {
                document.getElementById("error").innerHTML = arg.value;
            }
            break;
        case "LOG":
            original_value = document.getElementById('log').innerText;
            original_value += (original_value.length ? "\n" : "") + arg.value;
            document.getElementById('log').innerText = original_value;
            break;
        case "PAINT-REGION":
            canvas.width = arg.value.width + 20;
            canvas.height = arg.value.height + 20;
            canvas.style = "border: darkcyan 1px dashed; padding: 10px";
            break;
        case "PAINT-COUNT":
            if ((selectNode = document.getElementById("paint_index"))) {
                while (selectNode.length) {
                    selectNode.remove(0);
                }
                if (arg.value) {
                    for (var i = 0; i < arg.value; i++) {
                        var option = document.createElement('option');
                        option.text = i + 1;
                        option.value = i + 1;
                        selectNode.add(option);
                    }
                }
            } else if (arg.value) {
                var metadata = document.getElementById("metadata");
                var selectNode = document.createElement("select");
                selectNode.id = "paint_index";
                for (var i = 0; i < arg.value; i++) {
                    var option = document.createElement('option');
                    option.text = i + 1;
                    option.value = i + 1;
                    selectNode.add(option);
                }
                metadata.appendChild(selectNode);

                var btn1 = document.createElement("input");
                btn1.type = "button";
                btn1.id = "see_paint";
                btn1.value = "SEE PAINT";
                btn1.onclick = seePaint;
                metadata.appendChild(btn1);

                btn2 = document.createElement("input");
                btn2.type = "button";
                btn2.id = "see_paint_region";
                btn2.value = "SEE PAINT REGION";
                btn2.onclick = seePaintRegion;
                metadata.appendChild(btn2);
            }
            break;
        case "SEE-PAINT":
            region = arg.value;
            switch (region.type) {
                case "rect":
                case "rrect":
                    if (region.style === "fill") {
                        fillRect(region.rect, region.color);
                    } else if (region.style === "stroke") {
                        strokeRect(region.rect, region.color, region.lineWidth);
                    }
                    break;
                case "image":
                    fillRect(region.rect, region.color);
                    break;
                case "text":
                    context.fillStyle = region.color;
                    context.fillText(region.text, region.point.x, region.point.y);
                    break;
                default:
                    break;
            }
            break;
        case "SEE-PAINT-REGION":
            rect = arg.value.rect;
            context.lineWidth = 1;
            if (arg.value.style === "stroke") {
                context.setLineDash([10]);
            } else {
                context.setLineDash([]);
            }
            context.strokeStyle = colors[arg.value.type];
            context.strokeRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
            break;
        case "TEST":
            console.log(arg.value);
            break;
        default:
            break;
    }
});

function fillRect(rect, color) {
    context.fillStyle = color;
    context.fillRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
}

function strokeRect(rect, color, lineWidth) {
    context.strokeStyle = color;
    context.lineWidth = region.lineWidth;
    context.strokeRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
}

function passURL() {
    url = document.getElementById('url').value;
    ipcRenderer.send('asynchronous-message', { name: "PASS-URL", url: url });
    document.getElementById('log').innerText = "";
}

function seePaint() {
    document.getElementById("error").innerHTML = "";
    context.clearRect(0, 0, canvas.width, canvas.height);
    paintIndex = parseInt(document.getElementById("paint_index").value);
    ipcRenderer.send('asynchronous-message', { name: "SEE-PAINT", index: paintIndex });
}

function seePaintRegion() {
    document.getElementById("error").innerHTML = "";
    context.clearRect(0, 0, canvas.width, canvas.height);
    paintIndex = parseInt(document.getElementById("paint_index").value);
    ipcRenderer.send('asynchronous-message', { name: "SEE-PAINT-REGION", index: paintIndex });
}