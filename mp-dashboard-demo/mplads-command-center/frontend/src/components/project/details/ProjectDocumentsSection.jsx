import React, { useState } from 'react';
import { Card } from '../../common/Card.jsx';
import { Badge } from '../../common/Badge.jsx';
import { FileText, Download, Eye, CheckCircle2, AlertCircle, FileCheck, X } from 'lucide-react';

export const ProjectDocumentsSection = ({ documents = [] }) => {
  const [previewDoc, setPreviewDoc] = useState(null);

  return (
    <Card className="hover:border-indigo-200 transition">
      <div className="space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Documents, Approvals & Statutory Sanctions</h3>
              <p className="text-[11px] text-slate-500">Official administrative sanctions, technical estimates, agreements & MB entries.</p>
            </div>
          </div>

          <span className="text-xs font-bold text-slate-500">
            {documents.length} Files Repository
          </span>
        </div>

        {/* Documents Table / List */}
        {documents.length === 0 ? (
          <p className="text-xs text-slate-400 italic p-4 text-center">No official documents uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3.5">Document Title</th>
                  <th className="py-3 px-3.5">Category</th>
                  <th className="py-3 px-3.5">Date</th>
                  <th className="py-3 px-3.5">Size</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="font-bold text-slate-900">{doc.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-slate-600 font-semibold">{doc.type}</td>
                    <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap">{doc.uploadedAt}</td>
                    <td className="py-3 px-3.5 text-slate-400 font-mono text-[11px]">{doc.fileSize || '2.4 MB'}</td>
                    <td className="py-3 px-3.5">
                      <Badge variant={doc.status === 'APPROVED' || doc.status === 'ACTIVE' || doc.status === 'VERIFIED' ? 'emerald' : 'amber'} className="text-[10px]">
                        {doc.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-600 font-bold transition flex items-center gap-1 cursor-pointer"
                          title="View Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        <button
                          onClick={() => alert(`Downloading document "${doc.name}" from secure government repository...`)}
                          className="p-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Document Preview Modal */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-extrabold text-slate-900 text-sm">{previewDoc.name}</h4>
                </div>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
                <FileText className="w-12 h-12 text-indigo-600 mx-auto" />
                <div>
                  <strong className="text-sm font-bold text-slate-900 block">{previewDoc.name}</strong>
                  <span className="text-xs text-slate-500 block mt-1">Category: {previewDoc.type} • File Size: {previewDoc.fileSize || '2.4 MB'}</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 font-mono text-left">
                  URI: {previewDoc.documentUrl || 'https://mplads.gov.in/eproc/sanction_doc.pdf'}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    alert(`Downloading ${previewDoc.name}...`);
                    setPreviewDoc(null);
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Document</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
