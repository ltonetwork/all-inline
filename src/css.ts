import {CssCommentAST, CssDeclarationAST, CssRuleAST, CssStylesheetAST, parse, stringify} from '@adobe/css-tools'
import unquote from './unquote';
import {ReadFunction} from "./types";

async function embedDeclarations(
    declarations: Array<CssDeclarationAST|CssCommentAST>,
    read: ReadFunction
): Promise<void> {
    const entries: Array<Promise<[string, string]>> = declarations
        .filter(declaration => ("value" in declaration))
        .map((declaration: CssDeclarationAST) =>
            Array.from(declaration.value?.matchAll(/\burl\((.+?)\)/g) || []))
        .flat()
        .map(match => unquote(match[1]))
        .map(src => read(src, 'data-uri').then(content => [src, content]));

    const map = new Map(await Promise.all(entries));

    for (const declaration of declarations) {
        if (!("value" in declaration)) continue;

        declaration.value = declaration.value?.replace(
            /\burl\((.+?)\)/g,
            (match, src) => {
                const dataUri = map.get(unquote(src));
                return dataUri ? `url(${dataUri})` : match;
            }
        );
    }
}

async function embedAst(ast: CssStylesheetAST, read: ReadFunction): Promise<void> {
    await Promise.all((ast.stylesheet?.rules || [])
        .map((rule: CssRuleAST) => rule.declarations!)
        .filter(declarations => !!declarations)
        .map((declarations: CssDeclarationAST[]) => embedDeclarations(declarations, read))
    );
}

export async function embed(style: string, read: ReadFunction): Promise<string> {
    const ast = parse(style);
    await embedAst(ast, read);

    return stringify(ast);
}

export async function embedInline(style: string, read: ReadFunction): Promise<string> {
    const ast = parse(`* { ${style} }`);

    (ast.stylesheet?.rules[0] as CssRuleAST).selectors = [];
    await embedAst(ast, read);

    return stringify(ast)
        .replace(/^\s*\{\s*|\s*}\s*$/g, '');
}
