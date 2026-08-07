// Type shim for @sparticuz/chromium — optional Vercel/Lambda Chromium binary.
// The package is a peer dependency; in local dev it may not be installed.
declare module "@sparticuz/chromium" {
  const chromium: {
    executablePath(): Promise<string>;
    args: string[];
    defaultViewport: { width: number; height: number } | null;
  };
  export default chromium;
}
