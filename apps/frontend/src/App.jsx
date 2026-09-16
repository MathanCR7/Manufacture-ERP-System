import React, { useEffect } from 'react';
import AppRouter from './app/router';
import useCompanyStore from './app/store/companyStore';

function App() {
  useEffect(() => {
    useCompanyStore.getState().fetchCompany();
  }, []);

  return <AppRouter />;
}

export default App;

