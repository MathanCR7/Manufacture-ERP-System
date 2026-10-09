import React from 'react';
import { useNavigate } from 'react-router-dom';
import ProductStockAdjustmentForm from '../components/ProductStockAdjustmentForm';

export default function ProductStockAdjustmentAddPage() {
  const navigate = useNavigate();
  return (
    <ProductStockAdjustmentForm 
      onBack={() => navigate('/products/stock-adjustment/list')} 
    />
  );
}
