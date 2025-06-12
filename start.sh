#!/bin/sh
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi
node server.js
