#!/bin/bash

# Start FastAPI backend
echo "Starting FastAPI Backend on port 8000..."
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start Auth Portal (Port 3000)
echo "Starting Auth Portal on port 3000..."
cd auth-portal
npm run dev -- --port 3000 &
cd ..

# Start SIH frontend (Admin, Port 5173)
echo "Starting SIH frontend (Admin) on port 5173..."
cd "sih-frontend"
npm run dev -- --port 5173 &
ADMIN_PID=$!
cd ..

# Start Contractor Dashboard (Port 5174)
echo "Starting Contractor Dashboard on port 5174..."
cd contractor-dashboard-demo
npm run dev -- --port 5174 &
cd ..

# Start MP Dashboard (Port 5175)
echo "Starting MP Dashboard on port 5175..."
cd mp-dashboard-demo/mplads-command-center/frontend
npm run dev -- --port 5175 &
cd ../../../..

echo "All services started! Access the unified Auth Portal at http://localhost:3000"
wait
