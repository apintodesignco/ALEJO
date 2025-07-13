Remove-Item -Recurse -Force src/accessibility
Remove-Item src/personalization/hearing/hearing-impairment-detection.js
Remove-Item src/personalization/vision/visual-impairment-detection.js
# Remove test files
Remove-Item -Recurse -Force tests/accessibility
Remove-Item tests/personalization/hearing/hearing-impairment-detection.test.js
Remove-Item tests/personalization/vision/visual-impairment-detection.test.js
