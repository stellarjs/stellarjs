const webpackConfig = require('../../webpack.config')(__dirname);

webpackConfig.entry = {
  'index': `${__dirname}/src/index.browser.js`
};

console.info(`Library: ${webpackConfig.output.library}`);


module.exports = webpackConfig;
