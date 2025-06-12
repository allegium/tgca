# Telegram Chat Analyzer

A single-page web app for uploading Telegram chat export JSON files and visualizing key metrics.

## Requirements

- Node.js (v18 or later recommended)
- npm (comes with Node.js)
- Internet connection for the first `npm install` and for loading Chart.js from a CDN.

## Quick Start

1. Clone this repository or download it as a ZIP and extract it.
2. Open a terminal in the project directory.
3. Run `npm install` to install dependencies.
4. Start the server with `node server.js`.
5. Open `http://localhost:3000` in your browser.
6. Upload your Telegram JSON export to see the dashboard.

## Structure

- `server.js` – minimal Express server to serve files from the `public` folder.
- `public/index.html` – main web page with upload button and dashboard.
- `public/app.js` – front-end logic (data parsing, metrics, chart creation).
- `public/style.css` – simple responsive styles.

