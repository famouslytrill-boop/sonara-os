"use strict";

module.exports = {
  ci: {
    collect: {
      url: [
        "http://127.0.0.1:3000/",
        "http://127.0.0.1:3000/pricing",
        "http://127.0.0.1:3000/products"
      ],
      numberOfRuns: 2,
      settings: {
        chromeFlags: "--headless --no-sandbox --disable-dev-shm-usage"
      }
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.70, aggregationMethod: "optimistic" }],
        "categories:accessibility": ["error", { minScore: 0.90, aggregationMethod: "optimistic" }],
        "categories:best-practices": ["error", { minScore: 0.85, aggregationMethod: "optimistic" }],
        "categories:seo": ["error", { minScore: 0.80, aggregationMethod: "optimistic" }]
      }
    },
    upload: {
      target: "filesystem",
      outputDir: "artifacts/lighthouse"
    }
  }
};
