import React from 'react';
import { useParams } from 'react-router-dom';
import StockForecastingPage from './StockForecastingPage';
import WorkforceForecastingPage from './WorkforceForecastingPage';
import CashFlowForecastingPage from './CashFlowForecastingPage';
import VendorForecastingPage from './VendorForecastingPage';
import ProductionYieldForecastingPage from './ProductionYieldForecastingPage';
import WhatIfForecastingPage from './WhatIfForecastingPage';
import ReturnsForecastingPage from './ReturnsForecastingPage';

export default function PredictiveForecastingHubPage() {
  const { section } = useParams();

  switch (section) {
    case 'workforce':
      return <WorkforceForecastingPage />;
    case 'cashflow':
      return <CashFlowForecastingPage />;
    case 'vendor':
      return <VendorForecastingPage />;
    case 'production':
      return <ProductionYieldForecastingPage />;
    case 'what-if':
    case 'whatif':
      return <WhatIfForecastingPage />;
    case 'returns':
      return <ReturnsForecastingPage />;
    case 'stock':
    case 'inventory':
    default:
      return <StockForecastingPage />;
  }
}
