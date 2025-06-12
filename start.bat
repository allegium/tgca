@echo off
if not exist node_modules (
  echo Installing dependencies...
  npm install
)
node server.js
pause
