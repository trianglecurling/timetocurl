const ExtractTextPlugin = require("extract-text-webpack-plugin");
const UglifyJSPlugin = require("uglifyjs-webpack-plugin");

const isProd = process.env.NODE_ENV === "production";

const extractSass = new ExtractTextPlugin({
	filename: "./bin/[name].css",
	disable: process.env.NODE_ENV === "development",
});

const plugins = [extractSass];
if (isProd) {
	plugins.push(new UglifyJSPlugin());
}

module.exports = {
	entry: "./app.ts",
	output: {
		filename: "./bin/app.js",
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
