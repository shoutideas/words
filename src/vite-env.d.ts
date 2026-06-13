/// <reference types="vite/client" />
/// <reference types="@crxjs/vite-plugin/client" />

declare module '*.css?inline' {
  const content: string;
  export default content;
}
