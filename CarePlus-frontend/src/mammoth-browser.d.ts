declare module 'mammoth/mammoth.browser' {
  interface MammothResult {
    value: string;
    messages: Array<{ type: string; message?: string }>;
  }
  interface Mammoth {
    extractRawText(options: { arrayBuffer?: ArrayBuffer; path?: string }): Promise<MammothResult>;
  }
  const mammoth: Mammoth;
  export default mammoth;
}
