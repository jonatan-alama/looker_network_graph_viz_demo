let path = require('path');

const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

let webpackConfig = {
    entry: {
        networkGraph: './src/visualizations/network-graph.tsx'
    },
    output: {
        filename: '[name].js',
        path: path.join(__dirname, 'dist'),
        library: '[name]',
        libraryTarget: 'umd'
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.scss', '.css']
    },
    plugins: [
        new UglifyJSPlugin()
    ],
    module: {
        rules: [
            { test: /\.tsx?$/, loader: 'ts-loader' },
            { test: /\.css$/, loader: [ 'to-string-loader', 'css-loader' ] },
            { test: /\.scss$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'sass-loader',
                ]
            }
        ]
    },
    devServer: {
        contentBase: false,
        compress: true,
        port: 4443,
        https: true
    },
    devtool: 'eval',
    watch: true
};

module.exports = webpackConfig;