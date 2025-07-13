Write-Host 'Building ALEJO production bundle...'

# Install dependencies
npm install

# Transpile JavaScript
node_modules\.bin\babel src -d dist

# Bundle with Webpack
node_modules\.bin\webpack --config webpack.config.prod.js

# Copy assets
Copy-Item -Path public -Destination dist/public -Recurse

Write-Host 'Build complete!'
