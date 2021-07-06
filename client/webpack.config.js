const path = require("path");
const cwd = require("process").cwd();
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const isProd = process.env.NODE_ENV === "production";

const extractSass = new MiniCssExtractPlugin({
  filename: path.relative(cwd, path.join(__dirname, "bin", "[name].css")),
});

const plugins = [extractSass];
if (isProd) {
  // plugins.push(new UglifyJSPlugin());
}

module.exports = {
  entry: "./" + path.relative(cwd, path.join(__dirname, "app.ts")),
  output: {
    filename: path.relative(cwd, path.join(__dirname, "bin", "app.js")),
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".scss"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
      },
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: { importLoaders: 1 },
          },
          {
            loader: "sass-loader",
          },
          {
            loader: "postcss-loader",
          },
        ],
      },
    ],
  },
  plugins: plugins,
};
