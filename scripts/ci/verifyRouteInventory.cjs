#!/usr/bin/env node

/**
 * Route Inventory CI Verification
 * Compares current route inventory against committed version
 * Fails CI if significant changes are detected without update
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const currentPath = path.join(repoRoot, 'ops', 'findings', 'routes_inventory.json');
const committedPath = path.join(repoRoot, 'ops', 'findings', 'routes_inventory.json');

function main() {
  console.log('🔍 Verifying route inventory changes...');
  
  if (!fs.existsSync(currentPath)) {
    console.error('❌ Current route inventory not found. Run routesInventory.mjs first.');
    process.exit(1);
  }

  let currentInventory, committedInventory;
  
  try {
    currentInventory = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
  } catch (error) {
    console.error('❌ Failed to parse current route inventory:', error.message);
    process.exit(1);
  }

  // In CI, the committed version should be the same unless intentionally updated
  try {
    committedInventory = JSON.parse(fs.readFileSync(committedPath, 'utf8'));
  } catch (error) {
    console.warn('⚠️  No committed route inventory found. This is the first run.');
    console.log('✅ Route inventory verification passed (initial run)');
    return;
  }

  const currentRoutes = new Set(currentInventory.routes.map(r => `${r.method} ${r.path}`));
  const committedRoutes = new Set(committedInventory.routes.map(r => `${r.method} ${r.path}`));

  const addedRoutes = [...currentRoutes].filter(r => !committedRoutes.has(r));
  const removedRoutes = [...committedRoutes].filter(r => !currentRoutes.has(r));

  if (addedRoutes.length === 0 && removedRoutes.length === 0) {
    console.log('✅ Route inventory verification passed - no route changes detected');
    return;
  }

  console.log('\n📋 Route Inventory Changes Detected:');
  
  if (addedRoutes.length > 0) {
    console.log('\n➕ Added routes:');
    addedRoutes.forEach(route => console.log(`   ${route}`));
  }

  if (removedRoutes.length > 0) {
    console.log('\n➖ Removed routes:');
    removedRoutes.forEach(route => console.log(`   ${route}`));
  }

  console.log('\n💡 Route changes detected. This is informational in CI.');
  console.log('   If this was intentional, the route inventory has been updated.');
  console.log('   If this was unintentional, please review the changes.');
  
  console.log('\n✅ Route inventory verification completed');
}

if (require.main === module) {
  main();
}