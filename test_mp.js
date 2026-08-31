import fs from 'fs';
const mockData = fs.readFileSync('SIH frontend/src/data/mockProjects.js', 'utf8');
const analyticsData = fs.readFileSync('SIH frontend/src/utils/projectAnalytics.js', 'utf8');

const mpIds = [...mockData.matchAll(/"mpId":\s*"([^"]+)"/g)].map(m => m[1]);
const uniqueMpIds = [...new Set(mpIds)];
console.log("Unique MP IDs in mockProjects.js:", uniqueMpIds);

const missing = [];
for (const id of uniqueMpIds) {
    if (!analyticsData.includes(`mpId: "${id}"`)) {
        missing.push(id);
    }
}
console.log("Missing from MASTER_MP_RECORDS:", missing);
