Write-Host 'Building ALEJO production bundle...'

# Transpile JavaScript
babel src -d dist

# Bundle with Webpack
webpack --config webpack.config.prod.js

# Copy assets
Copy-Item -Path public -Destination dist/public -Recurse

Write-Host 'Build complete!'
