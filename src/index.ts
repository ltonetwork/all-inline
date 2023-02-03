import * as css from './css';
import {ReadFunction} from "./types";

async function embedImg(img: HTMLImageElement, read: ReadFunction): Promise<void> {
    if (!img.hasAttribute('src')) return;

    const src = img.getAttribute('src');
    const contents = await read(src, 'data-uri');
    if (!contents) return;

    img.setAttribute('src', contents);
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

async function embedStyle(style: HTMLStyleElement, read: ReadFunction): Promise<void> {
    if (!style.textContent.match(/url\(/)) return;
    style.textContent = await css.embed(style.textContent, read);
}

async function embedInlineStyle(element: Element, read: ReadFunction): Promise<void> {
    const style = await css.embedInline(element.getAttribute('style'), read);
    element.setAttribute('style', style);
}

export default async function (document: Document, read: ReadFunction): Promise<void> {
    const images = Array.from(document.getElementsByTagName('img'));
    const scripts = Array.from(document.getElementsByTagName('script'));
    const css = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

    await Promise.all([
        ...images.map(img => embedImg(img, read)),
        ...scripts.map(script => inlineScript(script, read)),
        ...css.map(link => inlineCSS(link as HTMLLinkElement, read)),
    ]);

    const styles = Array.from(document.getElementsByTagName('style'));
    const inlineStyles = Array.from(document.querySelectorAll('*[style*="url("]'));

    await Promise.all([
        ...styles.map(style => embedStyle(style, read)),
        ...inlineStyles.map(element => embedInlineStyle(element, read))
    ]);
}
