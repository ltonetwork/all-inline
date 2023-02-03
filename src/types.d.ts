export type ReadFunction = (source: string, encoding: 'text'|'data-uri') => Promise<string|null>;
