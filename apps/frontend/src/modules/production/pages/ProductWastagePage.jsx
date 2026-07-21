import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Package, Search, Trash2, Edit, Plus, FileText, Calendar, 
  AlertTriangle, CheckCircle, X, ChevronRight, RefreshCw, BarChart2 
} from 'lucide-react';
import useAuthStore from '@/app/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/Pagination';
import DatePicker from '@/components/ui/DatePicker';

export default function ProductWastagePage() {
  const user = useAuthStore(s => s.user);
  const canEdit = user?.role === 'MAIN_MASTER';

  const [wastages, setWastages] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedWastageId, setSelectedWastageId] = useState(null);
  
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedProductStock, setSelectedProductStock] = useState(0);
  const [selectedProductUnit, setSelectedProductUnit] = useState('pcs');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // Custom Premium Alert Notification state
  const [alertConfig, setAlertConfig] = useState({
    show: false,
    type: 'success', // 'success' | 'error' | 'warning'
    title: '',
    message: ''
  });

  const triggerAlert = (type, title, message) => {
    setAlertConfig({
      show: true,
      type,
      title,
      message
    });
    // Auto close after 5 seconds
    setTimeout(() => {
      setAlertConfig(prev => ({ ...prev, show: false }));
    }, 5000);
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products/stock');
      setProducts(res.data || []);
    } catch (e) {
      console.error(e);
      triggerAlert('error', 'Error', 'Failed to fetch product stock details.');
    }
  };

  const fetchWastages = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products/wastage');
      setWastages(res.data || []);
    } catch (e) {
      console.error(e);
      triggerAlert('error', 'Error', 'Failed to load product wastage records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchWastages();
  }, []);

  // Reset page to 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Update selected product current stock when product is chosen
  useEffect(() => {
    if (selectedProductId) {
      const prod = products.find(p => p.id === selectedProductId);
      if (prod) {
        // If we are editing, we must add back the currently logged wastage quantity to show the true available stock
        let availableStock = Number(prod.currentStock || 0);
        if (isEdit && selectedWastageId) {
          const currentWastage = wastages.find(w => w.id === selectedWastageId);
          if (currentWastage && currentWastage.productId === selectedProductId) {
            availableStock += Number(currentWastage.quantity || 0);
          }
        }
        setSelectedProductStock(availableStock);
        setSelectedProductUnit(prod.unit || 'pcs');
      }
    } else {
      setSelectedProductStock(0);
      setSelectedProductUnit('pcs');
    }
  }, [selectedProductId, isEdit, selectedWastageId, products, wastages]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProductId) {
      triggerAlert('warning', 'Validation Warning', 'Please select a product.');
      return;
    }

    const qtyNum = Number(quantity);
    if (!qtyNum || qtyNum <= 0) {
      triggerAlert('warning', 'Validation Warning', 'Quantity must be a positive number.');
      return;
    }

    if (qtyNum > selectedProductStock) {
      triggerAlert('error', 'Limit Exceeded', `Wastage quantity (${qtyNum}) cannot exceed available stock (${selectedProductStock} ${selectedProductUnit}).`);
      return;
    }

    const payload = {
      productId: selectedProductId,
      quantity: qtyNum,
      note,
      date
    };

    try {
      if (isEdit) {
        await api.put(`/products/wastage/${selectedWastageId}`, payload);
        triggerAlert('success', 'Update Successful', 'Product wastage record has been updated successfully.');
      } else {
        await api.post('/products/wastage', payload);
        triggerAlert('success', 'Creation Successful', 'Product wastage record has been added and stock reduced successfully.');
      }
      setShowModal(false);
      resetForm();
      fetchProducts();
      fetchWastages();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'An error occurred during submission.';
      triggerAlert('error', 'Operation Failed', errMsg);
    }
  };

  const handleEditClick = (wastage) => {
    setIsEdit(true);
    setSelectedWastageId(wastage.id);
    setSelectedProductId(wastage.productId);
    setQuantity(wastage.quantity);
    setNote(wastage.note || '');
    setDate(new Date(wastage.date).toISOString().split('T')[0]);
    setShowModal(true);
  };

  const handleDeleteClick = async (id) => {
    // We will show a premium confirmation styled dialog, or standard prompt for safety
    if (window.confirm('Are you sure you want to delete this wastage record? The product stock will be automatically restored.')) {
      try {
        await api.delete(`/products/wastage/${id}`);
        triggerAlert('success', 'Deletion Successful', 'Wastage record deleted and stock restored successfully.');
        fetchProducts();
        fetchWastages();
      } catch (err) {
        console.error(err);
        triggerAlert('error', 'Deletion Failed', err.response?.data?.error || 'Could not delete record.');
      }
    }
  };

  const resetForm = () => {
    setIsEdit(false);
    setSelectedWastageId(null);
    setSelectedProductId('');
    setQuantity('');
    setNote('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const filtered = wastages.filter(w => 
    w.referenceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.product?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.note?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedWastages = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Compute analytics
  const totalWastageRecords = wastages.length;
  const totalWastedQty = wastages.reduce((sum, w) => sum + Number(w.quantity), 0);
  const uniqueProductsWasted = new Set(wastages.map(w => w.productId)).size;

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 relative">
      
      {/* Premium Custom Alert Container */}
      {alertConfig.show && (
        <div className="fixed top-4 right-4 z-50 animate-bounce-short max-w-md w-full">
          <div className={`p-4 rounded-2xl shadow-xl backdrop-blur-md border flex items-start space-x-3 transition-all ${
            alertConfig.type === 'success' 
              ? 'bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-200 text-emerald-800 dark:text-emerald-205'
              : alertConfig.type === 'error'
              ? 'bg-rose-50/95 dark:bg-rose-955/95 border-rose-200 text-rose-800 dark:text-rose-205'
              : 'bg-amber-50/95 dark:bg-amber-955/95 border-amber-200 text-amber-800 dark:text-amber-205'
          }`}>
            <div className="flex-shrink-0 mt-0.5">
              {alertConfig.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              {alertConfig.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
              {alertConfig.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm">{alertConfig.title}</h4>
              <p className="text-xs mt-1 opacity-90">{alertConfig.message}</p>
            </div>
            <button 
              onClick={() => setAlertConfig(prev => ({ ...prev, show: false }))} 
              className="flex-shrink-0 text-slate-400 hover:text-slate-650 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-850">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-rose-600 shrink-0" />
            Product Wastage Log
          </h1>
          <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5">
            Log and manage finished product wastage records with automatic stock reduction.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchWastages(); fetchProducts(); }}
            className="flex items-center gap-1.5 border-slate-205 h-9 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          {canEdit && (
            <Button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all text-xs h-9"
            >
              <Plus className="w-4 h-4" />
              Record Wastage
            </Button>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium animate-in fade-in slide-in-from-top-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Product Wastage Log. Logging new wastage records is restricted.</span>
        </div>
      )}

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-455 rounded-xl shrink-0">
            <FileText className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Records</p>
            <p className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{totalWastageRecords}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
            <BarChart2 className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Wasted Quantity</p>
            <p className="text-lg font-black text-slate-805 dark:text-white mt-0.5">
              {totalWastedQty.toLocaleString()} <span className="text-2xs font-normal text-slate-455">units</span>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-violet-50 dark:bg-violet-955/20 text-violet-600 dark:text-violet-400 rounded-xl shrink-0">
            <Package className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unique Products</p>
            <p className="text-lg font-black text-slate-805 dark:text-white mt-0.5">{uniqueProductsWasted}</p>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate__animated animate__fadeIn">
        {/* Table Search & Header Controls */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50/20 dark:bg-slate-900/20 text-xs">
          <h3 className="font-bold text-slate-850 dark:text-white text-base">Wastage History</h3>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by code, product name..." 
              className="pl-9 bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-800 text-xs h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Datatable */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-550 dark:text-slate-450 font-bold border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-2.5">Reference No</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Product Code</th>
                <th className="px-4 py-2.5">Product Name</th>
                <th className="px-4 py-2.5 text-right">Quantity</th>
                <th className="px-4 py-2.5">Logged By</th>
                <th className="px-4 py-2.5">Note</th>
                {canEdit && <th className="px-4 py-2.5 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-404">Loading wastage data...</td>
                </tr>
              ) : paginatedWastages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-404 bg-slate-50/10">No wastage records matching your query.</td>
                </tr>
              ) : (
                paginatedWastages.map(w => (
                  <tr key={w.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                      {w.referenceNo}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(w.date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">
                      {w.product?.code || 'N/A'}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-805 dark:text-slate-200">
                      {w.product?.name || 'Deleted Product'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-rose-600 dark:text-rose-455">
                      -{w.quantity} <span className="text-2xs font-normal text-slate-455 uppercase">{w.product?.unit || 'pcs'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] bg-slate-105 dark:bg-slate-800 text-slate-650 dark:text-slate-300 px-2 py-0.5 rounded-lg font-bold border dark:border-slate-750">
                        {w.creator?.name || 'System'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[200px] truncate font-medium">
                      {w.note || <span className="italic text-slate-350">No notes</span>}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-indigo-650 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-lg" 
                            onClick={() => handleEditClick(w)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 rounded-lg" 
                            onClick={() => handleDeleteClick(w.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} entries
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-400 font-medium order-3">
              Matched entries: {filtered.length} records
            </div>
          </div>
        )}
      </div>

      {/* Record / Edit Wastage Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col animate__animated animate__zoomIn animate__faster">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                  <Package className="w-5 h-5 text-rose-500" />
                  {isEdit ? 'Edit Wastage Record' : 'Record Product Wastage'}
                </h3>
                <p className="text-[10px] text-slate-450 mt-1">Provide wastage details to update product inventory.</p>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-205 transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              {/* Product Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Product</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-905 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-550/20 font-semibold h-10"
                  disabled={isEdit} // Disallow changing product during edit for stock integrity
                >
                  <option value="">Select a product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name} (Stock: {p.currentStock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock display badge */}
              {selectedProductId && (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl p-2.5 flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Available Inventory:</span>
                  <span className="text-xs font-black text-indigo-650 dark:text-indigo-400">
                    {selectedProductStock} {selectedProductUnit}
                  </span>
                </div>
              )}

              {/* Quantity Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Wastage Quantity</label>
                <div className="relative">
                  <Input 
                    type="number"
                    step="any"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter wastage amount..."
                    className="pr-12 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 h-9 text-xs"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xs font-bold text-slate-400 uppercase">
                    {selectedProductUnit}
                  </span>
                </div>
                {selectedProductId && Number(quantity) > selectedProductStock && (
                  <p className="text-[10px] text-rose-600 flex items-center gap-1 mt-1 font-extrabold">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    Quantity must be under or equal to current stock!
                  </p>
                )}
              </div>

              {/* Date Input */}
              <div className="space-y-1 flex flex-col w-full relative">
                <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</label>
                <DatePicker
                  value={date}
                  onChange={(newDate) => setDate(newDate ? newDate.toISOString().split('T')[0] : '')}
                  triggerClassName="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold px-3 py-1.5 border-b-px shadow-none"
                />
              </div>

              {/* Note Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reason / Remarks</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Describe the reason for wastage..."
                  rows={2.5}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-905 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-xs resize-none font-semibold"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="w-1/2 rounded-xl border-slate-200 font-bold h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={selectedProductId && Number(quantity) > selectedProductStock}
                  className="w-1/2 rounded-xl bg-rose-600 text-white font-bold shadow-md hover:bg-rose-700 disabled:opacity-50 disabled:pointer-events-none h-9 text-xs"
                >
                  {isEdit ? 'Save Changes' : 'Confirm Wastage'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
