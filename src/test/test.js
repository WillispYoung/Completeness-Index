function a() {
    console.log("x");
}

// console.log(a.toString().split("\r\n"));
// console.log(typeof a.toString());

arr = a.toString().split("\r\n");
arr = arr.slice(1, this.length - 1);
console.log(arr.join(''));