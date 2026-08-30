import React from 'react'
import { ArrowRight, CornerDownRight, Check, Plus, Clock, AlertCircle } from 'lucide-react'

/**
 * Connected Node / Flowchart diagram for MPLADS Fund Flow
 */
export default function FundFlowChart({
  allocated = '₹ 38,00,000',
  released = '₹ 34,00,000',
  expenditure = '₹ 31,16,000',
  unutilized = '₹ 6,84,000',
  pendingBills = '₹ 2,15,000',
}) {
  return (
    <div className="fund-flow-container">
      {/* Top Stream: Allocated -> Released -> Expenditure */}
      <div className="fund-flow-main-row">
        {/* Step 1: Allocated */}
        <div className="fund-node node-allocated">
          <div className="node-badge-row">
            <span className="node-tag">Allocated</span>
            <span className="node-icon-pill plus-pill">
              <Plus size={10} />
            </span>
          </div>
          <div className="node-amount">{allocated}</div>
        </div>

        <div className="flow-arrow">
          <ArrowRight size={16} className="arrow-svg" />
        </div>

        {/* Step 2: Released */}
        <div className="fund-node node-released">
          <div className="node-badge-row">
            <span className="node-tag">Released</span>
            <span className="node-icon-pill check-pill">
              <Check size={10} />
            </span>
          </div>
          <div className="node-amount">{released}</div>
        </div>

        <div className="flow-arrow">
          <ArrowRight size={16} className="arrow-svg" />
        </div>

        {/* Step 3: Expenditure */}
        <div className="fund-node node-expenditure">
          <div className="node-badge-row">
            <span className="node-tag">Expenditure</span>
            <span className="node-icon-pill green-pill">
              <Check size={10} />
            </span>
          </div>
          <div className="node-amount">{expenditure}</div>
        </div>
      </div>

      {/* Branching Connectors & Bottom Nodes */}
      <div className="fund-flow-branch-row">
        {/* Left Branch: Unutilized */}
        <div className="branch-group branch-unutilized">
          <div className="branch-line-vertical"></div>
          <div className="fund-node node-unutilized">
            <div className="node-tag amber-text">Unutilized</div>
            <div className="node-amount">{unutilized}</div>
          </div>
        </div>

        {/* Right Branch: Pending Bills */}
        <div className="branch-group branch-pending">
          <div className="branch-line-vertical"></div>
          <div className="fund-node node-pending">
            <div className="node-tag purple-text">Pending Bills</div>
            <div className="node-amount">{pendingBills}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
