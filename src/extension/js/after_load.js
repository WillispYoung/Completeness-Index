// 1. Original Page Load Time
// Timeout should be greater than page load time, so that time_metris is properly acquired.
// Otherwise page_load_time can be acquired using timestamps allocated in before_load and after_load,
// However connection_time and render_time cannot be acquired easily.
// Deprecated API.
setTimeout(function(){
    var time_record = window.performance.timing;

    var time_metrics = {
        page_load_time: time_record.loadEventEnd - time_record.navigationStart,
        connection_time: time_record.responseEnd - time_record.requestStart,
        render_time: time_record.domComplete - time_record.domLoading
    };
    
    // chrome.runtime.sendMessage(time_metrics, function(response) {
    //     console.log(response);
    // });

    console.log(time_metrics);
}, 2000);  // timeout should be conservative

// 2. Time to First (Meaningful) Paint

// 3. Inject rewrite code. 
// Unable to process requests that are called during loading.
var s = document.createElement("script");
s.src = chrome.extension.getURL("js/rewrite_xmlhttp.js");
s.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(s);

