const ExtractTextPlugin = require("extract-text-webpack-plugin");

const extractSass = new ExtractTextPlugin({
	filename: "./bin/[name].css",
	disable: process.env.NODE_ENV === "development",
});

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
				loader: "ts-loader",
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
	plugins: [extractSass],
};
