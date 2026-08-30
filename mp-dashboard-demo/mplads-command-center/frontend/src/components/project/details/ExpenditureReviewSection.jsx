import React, { useState } from 'react';
import { Card } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { formatCurrency } from '../../../utils/formatCurrency';
import { 
  ReceiptText, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Info, 
  X, 
  Layers, 
  TrendingUp 
} from 'lucide-react';

export const ExpenditureReviewSection = ({ expenditureReview = {} }) => {
  const [activeVarianceModal, setActiveVarianceModal] = useState(false);

  const categories = expenditureReview.categories || [];
  const aiCost = expenditureReview.aiCostReview || {};
  const varianceItem = aiCost.varianceItem;

  return (
    <>
      <Card className="hover:border-indigo-200 transition">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <ReceiptText className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Project Expenditure & Cost Review</h3>
                <p className="text-[11px] text-slate-500">Itemized utilization categories validated against district schedule of rates benchmark.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{aiCost.verifiedCount || 4} Verified</span>
              </span>

              {(aiCost.reviewCount || 0) > 0 && (
                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>{aiCost.reviewCount} Requires Review</span>
                </span>
              )}
            </div>
          </div>

          {/* Category Expenditure Progress Bars */}
          <div className="space-y-3">
            {categories.map((cat, idx) => {
              const isVerified = cat.status === 'VERIFIED';

              return (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 hover:bg-slate-100/70 transition">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{cat.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 border ${
                          isVerified
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        {isVerified ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Verified</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Requires Review</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 font-medium">{formatCurrency(cat.amount, true)}</span>
                      <span className="font-extrabold text-slate-900">{cat.percentage}%</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-slate-900 h-full rounded-full transition-all duration-300"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI Cost Review Banner */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-extrabold text-slate-900 block">
                  AI Cost Review: 1 Expense Item Requires Verification
                </strong>
                <p className="text-slate-600 font-medium mt-0.5 leading-relaxed">
                  {aiCost.summary || 'Claimed electrical infrastructure rate exceeds standard reference rates.'}
                </p>
              </div>
            </div>

            {varianceItem && (
              <button
                onClick={() => setActiveVarianceModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs"
              >
                <span>Review Cost Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Variance Modal Details */}
      {activeVarianceModal && varianceItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h4 className="font-extrabold text-slate-900 text-sm">Cost Variance Analysis</h4>
              </div>
              <button
                onClick={() => setActiveVarianceModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-slate-400 block font-semibold text-[11px] uppercase tracking-wider">Item Name</span>
                <strong className="text-slate-900 text-sm block leading-snug">{varianceItem.item}</strong>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block font-semibold text-[10px] uppercase">Claimed Rate</span>
                  <strong className="text-slate-900 text-sm font-black mt-0.5 block">{formatCurrency(varianceItem.claimedAmount, true)}</strong>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block font-semibold text-[10px] uppercase">Benchmark</span>
                  <strong className="text-slate-900 text-sm font-black mt-0.5 block">{formatCurrency(varianceItem.benchmarkAmount, true)}</strong>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block font-semibold text-[10px] uppercase">Difference</span>
                  <strong className="text-slate-900 text-sm font-black mt-0.5 block">+{varianceItem.variancePercentage}%</strong>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-extrabold block text-slate-900">AI Analysis Observation:</span>
                <p className="font-medium text-slate-700 leading-relaxed">{varianceItem.explanation}</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-extrabold block text-slate-900">Recommended Action for MP:</span>
                <p className="font-medium text-slate-700 leading-relaxed">{varianceItem.recommendation}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setActiveVarianceModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
