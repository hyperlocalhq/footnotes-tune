import ESLintPlugin from 'eslint-webpack-plugin';
import postcssNestedAncestors from 'postcss-nested-ancestors';
import postcssNested from 'postcss-nested';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


export default {
  entry: './src/index.ts',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [ '@babel/preset-env' ],
            },
          },
          'ts-loader',
          // 'eslint-loader'
        ],
      },
      {
        test: /\.(css|pcss)$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: true,
              importLoaders: 1
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  postcssNestedAncestors,
                  postcssNested,
                ]
              }
            }
          }
        ],
      },
      {
        test: /\.(svg)$/,
        use: [
          {
            loader: 'raw-loader',
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: 'footnotes.js',
    path: path.resolve(__dirname, 'dist'),
    // publicPath: '/',
    library: {
      type: 'module',
    },
    // library: 'FootnotesTune',
    // libraryTarget: 'umd',
    // libraryExport: 'default',
  },
  experiments: {
    outputModule: true,
  },
  plugins: [
    new ESLintPlugin({
      extensions: ['ts', 'js'], // Specify the file types to lint
      fix: true, // Automatically fix linting issues (optional)
      failOnError: true, // Fail the build if there are linting errors
    }),
    // ...other plugins if needed
  ],
};
