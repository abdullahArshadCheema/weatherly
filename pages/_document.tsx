import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class MyDocument extends Document {
  render() {
    // Conservative CSP for a static Next export. Allow inline styles/scripts for Next hydration; restrict connections to required APIs.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      // Next static export may include inline scripts/styles for hydration; keep as 'unsafe-inline' to avoid breakage
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://nominatim.openstreetmap.org",
    ].join('; ');

    return (
      <Html lang="en">
        <Head>
          <meta httpEquiv="Content-Security-Policy" content={csp} />
          <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
          <meta httpEquiv="X-Frame-Options" content="DENY" />
          <meta name="referrer" content="no-referrer" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
