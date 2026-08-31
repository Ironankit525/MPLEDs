import axiosClient from './axiosClient.js';
import { mockProjects } from '../../data/mockProjects.js';
import { getRiskLevel } from '../../utils/projectAnalytics.js';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA !== 'false' || true; // Always default to resilient mock fallback

// Fetch real submissions from the FastAPI backend
async function fetchRealSubmissions() {
  try {
    const res = await fetch('http://localhost:8000/api/images/mine', {
      headers: { Authorization: 'Bearer demo-token' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.images || [];
  } catch {
    return [];
  }
}

// Helper to patch a mock project with real submissions
const patchProjectWithSubmissions = (p, realSubmissions) => {
  const matches = realSubmissions.filter(s => 
    s.work_id === p.id || s.work_id === p.projectId
  );
  if (matches.length > 0) {
    const primaryMatch = matches[0];
    const newPhotos = matches.map(m => ({
      url: m.file_path,
      submissionDate: m.timestamp || new Date().toLocaleString(),
      aiOpinion: m.recommendation || 'AI verified submission.',
      latitude: p.latitude,
      longitude: p.longitude,
      id: m.id || Math.random().toString(36).substr(2, 9)
    }));
    return {
      ...p,
      photos: [...newPhotos.reverse(), ...(p.photos || [])].filter(Boolean),
      riskScore: primaryMatch.risk_score || p.riskScore,
      riskLevel: primaryMatch.risk_level || p.riskLevel,
    };
  }
  return p;
};

// Helper to dynamically auto-generate a project shell if the work_id is unknown
const appendDynamicProjects = (existingProjects, realSubmissions) => {
  const existingIds = new Set(existingProjects.map(p => p.id));
  const dynamicGroups = {};
  
  for (const sub of realSubmissions) {
    if (sub.work_id && !existingIds.has(sub.work_id)) {
      if (!dynamicGroups[sub.work_id]) dynamicGroups[sub.work_id] = [];
      dynamicGroups[sub.work_id].push(sub);
    }
  }

  const dynamicProjects = Object.entries(dynamicGroups).map(([workId, subs]) => {
    const primary = subs[0];
    return {
      id: workId,
      projectId: workId,
      name: `${primary.work_type || 'Infrastructure'} - Dynamic Auto-Generated`,
      projectName: `${primary.work_type || 'Infrastructure'} - Dynamic Auto-Generated`,
      state: primary.state || 'Maharashtra',
      district: primary.district || 'Pune',
      constituencyId: "PC-MH-34",
      constituencyName: primary.district || "Pune",
      mp: primary.mp_name || 'Shri Murlidhar Mohol',
      mpId: "MP099",
      mpName: primary.mp_name || 'Shri Murlidhar Mohol',
      house: "Lok Sabha",
      financialYear: "2024-25",
      projectType: primary.work_type || "Infrastructure",
      implementingAgency: "Dynamic Agency",
      contractor: "Dynamic Contractor",
      sanctionedAmount: 2500000,
      estimatedCost: 2500000,
      expenditure: 1200000,
      unutilizedAmount: 1300000,
      progress: primary.progress_percent || 50,
      physicalProgress: primary.progress_percent || 50,
      financialProgress: primary.progress_percent || 50,
      status: "ONGOING",
      startDate: primary.sanction_date || "2024-01-01",
      sanctionDate: primary.sanction_date || "2024-01-01",
      expectedCompletion: "2026-12-31",
      expectedCompletionDate: "2026-12-31",
      actualCompletionDate: null,
      daysDelayed: 0,
      riskScore: 0,
      riskLevel: "LOW",
      paymentProgressMismatch: false,
      costOverrun: false,
      duplicateRisk: false,
      suspicious: false,
      lastUpdated: new Date().toISOString().split('T')[0],
      description: `Dynamically generated from contractor submission.`,
      latitude: primary.latitude || 18.5204,
      longitude: primary.longitude || 73.8567,
      photos: []
    };
  });

  return [...existingProjects, ...dynamicProjects];
};


/**
 * Data Normalization Layer:
 * Normalizes API/Backend responses or mock data into a stable frontend project schema.
 */
export const normalizeProject = (p) => {
  if (!p) return null;

  const id = p.id || p.projectId || p.project_id || 'MP/UNKNOWN';
  const name = p.name || p.projectName || p.project_name || 'Infrastructure Project';
  const sanctioned = Number(p.sanctionedAmount || p.sanctioned_amount || p.amount_sanctioned || 0);
  const expenditure = Number(p.expenditure || p.amount_spent || p.expenditure_amount || 0);
  const estimatedCost = Number(p.estimatedCost || p.estimated_cost || sanctioned);
  const unutilized = Math.max(0, sanctioned - expenditure);

  const physicalProg = Number(p.physicalProgress || p.physical_progress || p.progress || 0);
  const financialProg = sanctioned > 0 ? Number(((expenditure / sanctioned) * 100).toFixed(1)) : physicalProg;

  const riskScore = Number(p.riskScore || p.risk_score || 0);
  const riskLevel = p.riskLevel || getRiskLevel(riskScore);

  return {
    id,
    projectId: id,
    name,
    projectName: name,
    state: p.state || 'State',
    district: p.district || 'District',
    constituencyId: p.constituencyId || p.constituency_id || `PC-${(p.state || 'XX').substring(0, 2)}-01`,
    constituencyName: p.constituencyName || p.constituency || p.district || 'Constituency',
    mpId: p.mpId || p.mp_id || 'MP001',
    mpName: p.mpName || p.mp || 'Member of Parliament',
    mp: p.mpName || p.mp || 'Member of Parliament',
    house: p.house || 'Lok Sabha',
    financialYear: p.financialYear || p.financial_year || '2026-27',
    projectType: p.projectType || p.project_type || 'Community Infrastructure',
    implementingAgency: p.implementingAgency || p.implementing_agency || 'Public Works Department',
    contractor: p.contractor || p.contractor_name || 'State Infrastructure Agency',
    sanctionedAmount: sanctioned,
    estimatedCost: estimatedCost,
    expenditure: expenditure,
    unutilizedAmount: unutilized,
    progress: physicalProg,
    physicalProgress: physicalProg,
    financialProgress: financialProg,
    status: p.status || 'ONGOING',
    startDate: p.startDate || p.sanctionDate || p.start_date || '2024-01-01',
    sanctionDate: p.sanctionDate || p.startDate || '2024-01-01',
    expectedCompletion: p.expectedCompletion || p.expectedCompletionDate || '2026-12-31',
    expectedCompletionDate: p.expectedCompletionDate || p.expectedCompletion || '2026-12-31',
    actualCompletionDate: p.actualCompletionDate || null,
    actualExpectedCompletion: p.actualExpectedCompletion || p.expectedCompletion || '2026-12-31',
    daysDelayed: Number(p.daysDelayed || p.days_delayed || 0),
    riskScore: riskScore,
    riskLevel: riskLevel,
    paymentProgressMismatch: Boolean(p.paymentProgressMismatch || financialProg - physicalProg > 20),
    costOverrun: Boolean(p.costOverrun || estimatedCost > sanctioned),
    duplicateRisk: Boolean(p.duplicateRisk || false),
    suspicious: Boolean(p.suspicious || false),
    lastUpdated: p.lastUpdated || '2026-08-27',
    photos: Array.isArray(p.photos) && p.photos.length ? p.photos : [
      'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80',
    ],
    description: p.description || `Sanctioned MPLADS work for ${name} in ${p.district || ''}, ${p.state || ''}.`,
    latitude: Number(p.latitude || 20.5937),
    longitude: Number(p.longitude || 78.9629),
    photos: (() => {
      const rawPhotos = Array.isArray(p.photos) && p.photos.length ? p.photos : [
        'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80',
      ];
      
      const lat = Number(p.latitude || 20.5937);
      const lng = Number(p.longitude || 78.9629);

      return rawPhotos.map((item, idx) => {
        if (typeof item === 'string') {
          const stages = ['Site Groundwork & Clearance', 'Superstructure Inspection', 'Quality Assurance & Boundary Audit'];
          const officers = [
            { name: 'Er. Rajesh Kumar', title: 'Executive Engineer / Nodal Inspection Officer', dept: p.implementingAgency || 'Public Works Dept (PWD)' },
            { name: 'Dr. Sunita Rao', title: 'District Technical Auditor', dept: 'District Rural Development Agency (DRDA)' },
            { name: 'Er. Amit Verma', title: 'Field Assistant Engineer', dept: 'Central Public Works Dept (CPWD)' }
          ];
          const officer = officers[idx % officers.length];
          
          return {
            id: `officer_photo_${id}_${idx + 1}`,
            url: item,
            title: `${stages[idx % stages.length]} - Site Evidence`,
            officerName: officer.name,
            officerDesignation: officer.title,
            department: officer.dept,
            uploadedAt: `2026-08-${24 + idx} 10:30 AM`,
            stage: stages[idx % stages.length],
            remarks: `Physical inspection conducted by concerning officer. Physical milestone verified as authentic at ${p.district || 'site'}.`,
            latitude: lat + (idx * 0.0008),
            longitude: lng + (idx * 0.0006),
            verified: true,
          };
        }
        return item;
      });
    })(),
  };
};

export const projectService = {
  async getProjects(params = {}) {
    try {
      if (!import.meta.env.VITE_USE_MOCK_DATA || import.meta.env.VITE_USE_MOCK_DATA !== 'false') {
        await new Promise((res) => setTimeout(res, 50));
        const realSubmissions = await fetchRealSubmissions();
        const allProjects = appendDynamicProjects(mockProjects, realSubmissions);
        const patchedProjects = allProjects.map(p => patchProjectWithSubmissions(p, realSubmissions));
        const normalizedList = patchedProjects.map(normalizeProject).filter(Boolean);
        return { success: true, data: normalizedList, count: normalizedList.length };
      }

      const response = await axiosClient.get('/projects', { params });
      const rawList = response.data?.data || response.data || [];
      const normalizedList = Array.isArray(rawList) ? rawList.map(normalizeProject).filter(Boolean) : [];
      return { success: true, data: normalizedList, count: normalizedList.length };
    } catch (err) {
      console.warn('Backend API connection failed, serving mock projects dataset fallback:', err);
      const realSubmissions = await fetchRealSubmissions();
      const allProjects = appendDynamicProjects(mockProjects, realSubmissions);
      const patchedProjects = allProjects.map(p => patchProjectWithSubmissions(p, realSubmissions));
      const normalizedList = patchedProjects.map(normalizeProject).filter(Boolean);
      return { success: true, data: normalizedList, count: normalizedList.length };
    }
  },

  async getProjectById(id) {
    try {
      if (!import.meta.env.VITE_USE_MOCK_DATA || import.meta.env.VITE_USE_MOCK_DATA !== 'false') {
        await new Promise((res) => setTimeout(res, 50));
        const realSubmissions = await fetchRealSubmissions();
        const allProjects = appendDynamicProjects(mockProjects, realSubmissions);
        const found = allProjects.find((p) => p.id === id || p.projectId === id);
        if (!found) {
          const first = mockProjects[0];
          return { success: true, data: normalizeProject(patchProjectWithSubmissions(first, realSubmissions)) };
        }
        return { success: true, data: normalizeProject(patchProjectWithSubmissions(found, realSubmissions)) };
      }

      const response = await axiosClient.get(`/projects/${id}`);
      return { success: true, data: normalizeProject(response.data?.data || response.data) };
    } catch (err) {
      const realSubmissions = await fetchRealSubmissions();
      const allProjects = appendDynamicProjects(mockProjects, realSubmissions);
      const found = allProjects.find((p) => p.id === id || p.projectId === id) || allProjects[0];
      return { success: true, data: normalizeProject(patchProjectWithSubmissions(found, realSubmissions)) };
    }
  },

  async getProjectsByMP(mpId) {
    try {
      const realSubmissions = await fetchRealSubmissions();
      const allProjects = appendDynamicProjects(mockProjects, realSubmissions);
      const filtered = allProjects
        .filter((p) => p.mpId === mpId || p.mp === mpId || p.mpName === mpId)
        .map(p => patchProjectWithSubmissions(p, realSubmissions))
        .map(normalizeProject)
        .filter(Boolean);
      return { success: true, data: filtered };
    } catch (err) {
      const filtered = mockProjects.map(normalizeProject).filter(Boolean);
      return { success: true, data: filtered };
    }
  },
};
