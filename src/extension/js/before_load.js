var start_page_load = new Date();

const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
        // `entry` is a PerformanceEntry instance.
        console.log(entry.name);
        // console.log(entry.entryType);
        // console.log(JSON.stringify(entry.attribution));
        console.log(entry.startTime); // DOMHighResTimeStamp
        console.log(entry.duration); // DOMHighResTimeStamp
    }
});

// Start observing the entry types you care about.
// entryTypes include `mark`, `measure`, `frame`, `resource`, `paint`, `longtask` ...
// `paint`: TFP, TFCP
// `longtask`: TTI, really limited information yet.
observer.observe({ entryTypes: ['longtask', 'resource'] });

// Rewrite XMLHttpRequest.
const requestId = 0;

const originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(...args) {
  requestId ++;
  console.log("Send start:", requestId);
  this.addEventListener('readystatechange', () => {
    if (this.readyState === 4)
      console.log("Send over:", requestId);
  });
  return originalSend.apply(this, args);
};

const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(...args) {
  requestId ++;
  console.log("Open start:", requestId);
  this.addEventListener('readystatechange', () => {
    if (this.readyState === 4) {
      console.log('Open over:', requestId);
    }
  });
  return originalOpen.apply(this, args);
};