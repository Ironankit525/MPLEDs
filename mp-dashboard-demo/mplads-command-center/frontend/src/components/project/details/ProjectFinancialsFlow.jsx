import React, { useState } from 'react';
import { Card } from '../../common/Card.jsx';
import { Badge } from '../../common/Badge.jsx';
import { formatCurrency } from '../../../utils/formatCurrency.js';
import { formatDate } from '../../../utils/formatDate.js';
import { getFinancialStats } from '../../../utils/projectCalculations.js';
import { 
  Coins, 
  ArrowRight, 
  TrendingUp, 
  Receipt, 
  Search, 
  CheckCircle2, 
  Clock, 
  Building2,
  FileSpreadsheet
} from 'lucide-react';

export const ProjectFinancialsFlow = ({ financial = {} }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const stats = getFinancialStats(financial);
  const payments = financial.payments || [];

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        p.description.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <Card className="hover:border-indigo-200 transition">
      <div className="space-y-6">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Coins className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Financial Overview & Money Flow</h3>
              <p className="text-[11px] text-slate-500">Sanctioned allocation, released tranches, and contractor expenditure status.</p>
            </div>
          </div>
        </div>

        {/* 1. FINANCIAL SUMMARY METRIC TILES */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Estimated Cost</span>
            <span className="text-base sm:text-lg font-black text-slate-900 mt-0.5 block">{formatCurrency(stats.estimatedCost, true)}</span>
            <span className="text-[10px] text-slate-500 font-medium block">DPR Estimate</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Sanctioned</span>
            <span className="text-base sm:text-lg font-black text-slate-900 mt-0.5 block">{formatCurrency(stats.sanctioned, true)}</span>
            <span className="text-[10px] text-slate-500 font-medium block">MP Sanction Order</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Released</span>
            <span className="text-base sm:text-lg font-black text-slate-900 mt-0.5 block">{formatCurrency(stats.released, true)}</span>
            <span className="text-[10px] text-slate-500 font-medium block">{stats.releasePercentage}% of Sanctioned</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Utilized</span>
            <span className="text-base sm:text-lg font-black text-slate-900 mt-0.5 block">{formatCurrency(stats.utilized, true)}</span>
            <span className="text-[10px] text-slate-500 font-medium block">{stats.utilizationOfSanctioned}% Total Executed</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Unutilized Released</span>
            <span className="text-base sm:text-lg font-black text-slate-900 mt-0.5 block">{formatCurrency(stats.remainingReleased, true)}</span>
            <span className="text-[10px] text-slate-500 font-medium block">Unspent in Agency</span>
          </div>
        </div>



        {/* 3. PAYMENT & DISBURSEMENT VOUCHERS TABLE */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-500" />
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Payment & Disbursement Vouchers ({payments.length})
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search voucher, description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PROCESSING">Processing</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400">
              No matching payment vouchers found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5">Description & Purpose</th>
                    <th className="py-3 px-3.5">Milestone</th>
                    <th className="py-3 px-3.5">Reference No.</th>
                    <th className="py-3 px-3.5">Amount</th>
                    <th className="py-3 px-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3.5 text-slate-600 font-bold whitespace-nowrap">
                        {formatDate(pay.date)}
                      </td>
                      <td className="py-3 px-3.5 text-slate-900 font-bold max-w-xs">
                        {pay.description}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">
                        {pay.milestoneId || 'General'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">
                        {pay.referenceNumber || 'PFMS-PENDING'}
                      </td>
                      <td className="py-3 px-3.5 font-black text-slate-900">
                        {formatCurrency(pay.amount, true)}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <Badge variant={pay.status === 'PAID' ? 'emerald' : pay.status === 'PROCESSING' ? 'amber' : 'slate'} className="text-[10px]">
                          {pay.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
