import { useState, useEffect } from "react";

export function useKpiMetrics() {
  return {
    data: {
      totalSubmissions: 0,
      actionRequired: 0,
      pendingWithReviewer: { count: 0, avgDays: 0 },
      approvalRate: 0,
      flagged: 0,
      avgTurnaround: "0h",
      trustRating: "A+",
    },
    loading: false,
    error: null,
  };
}