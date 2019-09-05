### API explanation

#### window.performance.timing

**navigationStart**: the timestamp (in milisecond) when previous document's unload terminates

**loadEventEnd**: the timestamp when load (whole page, including all dependent resources are loaded) event terminates

**requestStart**, **responseEnd**: the timestamp for the start of request and end of response for the *main document*, probably emitting the time spent in parsing the response.

**domLoading**: the timestamp when the parser starts working, as when `Document.readyState` changes to `'loading'` and corresponding `readystatechange` event is thrown

**domComplete**: the timestamp when the parser finished its work on the *main document*, as when `Document.readyState` changes to `'complete'`, and corresponding `readystatechange` event is thrown

    Event sequence (earlier to later): 
    readystatechange[interactive] < DOMContentLoaded < readystatechange[complete] < loadEventEnd 
