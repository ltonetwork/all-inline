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
    describe('image', function () {
        it('should embed images', async () => {
            const dom = new JSDOM('<img src="foo.png" alt="A">');

            await allInline(
                dom.window.document,
                readCallback({src: 'foo.png', type: 'data-uri', ret: 'data:image/png;base64,dGVzdA=='}),
            );

            assert.equal(serializeDom(dom), '<img src="data:image/png;base64,dGVzdA==" alt="A">');
        });

        it('should skip an images that can\'t be loaded', async () => {
            const dom = new JSDOM('<img src="foo.png">');

            await allInline(
                dom.window.document,
                readCallback({src: 'foo.png', type: 'data-uri', ret: null}),
            );

            assert.equal(serializeDom(dom), '<img src="foo.png">');
        });

        it('should skip img nodes without a src attribute', async () => {
            const dom = new JSDOM('<img>');

            await allInline(
                dom.window.document,
                readCallback(),
            );

            assert.equal(serializeDom(dom), '<img>');
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

        it('should skip img nodes without a src attribute', async () => {
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
    });
});
