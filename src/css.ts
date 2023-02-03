import * as css from 'css';
import unquote from './unquote';
import {ReadFunction} from "./types";

async function embedDeclarations(declarations: css.Declaration[], read: ReadFunction): Promise<void> {
    const entries: Array<Promise<[string, string]>> = declarations
        .filter(declaration => ("value" in declaration))
        .map(declaration => Array.from(declaration.value?.matchAll(/\burl\((.+?)\)/g) || []))
        .flat()
        .map(match => unquote(match[1]))
        .map(src => read(src, 'data-uri').then(content => [src, content]));

    const map = new Map(await Promise.all(entries));

    for (const declaration of declarations) {
        declaration.value = declaration.value?.replace(
            /\burl\((.+?)\)/g,
            (match, src) => {
                const dataUri = map.get(unquote(src));
                return dataUri ? `url(${dataUri})` : match;
            }
        );
    }
}

async function embedAst(ast: css.Stylesheet, read: ReadFunction): Promise<void> {
    await Promise.all((ast.stylesheet?.rules || [])
        .map((rule: css.Rule) => rule.declarations!)
        .filter(declarations => !!declarations)
        .map(declarations => embedDeclarations(declarations, read))
    );
}

export async function embed(style: string, read: ReadFunction): Promise<string> {
    const ast = css.parse(style);
    await embedAst(ast, read);

    return css.stringify(ast);
}

export async function embedInline(style: string, read: ReadFunction): Promise<string> {
    const ast = css.parse(`* { ${style} }`);

    (ast.stylesheet?.rules[0] as css.Rule).selectors = [];
    await embedAst(ast, read);

    return css.stringify(ast)
        .replace(/^\s*\{\s*|\s*}\s*$/g, '');
}
