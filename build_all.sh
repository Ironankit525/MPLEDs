#!/bin/bash
set -e

echo "Building all frontends for Vercel deployment..."

rm -rf dist
mkdir -p dist

echo "Building Auth Portal..."
cd auth-portal
npm install
npm run build
cd ..
cp -r auth-portal/dist/* dist/

echo "Building SIH Frontend (Admin)..."
cd "SIH frontend"
npm install
npm run build
cd ..
mkdir -p dist/admin
cp -r "SIH frontend/dist/"* dist/admin/

echo "Building Contractor Dashboard..."
cd contractor-dashboard-demo
npm install
npm run build
cd ..
mkdir -p dist/contractor
cp -r contractor-dashboard-demo/dist/* dist/contractor/

echo "Building MP Dashboard..."
cd mp-dashboard-demo/mplads-command-center/frontend
npm install
npm run build
cd ../../../
mkdir -p dist/mp
cp -r mp-dashboard-demo/mplads-command-center/frontend/dist/* dist/mp/

echo "Building Original Frontend..."
cd frontend
npm install
npm run build
cd ..
mkdir -p dist/original
cp -r frontend/dist/* dist/original/

echo "All frontends built and consolidated into ./dist successfully!"
