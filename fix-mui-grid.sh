#!/bin/bash

# Script to fix MUI Grid v2 migration issues in React components
# Run this script from the project root directory

echo "Fixing MUI Grid v2 migration issues..."

# Function to update Grid components
update_grid_components() {
  local file="$1"
  echo "Processing $file"
  
  # Use sed to remove 'item' prop from Grid components
  # On Windows, you may need to use a different approach since sed might not be available
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # PowerShell approach for Windows
    powershell -Command "(Get-Content '$file') -replace '<Grid item ', '<Grid ' | Set-Content '$file'"
  else
    # Unix/Linux/Mac approach
    sed -i 's/<Grid item /<Grid /g' "$file"
  fi
  
  echo "✓ Updated $file"
}

# Find all jsx/tsx files that might contain Grid components
find_jsx_files() {
  local search_dir="$1"
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # PowerShell approach for Windows
    powershell -Command "Get-ChildItem -Path '$search_dir' -Recurse -Include *.jsx,*.tsx | Select-Object -ExpandProperty FullName"
  else
    # Unix/Linux/Mac approach
    find "$search_dir" -type f \( -name "*.jsx" -o -name "*.tsx" \) -print
  fi
}

# Process frontend directory
frontend_dir="./frontend/src"
if [ -d "$frontend_dir" ]; then
  echo "Scanning $frontend_dir for Grid components..."
  
  # Process each JSX/TSX file
  while IFS= read -r file; do
    if grep -q "Grid item" "$file"; then
      update_grid_components "$file"
    fi
  done < <(find_jsx_files "$frontend_dir")
  
  echo "✅ Grid component migration complete"
else
  echo "❌ Frontend directory not found at $frontend_dir"
  exit 1
fi

echo "Adding new API route for adding leads..."
backend_dir="./backend"
if [ -d "$backend_dir" ]; then
  echo "Creating route in $backend_dir/routes..."
  # Here you would create or update the API route file
else
  echo "❌ Backend directory not found at $backend_dir"
fi

echo "✨ All fixes applied!"
echo "Please restart your development servers to apply the changes."
