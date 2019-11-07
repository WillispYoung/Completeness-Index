### API explanation

#### window.performance.timing

**navigationStart**: the timestamp (in milisecond) when previous document's unload terminates.

**loadEventEnd**: the timestamp when load (whole page, including all dependent resources are loaded) event terminates.

**requestStart**, **responseEnd**: the timestamp for the start of request and end of response for the *main document*, probably emitting the time spent in parsing the response.

**domLoading**: the timestamp when the parser starts working, as when `Document.readyState` changes to `'loading'` and corresponding `readystatechange` event is thrown.

**domComplete**: the timestamp when the parser finished its work on the *main document*, as when `Document.readyState` changes to `'complete'`, and corresponding `readystatechange` event is thrown.

---

**Event Sequence** (earlier to later):
`readystatechange[interactive]` < `DOMContentLoaded` < `readystatechange[complete]` < `loadEventEnd` 

---

### Metrics

1. Speed Index

2. Time to Interactive

3. Input Latency

4. Total Blocking Time

5. Max Potential First Input Delay