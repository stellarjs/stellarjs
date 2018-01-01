const path = require('path');
const nodeExternals = require('webpack-node-externals');
const last = require('lodash/last');

function webpackConfig(context) {
  return {
    context: __dirname,
    resolve: {
      extensions: ['.js'],
    },
    entry: {
      index: `${context}/src/index.js`,
    },
    target: 'node',
    output: {
      path: path.resolve(context, 'lib'),
      filename: '[name].browser.js',
      library: `@stellarjs/${last(context.split('/'))}`,
      libraryTarget: 'umd',
    },
    externals: [nodeExternals({ modulesFromFile: true })], // in order to ignore all modules in node_modules folder
    module: {
      loaders: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              babelrc: false,
              presets: ["env"],
              plugins: ["transform-object-rest-spread"]
            },
          },
        },
      ],
    },
    plugins: [],
  };
}

module.exports = webpackConfig;
