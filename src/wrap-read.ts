import {ReadFunction} from "./types";

function absolutePath(path, src) {
    if (src.match(/^\w+:\/\//)) return src;

    if (src.startsWith('/')) {
        return (path.match(/^\w+:\/\//) ? path.replace(/^(\w+:\/\/[^/]+).*/, '$1') : '') + src;
    }

    return path + src;
}

export default function (parent: string|undefined, read: ReadFunction) {
    if (!parent || !parent.match(/.\//)) return read;

    const path = parent.replace(/[^/]+$/, '');
    return (src: string, type) => read(absolutePath(path, src), type);
}
