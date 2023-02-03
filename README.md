# All inline

Inline images, css, and javascript in an HTML document.

This library is agnostic to how the assets are loaded, allowing it to be used in the browser or with nodejs. 

The following HTML elements and CSS data types are inlined:
* Scripts
* Linked CSS stylesheets
* Imported CSS stylesheets
* Images
* CSS `url()` data types

# Usage

```js
import allInline from "all-inline";

// NodeJS specific libraries. The browser supports this natively.
import { JSDOM } from "jsdom";
import mime from "mime-types";
import fs from "fs/promises";

const dom = new JSDOM(`
    <script src="main.js"></script>
    <link rel="stylesheet" href="main.css"/>
    <style> div { background-image: url('path/to/file'); } </style>
    <div style="background-image: url('path/to/file');"></div>
    <img src="path/to/file"/>
`);

await allInline(dom.window.document, async (src, type) => {
    const mimeType = mime.lookup(src) || 'application/octet-stream';
    const encoding = 'base64';
    const data = (await fs.readFile(src)).toString(encoding);
    return `data:${mimeType};${encoding},${data}`;
});

console.log(dom.serialize());
/*
    <script>const a = 1;</script>
    <style>@font-face { src: url('data:...'); }</style>
    <style>div { background-image: url('data:...'); }</style>
    <div style="background-image: url('data:...');"></div>
    <img src="data:..."/>
*/
```
