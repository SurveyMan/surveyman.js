module.exports = {
    // The main "entry point" of your web app. WebPack will pack every module that
    // this file depends on (and its dependencies depend on).
    entry: './SurveyMan/main.js',
    // Package up the application as 'app.js' in the 'build/js' directory.
    // __dirname is a magic variable that contains the directory that webpack.config.js
    // is located in.
    output: {
        filename: "surveyman.main.js"
    },
    exclude: /(node_modules)/,
    module: {
        // Transforms your application's code using Babel.
        // Babel lets you use new JavaScript features in browsers that do not
        // have them. In particular, Babel lets you use JavaScript modules, which
        // are a recent addition to JavaScript that are not supported by all browsers.
        // In the future, this transformation step will not be necessary.
        // (The babel-loader will also compile your React templates to JavaScript.)
        loaders : [
            {
                loader: 'babel-loader',
                query: {
                    presets: ['es2015']
                }
            }
            ]
    }
}
