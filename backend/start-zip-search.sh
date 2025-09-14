#!/bin/bash
# Script to start the ZIP Search API server

echo "🚀 Starting ZIP Search API server..."
cd "$(dirname "$0")"
node zip-search-server.js
