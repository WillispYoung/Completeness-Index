var fs = require("fs");
var trace_file = "trace2019-10-25T09-1.json"

var content = JSON.parse(fs.readFileSync(trace_file));
var events = content.traceEvents;

var categories = new Set();
var names = new Set();
var category_name = new Set();

events.forEach(event => {
	event.cat.split(',').forEach(s => categories.add(s));
	names.add(event.name);
	category_name.add(`${event.cat}  ${event.name}`);
});

categories = Array.from(categories);
categories.sort();
console.log("Category:", categories);

// console.log("Name:", names);

category_name = Array.from(category_name);
category_name.sort();
category_name.forEach(d => console.log(d));
