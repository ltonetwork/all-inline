export default function (s: string) {
    if (s[0] !== "'" && s[0] !== "\"") return s;

    const quote = s[0]
    const single = quote === "'"
    return s.substring(1, s.length - 1)
        .replace(/\\\\/g, '\\')
        .replace(single ? /\\'/g : /\\"/g, quote)
}
