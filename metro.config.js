const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'mjs', 'html'],
  },
  server: {
    /**
     * Strip the `Origin` header from /assets/ requests before they reach
     * Metro's dev-middleware security check.  In development, the WebView
     * loads HTML templates from the Metro HTTP server
     * (http://10.0.2.2:8081/assets/...) and those pages then request
     * sibling JS modules (pdf.min.mjs, etc.) with
     * `Origin: http://10.0.2.2:8081`.  Metro's security middleware treats
     * any request that originates from its own base URL as a potential
     * CSRF attack and returns "Unauthorized request".  Removing the Origin
     * header for asset-only requests is safe - assets are static files that
     * carry no secrets and need no CSRF protection.
     */
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        if (req.url && req.url.startsWith('/assets/')) {
          delete req.headers['origin'];
        }
        middleware(req, res, next);
      };
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
