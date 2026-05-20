import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Package, Search, Trash2, Edit, Plus, FileText, Calendar, 
  AlertTriangle, CheckCircle, X, ChevronRight, RefreshCw, BarChart2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProductWastagePage() {
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

  // Compute analytics
  const totalWastageRecords = wastages.length;
  const totalWastedQty = wastages.reduce((sum, w) => sum + Number(w.quantity), 0);
  const uniqueProductsWasted = new Set(wastages.map(w => w.productId)).size;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 relative">
      
      {/* Premium Custom Alert Container */}
      {alertConfig.show && (
        <div className="fixed top-4 right-4 z-50 animate-bounce-short max-w-md w-full">
          <div className={`p-4 rounded-2xl shadow-xl backdrop-blur-md border flex items-start space-x-3 transition-all ${
            alertConfig.type === 'success' 
              ? 'bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-200 text-emerald-800 dark:text-emerald-200'
              : alertConfig.type === 'error'
              ? 'bg-rose-50/95 dark:bg-rose-950/95 border-rose-200 text-rose-800 dark:text-rose-200'
              : 'bg-amber-50/95 dark:bg-amber-950/95 border-amber-200 text-amber-800 dark:text-amber-200'
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
              className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-8 h-8 text-rose-600" />
            Product Wastage Log
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Log and manage finished product wastage records with automatic stock reduction.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchWastages(); fetchProducts(); }}
            className="flex items-center gap-1.5 border-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-semibold rounded-xl shadow-md flex items-center gap-1.5 transition-all transform hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            Record Wastage
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Records</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{totalWastageRecords}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Wasted Quantity</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
              {totalWastedQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">units</span>
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
          <div className="p-4 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-2xl">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Unique Products</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{uniqueProductsWasted}</p>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Search & Header Controls */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-50/30 dark:bg-slate-900/30">
          <h3 className="font-bold text-slate-800 dark:text-white text-lg">Wastage History</h3>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by code, product name..." 
              className="pl-9 bg-white dark:bg-slate-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Datatable */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Reference No</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Product Code</th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4 text-right">Quantity</th>
                <th className="px-6 py-4">Logged By</th>
                <th className="px-6 py-4">Note</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">Loading wastage data...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 bg-slate-50/20">No wastage records matching your query.</td>
                </tr>
              ) : (
                filtered.map(w => (
                  <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                      {w.referenceNo}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(w.date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500">
                      {w.product?.code || 'N/A'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">
                      {w.product?.name || 'Deleted Product'}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-rose-600 dark:text-rose-400">
                      -{w.quantity} <span className="text-xs font-normal text-slate-400">{w.product?.unit || 'pcs'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md font-semibold">
                        {w.creator?.name || 'System'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate">
                      {w.note || <span className="italic text-slate-300">No notes</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30" 
                          onClick={() => handleEditClick(w)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30" 
                          onClick={() => handleDeleteClick(w.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record / Edit Wastage Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex justify-center items-center p-4 transition-all">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col transform transition-transform scale-100 scale-in-fade animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Package className="w-5 h-5 text-rose-500" />
                  {isEdit ? 'Edit Wastage Record' : 'Record Product Wastage'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Provide wastage details to update product inventory.</p>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Product Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Product</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-medium">Available Inventory:</span>
                  <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                    {selectedProductStock} {selectedProductUnit}
                  </span>
                </div>
              )}

              {/* Quantity Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Wastage Quantity</label>
                <div className="relative">
                  <Input 
                    type="number"
                    step="any"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter wastage amount..."
                    className="pr-12 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    {selectedProductUnit}
                  </span>
                </div>
                {selectedProductId && Number(quantity) > selectedProductStock && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 mt-1 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Quantity must be under or equal to current stock!
                  </p>
                )}
              </div>

              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</label>
                <Input 
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              {/* Note Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reason / Remarks</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Describe the reason for wastage..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="w-1/2 py-3 rounded-xl border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={selectedProductId && Number(quantity) > selectedProductStock}
                  className="w-1/2 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 text-white font-bold shadow-md hover:from-rose-700 hover:to-amber-700 disabled:opacity-50 disabled:pointer-events-none"
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
