var page = require("webpage").create();
var system = require("system");

page.onResourceRequested = function(request) {
    console.log('REQ:' + JSON.stringify(request, undefined, 4));
    // console.log(request[1]);
};

page.onResourceReceived = function(response) {
    console.log("REC: " + JSON.stringify(response, undefined, 4));
    // console.log(response[1]);
};

page.open('https://www.baidu.com', function() {
    setTimeout(function(){
        page.render("baidu.png");
    }, 200);

    page.evaluate(function() {
        console.log(document.title);
        // document.getElementById(*) ...
        // $("button").click() ... 
    });

    phantom.exit();
});