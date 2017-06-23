const path = require("path");
const cwd = require("process").cwd();
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const UglifyJSPlugin = require("uglifyjs-webpack-plugin");

const isProd = process.env.NODE_ENV === "production";

const extractSass = new ExtractTextPlugin({
    filename: path.relative(cwd, path.join(__dirname, "bin", "[name].css")),
    disable: process.env.NODE_ENV === "development",
});

const plugins = [extractSass];
if (isProd) {
    plugins.push(new UglifyJSPlugin());
}

module.exports = {
    entry: ".\\" + path.relative(cwd, path.join(__dirname, "app.ts")),
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
                loader:
                    "ts-loader?" +
                        JSON.stringify({
                            configFileName: isProd ? "tsconfig.prod.json" : "tsconfig.json",
                        }),
            },
            {
                test: /\.scss$/,
                use: extractSass.extract({
                    use: [
                        {
                            loader: "css-loader",
                        },
                        {
                            loader: "sass-loader",
                        },
                    ],
                    fallback: "style-loader",
                }),
            },
        ],
    },
    plugins: plugins,
};
