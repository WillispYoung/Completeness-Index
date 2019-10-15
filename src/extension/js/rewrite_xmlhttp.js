// Rewrite XMLHttpRequest.
var requestId = 0;

const originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(...args) {
  requestId ++;
  console.log("XMLHttpRequest.Send start:", requestId);
  this.addEventListener('readystatechange', () => {
    if (this.readyState === 4)
      console.log("XMLHttpRequest.Send over:", requestId);
  });
  return originalSend.apply(this, args);
};

const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(...args) {
  requestId ++;
  console.log("XMLHttpRequest.Open start:", requestId);
  this.addEventListener('readystatechange', () => {
    if (this.readyState === 4) {
      console.log('XMLHttpRequest.Open over:', requestId);
    }
  });
  return originalOpen.apply(this, args);
};