import React, { createContext, useState } from 'react';
import { DEFAULT_FINANCIAL_YEAR } from '../constants/financialYears';

export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [financialYear, setFinancialYear] = useState(DEFAULT_FINANCIAL_YEAR);

  return (
    <UserContext.Provider
      value={{
        financialYear,
        setFinancialYear,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
