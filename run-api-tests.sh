#!/bin/bash

# Test the Lead Management API

echo "Running Lead Management API Tests..."

# Start the server in the background
node server/integrated-server.js &
SERVER_PID=$!

# Wait a moment for the server to start
echo "Waiting for server to start..."
sleep 3

# Run the tests
node test-lead-api.js
TEST_RESULT=$?

# Clean up - kill the server process
kill $SERVER_PID

# Return the test result
exit $TEST_RESULT
