import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import StockAdjustmentForm from '../components/StockAdjustmentForm';

export default function StockAdjustmentAddPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state?.editData || null;

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] p-2 sm:p-4">
      <StockAdjustmentForm 
        editData={editData} 
        onBack={() => navigate('/rm/stock-adjustment/list')} 
      />
    </div>
  );
}
