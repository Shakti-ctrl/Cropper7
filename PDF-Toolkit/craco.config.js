/* craco.config.js */
const path = require(`path`);

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Disable source map generation
      webpackConfig.devtool = false;
      return webpackConfig;
    },
    alias: {
      "@": path.resolve(__dirname, "src/"),
    },
  },
};
