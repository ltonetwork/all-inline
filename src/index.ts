import * as css from './css';
import {ReadFunction} from "./types";

async function embedSrc(element: Element, read: ReadFunction): Promise<void> {
    if (!element.hasAttribute('src')) return;

    const src = element.getAttribute('src');
    const contents = await read(src, 'data-uri');
    if (!contents) return;

    element.setAttribute('src', contents);
}

async function embedSrcSet(element: Element, read: ReadFunction): Promise<void> {
    if (!element.hasAttribute('srcset')) return;

    const srcset = element.getAttribute('srcset');
    const entries: Array<Promise<[string, string]>> = srcset.split(',')
        .map(item => item.match(/\S+/)[0])
        .map(src => read(src, 'data-uri').then(content => [src, content]));
    const map = new Map(await Promise.all(entries));

    const embeddedSrcset = srcset.split(',')
        .map(item => item.replace(/\S+/, src => map.get(src) || src))
        .join(',');

    element.setAttribute('srcset', embeddedSrcset);
}

async function inlineScript(script: HTMLScriptElement, read: ReadFunction): Promise<void> {
    if (!script.hasAttribute('src')) return;

    const src = script.getAttribute('src');
    const contents = await read(src, 'text');
    if (!contents) return;

    script.removeAttribute('src');
    script.textContent = contents;
}

async function inlineCSS(link: HTMLLinkElement, read: ReadFunction): Promise<void> {
    if (!link.hasAttribute('href')) return;

    const src = link.getAttribute('href');
    const contents = await read(src, 'text');
    if (!contents) return;

    const style = link.ownerDocument.createElement('style');
    style.textContent = contents;

    link.replaceWith(style);
}

async function inlineIframe(iframe: HTMLIFrameElement, read: ReadFunction): Promise<void> {
    if (!iframe.hasAttribute('src')) return;

    const src = iframe.getAttribute('src');
    const contents = await read(src, 'text');
    if (!contents) return;

    iframe.removeAttribute('src');
    iframe.setAttribute('srcdoc', contents);
}

async function embedStyle(style: HTMLStyleElement, read: ReadFunction): Promise<void> {
    if (!style.textContent.match(/\burl\s*\(/)) return;
    style.textContent = await css.embed(style.textContent, read);
}

async function embedInlineStyle(element: Element, read: ReadFunction): Promise<void> {
    const original = element.getAttribute('style');
    if (!original.match(/\burl\s*\(/)) return;

    const inlined = await css.embedInline(original, read);
    element.setAttribute('style', inlined);
}

export default async function (document: Document|Element, read: ReadFunction): Promise<void> {
    const sources = Array.from(document.querySelectorAll('*[src]'))
        .filter(el => !['IFRAME', 'SCRIPT'].includes(el.tagName.toUpperCase()));
    const sourceSets = Array.from(document.querySelectorAll('*[srcset]'));
    const scripts = Array.from(document.getElementsByTagName('script'));
    const css = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const iframes = Array.from(document.getElementsByTagName('iframe'));

    await Promise.all([
        ...sources.map(img => embedSrc(img, read)),
        ...sourceSets.map(img => embedSrcSet(img, read)),
        ...scripts.map(script => inlineScript(script, read)),
        ...css.map(link => inlineCSS(link as HTMLLinkElement, read)),
        ...iframes.map(iframe => inlineIframe(iframe, read)),
    ]);

    const styles = Array.from(document.getElementsByTagName('style'));
    const inlineStyles = Array.from(document.querySelectorAll('[style*="url"]'))

    await Promise.all([
        ...styles.map(style => embedStyle(style, read)),
        ...inlineStyles.map(element => embedInlineStyle(element, read))
    ]);
}
