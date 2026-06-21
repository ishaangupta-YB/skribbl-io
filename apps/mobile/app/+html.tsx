import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

/**
 * Web-only HTML shell wrapping every page during static rendering. Sets the
 * viewport and a background color matching the theme so there's no flash.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: rootStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const rootStyle = `
  html, body { height: 100%; }
  body { background-color: #FBFBFE; overflow: hidden; }
  @media (prefers-color-scheme: dark) {
    body { background-color: #0B1020; }
  }
`;
