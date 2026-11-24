import { jsPDF } from 'jspdf';
import { formatProductFullName, computeCategoryBifurcation } from './apps/frontend/src/utils/salesPdfGenerator.js';

const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
doc.setFont('helvetica', 'normal');
doc.setFontSize(6.5);

const items = [
  { productCode: 'BG101', subcategoryName: 'Classic Cream Gallon', productName: 'Vanilla', categoryName: 'Gallon', quantity: 20, uomName: 'Ltr' },
  { productCode: 'BG102', subcategoryName: 'Classic Cream Gallon', productName: 'STRAWBERRY', categoryName: 'Gallon', quantity: 17, uomName: 'Ltr' },
  { productCode: 'BG301', subcategoryName: 'Fruit Blend Gallon', productName: 'Alphonso Mango', categoryName: 'Gallon', quantity: 2, uomName: 'Ltr' },
  { productCode: 'BG109', subcategoryName: 'Classic Cream Gallon', productName: 'Pista', categoryName: 'Gallon', quantity: 1, uomName: 'Ltr' }
];

items.forEach((it, idx) => {
  const { fullName } = formatProductFullName(it);
  const lines = doc.splitTextToSize(fullName, 43);
  console.log(`Item ${idx+1}: "${fullName}" -> ${lines.length} lines:`, lines);
});
