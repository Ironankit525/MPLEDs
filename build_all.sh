#!/bin/bash
set -ex

echo "Building all frontends for Vercel deployment..."

rm -rf unified_dist
mkdir -p unified_dist

echo "Building Auth Portal..."
cd auth-portal
npm install
npm run build
cd ..
cp -r auth-portal/dist/* unified_dist/
rm -rf auth-portal/node_modules

echo "Building SIH Frontend (Admin)..."
cd "sih-frontend"
npm install
VITE_USE_MOCK_DATA=true npm run build
cd ..

# Move Admin Build
echo "Moving Admin dist..."
mkdir -p unified_dist/admin
cp -r "sih-frontend/dist/"* unified_dist/admin/
rm -rf "sih-frontend/node_modules"

echo "Building Contractor Dashboard..."
cd contractor-dashboard-demo
npm install
npm run build
cd ..
mkdir -p unified_dist/contractor
cp -r contractor-dashboard-demo/dist/* unified_dist/contractor/
rm -rf contractor-dashboard-demo/node_modules

echo "Building MP Dashboard..."
cd mp-dashboard-demo/mplads-command-center/frontend
npm install
npm run build
cd ../../../
mkdir -p unified_dist/mp
cp -r mp-dashboard-demo/mplads-command-center/frontend/dist/* unified_dist/mp/
rm -rf mp-dashboard-demo/mplads-command-center/frontend/node_modules

echo "Building Original Frontend..."
cd frontend
npm install
npm run build
cd ..
mkdir -p unified_dist/original
cp -r frontend/dist/* unified_dist/original/
rm -rf frontend/node_modules

echo "All frontends built and consolidated into ./unified_dist successfully!"
