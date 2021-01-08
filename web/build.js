#!/usr/bin/env node
const {build} = require("estrella")
build({
    entry: "src/app.jsx",
    outfile: "public/bundle.js",
    bundle: true,
    sourcemap: true,
    debug: true,
    minify: false,
    define: {
        'process.env.NODE_ENV': "development"
    }
})