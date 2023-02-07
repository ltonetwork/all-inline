# All inline

Inline javascript, stylesheets, and images from an HTML page.

This library is agnostic to how the assets are loaded, allowing it to be used in the browser or with nodejs. 

The following HTML elements and CSS data types are inlined:
* Scripts
* Linked CSS stylesheets
* Imported CSS stylesheets
* Images
* CSS `url()` data types

## Installation

    npm i all-inline

## Usage

```js
import allInline from "all-inline";

// NodeJS specific libraries, not needed for the browser.
import { JSDOM } from "jsdom";
import mime from "mime-types";
import fs from "fs/promises";

const dom = new JSDOM(`
    <script src="main.js"></script>
    <link rel="stylesheet" href="main.css"/>
    <style>div { background-image: url('path/to/file'); }</style>
    <div style="background-image: url('path/to/file');"></div>
    <img src="path/to/file"/>
`);

await allInline(dom.window.document, async (src, type) => {
    if (type === 'text') {
        return await fs.readFile(src, 'utf8');
    }
    
    const mimeType = mime.lookup(src) || 'application/octet-stream';
    const encoding = 'base64';
    const data = await fs.readFile(src, encoding);
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

### Arguments

#### Document

The function takes a DOM `Document` or `Element` as first argument. If an element is passed,
only the children are modified.

#### Callback

The callback should have 2 arguments `src` and `type`.

* The `src` argument is the path to the file.
* The `type` argument can be either `"text"` or `"data-uri"`. _The callback should throw an
error if the file is binary and text is required._

The callback must return the contents of the file as string. Either as plain text or encoded
as [data-uri](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs)
(depending on the `type` argument). If the callback returns `null`, inlining that element will
be skipped.
