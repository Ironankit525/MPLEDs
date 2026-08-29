import { useState, useEffect } from "react";

export function useFinancialMetrics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/submitter/financials", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        // fallback dummy data
        setData({
          total_allocated: 100000,
          utilised: 72000,
          remaining: 28000,
          on_hold: 0,
          pending_disbursement: 0,
        });
        setLoading(false);
        setError(err);
      });
  }, []);

  return { data, loading, error };
}
