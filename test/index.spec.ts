// noinspection CssUnknownTarget

import allInline from "../src/index";
import { JSDOM } from "jsdom";
import * as assert from "assert";

function serializeDom(dom: JSDOM): string {
    return dom.serialize()
        .replace(/<\/?(html|head|body)>/g, '')
        .replace(/[\n\s]+/g, ' ');
}

function readCallback(...expected: {src: string, type: 'text'|'data-uri', ret: string|null}[]) {
    return async (src, type) => {
        const expect = expected.shift();
        if (!expect) assert.fail("Unexpected call to read callback");

        assert.equal(src, expect.src);
        assert.equal(type, expect.type);

        return expect.ret;
    }
}

describe('allInline()', () => {
    describe('src', function () {
        it('should embed an image', async () => {
            const dom = new JSDOM('<img src="foo.png" alt="A">');

            await allInline(
                dom.window.document,
                readCallback({src: 'foo.png', type: 'data-uri', ret: 'data:image/png;base64,dGVzdA=='}),
            );

            assert.equal(serializeDom(dom), '<img src="data:image/png;base64,dGVzdA==" alt="A">');
        });

        it('should embed a video', async () => {
            const dom = new JSDOM('<video><source src="foo.mp4" type="video/mp4"></video>');

            await allInline(
                dom.window.document,
                readCallback({src: 'foo.mp4', type: 'data-uri', ret: 'data:image/png;base64,dGVzdA=='}),
            );

            assert.equal(serializeDom(dom), '<video><source src="data:image/png;base64,dGVzdA==" type="video/mp4"></video>');
        });

        it('should work on a child element', async () => {
            const dom = new JSDOM('<img src="header.png"><div id="template"><img src="foo.png"></div>');

            await allInline(
                dom.window.document.getElementById('template'),
                readCallback({src: 'foo.png', type: 'data-uri', ret: 'data:image/png;base64,dGVzdA=='}),
            );

            assert.equal(serializeDom(dom), '<img src="header.png"><div id="template"><img src="data:image/png;base64,dGVzdA=="></div>');
        });

        it('should skip if src can\'t be loaded', async () => {
            const dom = new JSDOM('<img src="foo.png">');

            await allInline(
                dom.window.document,
                readCallback({src: 'foo.png', type: 'data-uri', ret: null}),
            );

            assert.equal(serializeDom(dom), '<img src="foo.png">');
        });
    });

    describe('srcset', function () {
        it('should embed a picture', async () => {
            const dom = new JSDOM('<picture><source srcset="foo.png, foo-1.5x.png 1.5x"></picture>');

            await allInline(
                dom.window.document,
                readCallback(
                    {src: 'foo.png', type: 'data-uri', ret: 'data:image/png;base64,dGVzdA=='},
                    {src: 'foo-1.5x.png', type: 'data-uri', ret: 'data:image/png;base64,MS41eA=='},
                ),
            );

            assert.equal(serializeDom(dom), '<picture><source srcset="data:image/png;base64,dGVzdA==, data:image/png;base64,MS41eA== 1.5x"></picture>');
        });

        it('should skip if src can\'t be loaded', async () => {
            const dom = new JSDOM('<picture><source srcset="foo.png, foo-1.5x.png 1.5x"></picture>');

            await allInline(
                dom.window.document,
                readCallback(
                    {src: 'foo.png', type: 'data-uri', ret: null},
                    {src: 'foo-1.5x.png', type: 'data-uri', ret: 'data:image/png;base64,MS41eA=='},
                ),
            );

            assert.equal(serializeDom(dom), '<picture><source srcset="foo.png, data:image/png;base64,MS41eA== 1.5x"></picture>');
        });
    });

    describe('script', function () {
        it('should embed javascript', async () => {
            const dom = new JSDOM('<script src="main.js"></script>');

            await allInline(
                dom.window.document,
                readCallback({src: 'main.js', type: 'text', ret: 'const two = 1 + 1;'}),
            );

            assert.equal(serializeDom(dom), '<script>const two = 1 + 1;</script>');
        });

        it('should skip an scripts that can\'t be loaded', async () => {
            const dom = new JSDOM('<script src="main.js"></script>');

            await allInline(
                dom.window.document,
                readCallback({src: 'main.js', type: 'text', ret: null}),
            );

            assert.equal(serializeDom(dom), '<script src="main.js"></script>');
        });

        it('should skip script elements without a src attribute', async () => {
            const dom = new JSDOM('<script>const two = 1 + 1;</script>');

            await allInline(
                dom.window.document,
                readCallback(),
            );

            assert.equal(serializeDom(dom), '<script>const two = 1 + 1;</script>');
        });
    });

    describe('stylesheet', function () {
        it('should embed stylesheet', async () => {
            const dom = new JSDOM('<link rel="stylesheet" href="style.css">');

            await allInline(
                dom.window.document,
                readCallback({src: 'style.css', type: 'text', ret: 'body { height: 100%; }'}),
            );

            assert.equal(serializeDom(dom), '<style>body { height: 100%; }</style>');
        });

        it('should embed url() in css', async () => {
            const dom = new JSDOM('<style>body { background: url("bg.jpg"); }</style>');

            await allInline(
                dom.window.document,
                readCallback({ src: 'bg.jpg', type: 'data-uri', ret: 'data:image/png;base64,dGVzdA=='}),
            );

            assert.equal(serializeDom(dom), '<style>body { background: url(data:image/png;base64,dGVzdA==); }</style>');
        });

        it('should embed url() in loaded stylesheet', async () => {
            const dom = new JSDOM('<link rel="stylesheet" href="style.css">');

            await allInline(
                dom.window.document,
                readCallback(
                    { src: 'style.css', type: 'text', ret: 'body { background: url(bg.jpg); }'},
                    { src: 'bg.jpg', type: 'data-uri', ret: 'data:image/png;base64,dGVzdA=='},
                )
            );

            assert.equal(serializeDom(dom), '<style>body { background: url(data:image/png;base64,dGVzdA==); }</style>');
        });

        it('should embed url() in style attribute', async () => {
            const dom = new JSDOM('<div id="foo" style="background: url(bg.jpg)"></div>');

            await allInline(
                dom.window.document,
                readCallback({ src: 'bg.jpg', type: 'data-uri', ret: 'data:image/png;base64,dGVzdA=='}),
            );

            assert.equal(serializeDom(dom), '<div id="foo" style="background: url(data:image/png;base64,dGVzdA==);"></div>');
        });

        it('should be applied to @media rules', async () => {
            const dom = new JSDOM('<style>@media screen { body { background: url("bg.jpg"); } }</style>');

            await allInline(
                dom.window.document,
                readCallback({ src: 'bg.jpg', type: 'data-uri', ret: 'data:image/png;base64,dGVzdA=='}),
            );

            assert.equal(serializeDom(dom), '<style>@media screen { body { background: url(data:image/png;base64,dGVzdA==); } }</style>');
        });

        it('should inline stylesheets from @import statements', async () => {
            const dom = new JSDOM('<style>@import url("base.css"); a { color: blue; }</style>', {
                url: "https://example.org/",
            });

            await allInline(
                dom.window.document,
                readCallback({ src: 'base.css', type: 'text', ret: 'body { color: black; }'}),
            );

            assert.equal(serializeDom(dom), '<style>body { color: black; } a { color: blue; }</style>');
        });

        it('should embed url() from imported stylesheets', async () => {
            const dom = new JSDOM('<style>@import url("base.css");</style>', {
                url: "https://example.org/",
            });

            await allInline(
                dom.window.document,
                readCallback(
                { src: 'base.css', type: 'text', ret: 'body { background: url(bg.jpg); }'},
                    { src: 'bg.jpg', type: 'data-uri', ret: 'data:image/png;base64,dGVzdA=='},
                ),
            );

            assert.equal(serializeDom(dom), '<style>body { background: url(data:image/png;base64,dGVzdA==); }</style>');
        });
    });

    describe('iframe', function () {
        it('should inline an iframe', async () => {
            const dom = new JSDOM('<iframe src="hello.html"></iframe>');

            await allInline(
                dom.window.document,
                readCallback({src: 'hello.html', type: 'text', ret: '<p>Hello World!</p>'}),
            );

            assert.equal(serializeDom(dom), '<iframe srcdoc="<p>Hello World!</p>"></iframe>');
        });

        it('should skip iframes without a src attribute', async () => {
            const dom = new JSDOM('<iframe srcdoc="abc"></iframe>');

            await allInline(
                dom.window.document,
                readCallback(),
            );

            assert.equal(serializeDom(dom), '<iframe srcdoc="abc"></iframe>');
        });

        it('should skip if src can\'t be loaded', async () => {
            const dom = new JSDOM('<iframe src="hello.html"></iframe>');

            await allInline(
                dom.window.document,
                readCallback({src: 'hello.html', type: 'text', ret: null}),
            );

            assert.equal(serializeDom(dom), '<iframe src="hello.html"></iframe>');
        });
    });
});
