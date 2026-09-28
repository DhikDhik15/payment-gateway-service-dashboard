/// <reference types="vite/client" />

declare module 'react-dom/server.browser' {
  export { renderToStaticMarkup } from 'react-dom/server';
}
