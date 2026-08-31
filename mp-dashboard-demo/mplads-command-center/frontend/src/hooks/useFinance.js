import { useState, useEffect, useCallback } from 'react';
import { financeService } from '../features/finance/financeService.js';
import { useAuth } from './useAuth.js';
import { useUser } from './useUser.js';
import { handleServiceError } from '../utils/errorHandler.js';

export const useFinance = () => {
  const { currentMP } = useAuth();
  const { financialYear } = useUser();

  const [fundSummary, setFundSummary] = useState(null);
  const [expenditures, setExpenditures] = useState([]);
  const [sectorAllocation, setSectorAllocation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFinanceData = useCallback(async () => {
    if (!currentMP?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryData, expData, sectorData] = await Promise.all([
        financeService.getFundSummary(currentMP.id, financialYear),
        financeService.getExpenditure(currentMP.id),
        financeService.getSectorAllocation(currentMP.id, financialYear)
      ]);

      setFundSummary(summaryData);
      setExpenditures(expData);
      setSectorAllocation(sectorData);
    } catch (err) {
      setError(handleServiceError(err, 'Failed to load financial telemetry'));
    } finally {
      setLoading(false);
    }
  }, [currentMP?.id, financialYear]);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  return {
    fundSummary,
    expenditures,
    sectorAllocation,
    loading,
    error,
    refresh: fetchFinanceData
  };
};
