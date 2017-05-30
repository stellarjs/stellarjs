const webpackConfig = require('../../webpack.config')(__dirname);

webpackConfig.entry = {
  'index': `${__dirname}/src/index.browser.js`
};

module.exports = webpackConfig;
