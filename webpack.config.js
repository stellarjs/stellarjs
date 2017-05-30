const path = require('path');
const nodeExternals = require('webpack-node-externals');

function webpackConfig(context) {
  return {
    context: __dirname,
    resolve: {
      extensions: ['.js'],
    },
    entry: {
      index: `${context}/src/index.js`,
    },
    output: {
      path: path.resolve(context, 'lib'),
      filename: '[name].browser.js',
    },
    externals: [nodeExternals()], // in order to ignore all modules in node_modules folder
    module: {
      loaders: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              babelrc: false,
              presets: [
                ['es2015', { modules: false }],
              ],
            },
          },
        },
      ],
    },
    plugins: [],
  };
}

module.exports = webpackConfig;
