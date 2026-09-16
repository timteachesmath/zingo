/// <reference types="vite/client" />

// The retail card sheets live as plain text in data/, so the fixture is
// readable and editable on its own terms. Vite inlines them at build time.
declare module "*?raw" {
  const content: string;
  export default content;
}
