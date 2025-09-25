declare module 'fuzzysort' {
  export interface KeyOptions {
    key?: string;
  }

  export interface GoOptions<T = string> {
    keys?: string[];
    key?: string;
    limit?: number;
    threshold?: number;
    allowTypo?: boolean;
    scoreFn?: (a: PreparedResult<T>) => number;
  }

  export interface PreparedResult<T = string> {
    target: string;
    score: number;
    obj?: T;
  }

  export interface GoResult<T = string> extends PreparedResult<T> {}

  function go<T = string>(query: string, targets: ReadonlyArray<T>, options?: GoOptions<T>): Array<GoResult<T>>;
  function go<T = string>(query: string, targets: ReadonlyArray<string>, options?: GoOptions<T>): Array<GoResult<T>>;
  function highlight(result: GoResult, openTag?: string, closeTag?: string): string;
  function cleanup(): void;

  export { go, highlight, cleanup };
  export default {
    go,
    highlight,
    cleanup,
  };
}

declare module 'mammoth' {
  interface ConvertOptions {
    buffer?: Buffer;
    path?: string;
  }

  interface MammothMessage {
    type: 'info' | 'warning' | 'error';
    message: string;
  }

  interface ExtractRawTextResult {
    value: string;
    messages: MammothMessage[];
  }

  export function extractRawText(options: ConvertOptions): Promise<ExtractRawTextResult>;
  export function convertToHtml(options: ConvertOptions): Promise<{ value: string; messages: MammothMessage[] }>;
  export type { MammothMessage, ExtractRawTextResult };
  const mammoth: {
    extractRawText: typeof extractRawText;
    convertToHtml: typeof convertToHtml;
  };
  export default mammoth;
}
