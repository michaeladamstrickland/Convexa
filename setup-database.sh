# Setup Lead Management System Database
echo "Setting up FlipTracker Lead Management Database..."

# Ensure dependencies are installed
npm install sqlite3 better-sqlite3 --save

# Ensure the data directory exists
mkdir -p ./data

# Change to the server directory
cd "$(dirname "$0")/server"

# Run the database initialization
node database.js --init

echo "✅ Database setup complete!"
echo "✅ You can now start the server with ./start-server.sh"
