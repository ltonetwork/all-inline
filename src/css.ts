import {
    CssAtRuleAST,
    CssCommentAST,
    CssDeclarationAST,
    CssImportAST,
    CssMediaAST,
    CssRuleAST,
    parse,
    stringify
} from '@adobe/css-tools'
import unquote from './unquote';
import {ReadFunction} from "./types";
import wrapRead from "./wrap-read";

async function processUrl(
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

async function processImport(rule: CssImportAST, read: ReadFunction): Promise<CssAtRuleAST[]> {
    const src = unquote(rule.import.replace(/url\((.*)\)/, '$1'));
    const content = await read(src, 'text');
    if (!content) return [rule];

    const rules = parse(content).stylesheet.rules;
    await embedAst(rules, wrapRead(src, read));

    return rules;
}

async function embedRulesAst(rules: CssAtRuleAST[], read: ReadFunction): Promise<void> {
    await Promise.all(rules
        .map((rule: CssRuleAST) => rule.declarations!)
        .filter(declarations => !!declarations)
        .map((declarations: CssDeclarationAST[]) => processUrl(declarations, read))
    );
}

async function embedMediaAst(rules: CssAtRuleAST[], read: ReadFunction): Promise<void> {
    await Promise.all(rules
        .filter(rule => rule.type === 'media')
        .map((rule: CssMediaAST) => embedRulesAst(rule.rules, read))
    );
}

async function embedImportAst(rules: CssAtRuleAST[], read: ReadFunction): Promise<void> {
    await Promise.all(rules.map((rule, index) => {
        if (rule.type !== 'import') return;

        return processImport(rule, read)
            .then(newRules => rules.splice(index, 1, ...newRules))
    }));
}

async function embedAst(rules: CssAtRuleAST[], read: ReadFunction): Promise<void> {
    await Promise.all([
        embedRulesAst(rules, read),
        embedMediaAst(rules, read),
    ]);

    await embedImportAst(rules, read);
}

export async function embed(style: string, read: ReadFunction, src?: string): Promise<string> {
    const ast = parse(style, { source: src });
    await embedAst(ast.stylesheet.rules, wrapRead(src, read));

    return stringify(ast);
}

export async function embedInline(style: string, read: ReadFunction): Promise<string> {
    const ast = parse(`* { ${style} }`);

    (ast.stylesheet.rules[0] as CssRuleAST).selectors = [];
    await embedRulesAst(ast.stylesheet.rules, read);

    return stringify(ast)
        .replace(/^\s*\{\s*|\s*}\s*$/g, '');
}
