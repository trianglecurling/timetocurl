const path = require("path");
const cwd = require("process").cwd();
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const isProd = process.env.NODE_ENV === "production";

const plugins = [new MiniCssExtractPlugin()];

module.exports = {
	mode: isProd ? "production" : "development",
	entry: path.join(__dirname, "app.ts"),
	output: {
		filename: "app.js",
		path: path.join(__dirname, "bin")
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
				test: /\.s[ac]ss$/i,
				use: [
					// Makes a .css file
					MiniCssExtractPlugin.loader,
					// Translates CSS into CommonJS
					"css-loader",
					// Compiles Sass to CSS
					"sass-loader",
				],
			},
		],
	},
	plugins,
};
