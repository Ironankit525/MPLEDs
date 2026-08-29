import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const DEFAULT_WORKS = [
  {
    id: 'WRK-2026-001',
    title: 'Installation of Solar LED Street Lights',
    district: 'Nagpur',
    workType: 'Electrical',
    allocatedAmount: 1500000,
    status: 'IN_REVIEW',
    riskLevel: 'LOW',
    lastUpdated: '2026-08-25',
  },
  {
    id: 'WRK-2026-002',
    title: 'Constructing Primary School Boundary Wall',
    district: 'Pune',
    workType: 'Civil Infrastructure',
    allocatedAmount: 2000000,
    status: 'FLAGGED',
    riskLevel: 'HIGH',
    lastUpdated: '2026-08-28',
  },
  {
    id: 'WRK-2026-003',
    title: 'Supply and Setup of Community RO Water Plant',
    district: 'Nashik',
    workType: 'Sanitation & Water',
    allocatedAmount: 850000,
    status: 'APPROVED',
    riskLevel: 'LOW',
    lastUpdated: '2026-08-20',
  },
  {
    id: 'WRK-2026-004',
    title: 'Repairs to Gram Panchayat Building Roof',
    district: 'Amravati',
    workType: 'Civil Repairs',
    allocatedAmount: 450000,
    status: 'PENDING_REVIEW',
    riskLevel: 'MEDIUM',
    lastUpdated: '2026-08-27',
  },
];

const STATUS_BADGES = {
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  IN_REVIEW: 'bg-blue-100 text-blue-800 border-blue-200',
  PENDING_REVIEW: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  FLAGGED: 'bg-red-100 text-red-800 border-red-200',
  REJECTED: 'bg-gray-100 text-gray-800 border-gray-200',
};

const RISK_BADGES = {
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function WorksTable({ works = DEFAULT_WORKS }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const filteredWorks = works.filter((work) => {
    const matchesSearch =
      work.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      work.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      work.district.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      selectedStatus === 'ALL' || work.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      {/* Table Header & Toolbar */}
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Works & Projects</h3>
          <p className="text-xs text-gray-500">
            Overview of registered work orders and current audit statuses
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by ID, title, district..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
          />

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="PENDING_REVIEW">Pending</option>
            <option value="FLAGGED">Flagged</option>
          </select>
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
              <th className="py-3 px-4">Work ID & Title</th>
              <th className="py-3 px-4">District / Type</th>
              <th className="py-3 px-4">Allocated Amount</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Risk Level</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {filteredWorks.length > 0 ? (
              filteredWorks.map((work) => (
                <tr key={work.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-gray-900">{work.id}</div>
                    <div className="text-xs text-gray-500 truncate max-w-xs">
                      {work.title}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-gray-900">{work.district}</div>
                    <div className="text-xs text-gray-500">{work.workType}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-800">
                    ₹{work.allocatedAmount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        STATUS_BADGES[work.status] || STATUS_BADGES.PENDING_REVIEW
                      }`}
                    >
                      {work.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${
                        RISK_BADGES[work.riskLevel] || RISK_BADGES.LOW
                      }`}
                    >
                      {work.riskLevel}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      to={`/app/works/${work.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs hover:underline"
                    >
                      View Details →
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="py-6 text-center text-gray-500 text-sm">
                  No matching works found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3 border-t border-gray-200 bg-slate-50 flex justify-between items-center text-xs text-gray-500">
        <span>Showing {filteredWorks.length} of {works.length} entries</span>
        <span>Updated: {new Date().toLocaleDateString()}</span>
      </div>
    </div>
  );
}