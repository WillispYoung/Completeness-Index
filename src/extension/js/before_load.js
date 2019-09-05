var start_page_load = new Date();

const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // `entry` is a PerformanceEntry instance.
      console.log(entry.name);
    //   console.log(entry.entryType);
      console.log(JSON.stringify(entry.attribution));
      console.log(entry.startTime); // DOMHighResTimeStamp
      console.log(entry.duration); // DOMHighResTimeStamp
    }
  });
  
  // Start observing the entry types you care about.
  // entryTypes include `mark`, `measure`, `frame`, `resource`, `paint`, `longtask` ...
  // `paint`: TFP, TFCP
  // `longtask`: TTI, really limited information yet.
  observer.observe({entryTypes: ['longtask']}); 
