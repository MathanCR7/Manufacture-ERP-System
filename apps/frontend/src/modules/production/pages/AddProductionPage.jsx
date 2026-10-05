import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/lib/axios';
import { 
  Factory, Calendar, Info, Layers, Users, TrendingUp, ChevronLeft, 
  ShoppingBag, ShieldAlert, Award, Flame, CheckCircle, Play, Save,
  AlertTriangle, Package, Check, Sparkles, HelpCircle, ArrowRight,
  RotateCcw, Sliders, Clock, Tag, FileText, ChevronDown, CheckCircle2,
  X, Scale, ListOrdered, CalendarDays, RefreshCw, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import useAuthStore from '@/app/store/authStore';

import ProductSelectCombobox from '../components/ProductSelectCombobox';
import LiveBOMPanel, { getCleanUomLabel } from '../components/LiveBOMPanel';
import LiveSOPPanel from '../components/LiveSOPPanel';
import ScheduleConfirmationModal from '../components/ScheduleConfirmationModal';

// Preset Occasions for Seasonal / Manual mode
const OCCASION_PRESETS = [
  'Diwali Pre-stocking',
  'Christmas Special',
  'New Year Bash',
  'Summer Special',
  'Ramadan Pack',
  'Pongal / Sankranti Feast',
  'Valentine’s Day Special',
  'Monsoon Special',
  'Back-to-School Rush',
  'Wedding Season',
  'Trial / Test Batch',
  'Buffer Replenishment'
];

export default function AddProductionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAuthStore(s => s.user);

  // Master Data Lists
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [allRawMaterials, setAllRawMaterials] = useState([]);
  const [nonInventoryItems, setNonInventoryItems] = useState([]);
  const [allUoms, setAllUoms] = useState([]);
  const [stockStats, setStockStats] = useState({});
  const [rmStockStats, setRmStockStats] = useState({});
  const [usersList, setUsersList] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // Cascading Category & Subcategory Master Lists
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [baseTemplates, setBaseTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Recipe Engine Metadata
  const [recipeSource, setRecipeSource] = useState('NONE');
  const [recipeTitle, setRecipeTitle] = useState('');
  const [wastagePercent, setWastagePercent] = useState(6);
  const [overheadPercent, setOverheadPercent] = useState(10);

  // 4 Trigger Modes: 'Order-Based' | 'Replenishment' | 'Manual' | 'Regular'
  const [triggerType, setTriggerType] = useState('Order-Based');

  // Core Product & Batch Fields
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDays, setExpiryDays] = useState(365);
  const [note, setNote] = useState('');

  // Mode 1: Order-Based Fields
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [customerOrderQty, setCustomerOrderQty] = useState(0);
  const [minBufferStock, setMinBufferStock] = useState(0);
  const [currentStock, setCurrentStock] = useState(0);

  // Mode 2: Replenishment Fields
  const [targetStockLevel, setTargetStockLevel] = useState(200);

  // Mode 3: Seasonal / Manual Fields
  const [occasion, setOccasion] = useState('');
  const [isCustomOccasion, setIsCustomOccasion] = useState(false);
  const [customOccasionText, setCustomOccasionText] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');

  // Mode 4: Regular Production Fields
  const [productionFrequency, setProductionFrequency] = useState('Daily');
  const [standardBatchRef, setStandardBatchRef] = useState('');

  // Live BOM State
  const [bomItems, setBomItems] = useState([]);
  const [bomLoading, setBomLoading] = useState(false);
  const [removedBomItem, setRemovedBomItem] = useState(null);
  const [undoTimer, setUndoTimer] = useState(null);

  // Live SOP Steps State
  const [sopSteps, setSopSteps] = useState([]);
  const [saveAsNewSopVersion, setSaveAsNewSopVersion] = useState(false);

  // Confirmation Modal & Submitting State
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Inline Validation Errors
  const [formErrors, setFormErrors] = useState({});

  // Active product reference
  const activeProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Selected Order Reference
  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Cascading Filtered Subcategories
  const filteredSubcategories = useMemo(() => {
    if (!selectedCategoryId) return subcategories;
    return subcategories.filter(s => s.categoryId === selectedCategoryId);
  }, [subcategories, selectedCategoryId]);

  // Cascading Filtered Products
  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategoryId) {
      result = result.filter(p => p.categoryId === selectedCategoryId);
    }
    if (selectedSubcategoryId) {
      result = result.filter(p => p.subcategoryId === selectedSubcategoryId);
    }
    return result;
  }, [products, selectedCategoryId, selectedSubcategoryId]);

  // Combined Purchasable / Usable Items Catalog (Matching /purchase-orders/create)
  const allSelectableItems = useMemo(() => {
    const rmList = (allRawMaterials || []).map(rm => {
      const liveStock = rmStockStats[rm.id] ?? Number(rm.currentStock || 0);
      const cleanUom = getCleanUomLabel(rm.consumptionUnit || rm.unitId, allUoms);
      const isLow = Number(rm.alertLevel) > 0 && liveStock <= Number(rm.alertLevel);

      return {
        ...rm,
        itemType: 'RAW_MATERIAL',
        itemTypeLabel: 'Raw Material',
        categoryName: rm.category?.name || rm.categoryName || 'General',
        displayUom: cleanUom,
        currentStock: liveStock,
        isLowStock: isLow,
        ratePerUnit: Number(rm.ratePerUnit || rm.unitPrice || 0),
        hasAlternateUom: Boolean(rm.hasAlternateUom),
        alternateUom: rm.alternateUom,
        conversionFactor: Number(rm.conversionFactor || 1.0),
        baseUomQty: Number(rm.baseUomQty || 1.0),
        alternateUomQty: Number(rm.alternateUomQty || 1.0)
      };
    });

    const nonInvList = (nonInventoryItems || []).map(ni => ({
      ...ni,
      itemType: 'NON_INVENTORY',
      itemTypeLabel: 'Non-Inventory',
      categoryName: ni.category || 'Non-Inventory',
      displayUom: getCleanUomLabel(ni.unitId, allUoms),
      currentStock: null,
      isLowStock: false,
      ratePerUnit: Number(ni.ratePerUnit || 0),
      hasAlternateUom: false
    }));

    return [...rmList, ...nonInvList];
  }, [allRawMaterials, nonInventoryItems, allUoms, rmStockStats]);

  // Initial Fetch of Masters
  useEffect(() => {
    let isMounted = true;
    const loadMasters = async () => {
      setLoadingMasters(true);
      try {
        const [prodRes, orderRes, rmRes, nonInvRes, uomRes, stockRes, rmStockRes, mastersRes] = await Promise.all([
          api.get('/products'),
          api.get('/orders'),
          api.get('/item-setup/raw-material').catch(() => ({ data: [] })),
          api.get('/item-setup/non-inventory-item').catch(() => ({ data: [] })),
          api.get('/uom').catch(() => ({ data: [] })),
          api.get('/products/stock').catch(() => ({ data: [] })),
          api.get('/rm-stock').catch(() => ({ data: [] })),
          api.get('/products/masters').catch(() => api.get('/products/form-metadata').catch(() => ({ data: {} })))
        ]);

        if (!isMounted) return;

        setProducts(prodRes.data || []);
        
        // Open orders waiting for production or confirmed
        const openOrders = (orderRes.data || []).filter(o => 
          o.status === 'Confirmed' || o.status === 'Waiting for Production' || o.status === 'Quotation'
        );
        setOrders(openOrders);

        setAllRawMaterials(rmRes.data || []);
        setNonInventoryItems(nonInvRes.data || []);
        setAllUoms(uomRes.data || []);

        // Categories & Subcategories
        const rawCats = mastersRes.data?.categories || [];
        const rawSubcats = mastersRes.data?.subcategories || [];
        setCategories(rawCats);
        setSubcategories(rawSubcats);

        // FG Stock lookup map
        const stockMap = {};
        (stockRes.data || []).forEach(s => {
          stockMap[s.id] = Number(s.currentStock || 0);
        });
        setStockStats(stockMap);

        // RM Stock lookup map
        const rmMap = {};
        (rmStockRes.data || []).forEach(s => {
          rmMap[s.id] = Number(s.availableQuantity ?? s.currentStock ?? 0);
        });
        setRmStockStats(rmMap);

        // Try loading user list for manager selection
        api.get('/users').then(r => {
          if (isMounted) setUsersList(r.data || []);
        }).catch(() => {
          if (isMounted && currentUser?.name) {
            setUsersList([{ id: currentUser.id, name: currentUser.name, role: currentUser.role }]);
          }
        });

        // Set default manager if empty
        if (currentUser?.name) {
          setAuthorizedBy(currentUser.name);
        }

        // Handle navigation prefill state & URL query params
        const navState = location.state;
        const searchParams = new URLSearchParams(location.search);
        const queryOrderId = searchParams.get('orderId');
        const queryProductId = searchParams.get('productId');
        const queryQty = searchParams.get('quantity') || searchParams.get('deficitQty');

        const targetOrderId = navState?.orderId || queryOrderId;
        const targetProductId = navState?.productId || queryProductId;
        const targetQty = navState?.quantity || queryQty;

        if (targetOrderId) {
          setTriggerType('Order-Based');
          setSelectedOrderId(targetOrderId);
        } else if (navState?.triggerType) {
          setTriggerType(navState.triggerType);
        }

        if (targetProductId) {
          setSelectedProductId(targetProductId);
        }

        if (targetQty) {
          setQuantity(Number(targetQty));
        }
      } catch (err) {
        console.error('Error fetching master records:', err);
      } finally {
        if (isMounted) setLoadingMasters(false);
      }
    };

    loadMasters();
    return () => { isMounted = false; };
  }, [location.state, location.search, currentUser]);

  // Load subcategory base templates when subcategory changes
  useEffect(() => {
    if (!selectedSubcategoryId) {
      setBaseTemplates([]);
      return;
    }

    api.get(`/production/base-templates?subcategoryId=${selectedSubcategoryId}`)
      .then(res => {
        const tmpls = res.data || [];
        setBaseTemplates(tmpls);
        if (tmpls.length > 0 && !selectedTemplateId) {
          handleSelectTemplate(tmpls[0].id, tmpls);
        }
      })
      .catch(() => setBaseTemplates([]));
  }, [selectedSubcategoryId]);

  // Handle manual template selection
  const handleSelectTemplate = async (templateId, customList = null) => {
    setSelectedTemplateId(templateId);
    const list = customList || baseTemplates;
    const tmpl = list.find(t => t.id === templateId);
    if (!tmpl) return;

    setRecipeTitle(tmpl.name);
    setRecipeSource('SUBCATEGORY_BASE');
    if (tmpl.wastagePercent !== undefined) setWastagePercent(Number(tmpl.wastagePercent));
    if (tmpl.overheadPercent !== undefined) setOverheadPercent(Number(tmpl.overheadPercent));
    if (tmpl.sopSteps && Array.isArray(tmpl.sopSteps)) setSopSteps([...tmpl.sopSteps]);

    if (tmpl.items && tmpl.items.length > 0) {
      const scale = Number(quantity || 100) / 100;
      const newItems = await Promise.all(
        tmpl.items.map(async (it) => {
          const reqQty = Number(it.defaultQty || 0) * scale;
          const rm = allRawMaterials.find(r => r.id === it.rmId);
          const avail = Number(rm?.currentStock || 0);

          let firstLot = null;
          try {
            const lotRes = await api.get(`/production/rm-batches/${it.rmId}`);
            if (lotRes.data && lotRes.data.length > 0) {
              firstLot = lotRes.data[0];
            }
          } catch {
            // ignore
          }

          const baseCleanUom = getCleanUomLabel(it.uom || rm?.consumptionUnit || rm?.unitId, allUoms);
          const hasAlt = Boolean(rm?.hasAlternateUom && rm?.alternateUom);
          const altCleanUom = hasAlt ? getCleanUomLabel(rm.alternateUom, allUoms) : null;

          return {
            id: `tmpl-${it.id || it.rmId}-${Date.now()}`,
            rawMaterialId: it.rmId,
            rmId: it.rmId,
            rawMaterialName: rm?.name || it.name,
            name: rm?.name || it.name,
            rawMaterialCode: rm?.code || it.code,
            code: rm?.code || it.code,
            categoryType: it.categoryType || rm?.category?.name || 'Key Raw Material',
            requiredQty: reqQty,
            inputQty: reqQty,
            baseUom: baseCleanUom,
            selectedUom: baseCleanUom,
            uom: baseCleanUom,
            unit: baseCleanUom,
            hasAlternateUom: hasAlt,
            alternateUom: altCleanUom,
            conversionFactor: Number(rm?.conversionFactor || 1.0),
            baseUomQty: Number(rm?.baseUomQty || 1.0),
            alternateUomQty: Number(rm?.alternateUomQty || 1.0),
            unitCost: Number(it.estimatedRate || rm?.ratePerUnit || rm?.unitPrice || 0),
            totalCost: reqQty * Number(it.estimatedRate || rm?.ratePerUnit || rm?.unitPrice || 0),
            availableStock: avail,
            status: avail >= reqQty ? 'Sufficient' : 'Insufficient',
            allocatedBatchId: firstLot?.id || null,
            internalBatchNo: firstLot?.internalBatchNo || null,
            supplierBatchNo: firstLot?.supplierBatchNo || null,
            mfgDate: firstLot?.mfgDate || null,
            expiryDate: firstLot?.expiryDate || null,
            lotNetQty: firstLot?.netQty || null
          };
        })
      );
      setBomItems(newItems);
    }
  };

  // Sync Category & Subcategory when Product changes
  useEffect(() => {
    if (!activeProduct) return;
    if (activeProduct.categoryId && activeProduct.categoryId !== selectedCategoryId) {
      setSelectedCategoryId(activeProduct.categoryId);
    }
    if (activeProduct.subcategoryId && activeProduct.subcategoryId !== selectedSubcategoryId) {
      setSelectedSubcategoryId(activeProduct.subcategoryId);
    }
  }, [activeProduct]);

  // Sync Product Specs & Buffers
  useEffect(() => {
    if (!activeProduct) {
      setCurrentStock(0);
      setMinBufferStock(0);
      return;
    }

    const liveStock = stockStats[activeProduct.id] ?? Number(activeProduct.currentStock || 0);
    const minBuffer = Number(activeProduct.minStockLevel || activeProduct.minBufferStock || 20);
    setCurrentStock(liveStock);
    setMinBufferStock(minBuffer);

    if (activeProduct.shelfLifeDays) {
      setExpiryDays(Number(activeProduct.shelfLifeDays));
    }
  }, [activeProduct, stockStats]);

  // Load Recipe Recommendation & SOP when Product changes
  useEffect(() => {
    if (!selectedProductId) {
      setBomItems([]);
      setSopSteps([]);
      setRecipeSource('NONE');
      return;
    }

    let isMounted = true;
    const loadProductRecipeAndSOP = async () => {
      setBomLoading(true);
      try {
        const recipeRes = await api.get(`/production/recipe/${selectedProductId}?qty=${quantity}`).catch(() => 
          api.get(`/production/recipe-recommendation/${selectedProductId}?qty=${quantity}`)
        );
        if (!isMounted) return;

        if (recipeRes.data) {
          const rData = recipeRes.data;
          setRecipeSource(rData.source || 'NONE');
          setRecipeTitle(rData.title || activeProduct?.name || 'Recipe Formulation');

          if (rData.wastagePercent !== undefined) setWastagePercent(Number(rData.wastagePercent));
          if (rData.overheadPercent !== undefined) setOverheadPercent(Number(rData.overheadPercent));

          if (rData.items && Array.isArray(rData.items)) {
            const formatted = rData.items.map(item => {
              const cleanUom = getCleanUomLabel(item.selectedUom || item.unit || item.uom, allUoms);
              const hasAlt = Boolean(item.hasAlternateUom && item.alternateUom);
              const altUomClean = hasAlt ? getCleanUomLabel(item.alternateUom, allUoms) : null;

              return {
                ...item,
                id: item.id || `rec-${item.rmId || item.rawMaterialId}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                name: item.name || item.rawMaterialName,
                rawMaterialName: item.name || item.rawMaterialName,
                code: item.code || item.rawMaterialCode,
                rawMaterialCode: item.code || item.rawMaterialCode,
                baseUom: cleanUom,
                selectedUom: cleanUom,
                uom: cleanUom,
                unit: cleanUom,
                hasAlternateUom: hasAlt,
                alternateUom: altUomClean,
                requiredQty: Number(item.requiredQty || 1),
                inputQty: Number(item.inputQty || item.requiredQty || 1),
                unitCost: Number(item.unitCost || 0),
                totalCost: Number(item.totalCost || (Number(item.requiredQty || 1) * Number(item.unitCost || 0))),
                availableStock: Number(item.availableStock || 0),
                status: Number(item.availableStock || 0) >= Number(item.requiredQty || 1) ? 'Sufficient' : 'Insufficient'
              };
            });
            setBomItems(formatted);
          }

          if (rData.sopSteps && Array.isArray(rData.sopSteps)) {
            setSopSteps(rData.sopSteps);
          }
        }
      } catch (err) {
        console.error('Failed to load recipe/SOP:', err);
      } finally {
        if (isMounted) setBomLoading(false);
      }
    };

    loadProductRecipeAndSOP();
    return () => { isMounted = false; };
  }, [selectedProductId, allUoms]);

  // Rescale BOM quantities proportionally when Batch Yield quantity changes
  const prevQuantityRef = useRef(quantity);
  useEffect(() => {
    const prevQty = prevQuantityRef.current;
    if (prevQty && prevQty !== quantity && quantity > 0 && bomItems.length > 0) {
      const ratio = quantity / prevQty;
      setBomItems(prevItems => 
        prevItems.map(item => {
          const newReq = Number((item.requiredQty * ratio).toFixed(4));
          const avail = Number(item.availableStock || 0);
          return {
            ...item,
            requiredQty: newReq,
            totalCost: newReq * Number(item.unitCost || 0),
            status: avail >= newReq ? 'Sufficient' : 'Insufficient'
          };
        })
      );
    }
    prevQuantityRef.current = quantity;
  }, [quantity]);

  // Sync Order Details when selectedOrderId changes
  useEffect(() => {
    if (!selectedOrder) {
      setCustomerOrderQty(0);
      return;
    }

    let orderQty = 0;
    if (selectedOrder.items && selectedOrder.items.length > 0) {
      if (selectedProductId) {
        const found = selectedOrder.items.find(i => i.productId === selectedProductId);
        if (found) orderQty = Number(found.quantity || 0);
      }
      if (orderQty === 0) {
        const primary = selectedOrder.items[0];
        orderQty = Number(primary.quantity || 0);
        if (primary.productId && primary.productId !== selectedProductId) {
          setSelectedProductId(primary.productId);
        }
      }
    }
    setCustomerOrderQty(orderQty);
  }, [selectedOrder, selectedProductId]);

  // Suggested Batch Yield Calculation
  const suggestedBatchYield = useMemo(() => {
    if (triggerType === 'Order-Based') {
      const needed = Math.max(0, customerOrderQty - currentStock) + minBufferStock;
      return needed > 0 ? needed : customerOrderQty || 100;
    }
    if (triggerType === 'Replenishment') {
      const deficit = targetStockLevel - currentStock;
      return deficit > 0 ? deficit : 50;
    }
    return quantity;
  }, [triggerType, customerOrderQty, currentStock, minBufferStock, targetStockLevel, quantity]);

  // Apply suggested quantity helper
  const handleApplySuggestedYield = () => {
    if (suggestedBatchYield > 0) {
      setQuantity(suggestedBatchYield);
    }
  };

  // Undo Remove BOM Item
  const handleUndoRemove = () => {
    if (!removedBomItem) return;
    setBomItems(prev => {
      const copy = [...prev];
      copy.splice(removedBomItem.index, 0, removedBomItem.item);
      return copy;
    });
    setRemovedBomItem(null);
    if (undoTimer) clearTimeout(undoTimer);
  };

  // Live Aggregates & Cost Calculations
  const { directMaterialCost, wastageCost, overheadCost, grandTotalCost, unitCost, insufficientItems } = useMemo(() => {
    let direct = 0;
    const insufficient = [];
    bomItems.forEach(item => {
      const cost = Number(item.requiredQty || 0) * Number(item.unitCost || 0);
      direct += cost;
      if (Number(item.availableStock || 0) < Number(item.requiredQty || 0)) {
        insufficient.push(item);
      }
    });

    const wastage = (direct * wastagePercent) / 100;
    const overhead = (direct * overheadPercent) / 100;
    const grandTotal = direct + wastage + overhead;
    const perUnit = quantity > 0 ? grandTotal / quantity : 0;

    return {
      directMaterialCost: direct,
      wastageCost: wastage,
      overheadCost: overhead,
      grandTotalCost: grandTotal,
      unitCost: perUnit,
      insufficientItems: insufficient
    };
  }, [bomItems, wastagePercent, overheadPercent, quantity]);

  const hasShortfall = insufficientItems.length > 0;

  // Validation Routine
  const validateForm = () => {
    const errs = {};
    if (!selectedProductId) errs.product = 'Please select a finished product';
    if (!quantity || quantity <= 0) errs.quantity = 'Target yield quantity must be greater than 0';
    if (!startDate) errs.startDate = 'Planned start date is required';

    if (triggerType === 'Order-Based') {
      if (!selectedOrderId) errs.order = 'Please select a customer sales order';
    } else if (triggerType === 'Replenishment') {
      if (!targetStockLevel || targetStockLevel <= 0) {
        errs.targetStock = 'Target inventory ceiling must be greater than 0';
      }
    } else if (triggerType === 'Manual') {
      const occ = isCustomOccasion ? customOccasionText : occasion;
      if (!occ || occ.trim() === '') errs.occasion = 'Festival or run reason is required';
      if (!authorizedBy) errs.authorizedBy = 'Authorizing manager is required';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Handler
  const handleExecuteBatch = async (startNow = false) => {
    if (!validateForm()) {
      Swal.fire({
        icon: 'warning',
        title: 'Validation Failed',
        text: 'Please check the required fields highlighted in red.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    if (startNow && hasShortfall) {
      Swal.fire({
        icon: 'error',
        title: 'Material Shortage',
        text: 'Cannot start batch immediately due to raw material shortfall.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        productId: selectedProductId,
        quantity: Number(quantity),
        productionType: triggerType === 'Order-Based' ? 'Make to Order' : 'Make to Stock',
        status: startNow ? 'In Progress' : 'Planned',
        startDate: startDate,
        expiryDays: Number(expiryDays),
        note: note,
        orderId: triggerType === 'Order-Based' ? selectedOrderId : null,
        wastagePercent: Number(wastagePercent),
        overheadPercent: Number(overheadPercent),
        sopSteps: sopSteps.map(step => ({
          stepNumber: step.stepNumber,
          stageName: step.stageName,
          title: step.title,
          description: step.description,
          durationMinutes: Number(step.durationMinutes || 0),
          parameters: step.parameters || {},
          safetyNotes: step.safetyNotes || ''
        })),
        customBom: bomItems.map(item => ({
          rmId: item.rmId || item.rawMaterialId,
          requiredQty: Number(item.requiredQty),
          unitCost: Number(item.unitCost || 0),
          selectedUom: item.selectedUom || item.uom || 'units',
          inputQty: Number(item.inputQty || item.requiredQty),
          conversionFactorUsed: Number(item.conversionFactor || 1.0),
          allocatedBatchId: item.allocatedBatchId || null,
          internalBatchNo: item.internalBatchNo || null,
          supplierBatchNo: item.supplierBatchNo || null,
          mfgDate: item.mfgDate || null,
          expiryDate: item.expiryDate || null,
          categoryType: item.categoryType || 'Key Raw Material',
          allocatedBatches: Array.isArray(item.allocatedBatches) ? item.allocatedBatches : []
        }))
      };

      const res = await api.post('/production', payload);
      setConfirmationModalOpen(false);

      await Swal.fire({
        icon: 'success',
        title: startNow ? 'Production Batch Started!' : 'Production Batch Scheduled!',
        text: `Batch #${res.data?.referenceNo || 'CREATED'} registered. RM stock updated accordingly.`,
        confirmButtonColor: '#4f46e5'
      });

      navigate('/production');
    } catch (err) {
      console.error('Failed to create production batch:', err);
      const errData = err.response?.data;
      let errMsg = 'Server error occurred while creating production batch.';
      if (errData?.message) {
        errMsg = errData.message;
      } else if (typeof errData?.error === 'string') {
        errMsg = errData.error;
      } else if (Array.isArray(errData?.error) && errData.error.length > 0) {
        errMsg = errData.error.map(e => `${e.path?.filter(Boolean).join('.') || 'field'}: ${e.message}`).join(', ');
      }
      Swal.fire({
        icon: 'error',
        title: 'Scheduling Failed',
        text: errMsg,
        confirmButtonColor: '#4f46e5'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form handler
  const handleResetForm = () => {
    setSelectedProductId('');
    setSelectedCategoryId('');
    setSelectedSubcategoryId('');
    setSelectedTemplateId('');
    setSelectedOrderId('');
    setBomItems([]);
    setSopSteps([]);
    setQuantity(100);
    setFormErrors({});
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-28 animate__animated animate__fadeIn">

      {/* ─────────────────────── PAGE HEADER & CONTEXT ─────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/production')}
            className="rounded-xl border border-slate-200 dark:border-slate-800 p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                Production Execution
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs text-slate-400 font-mono">
                Batch Code: <strong className="text-slate-700 dark:text-slate-200">BATCH-{Date.now().toString().slice(-6)}</strong>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Production Batch Scheduling & Formula Workstation
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetForm}
            className="rounded-xl text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white border-slate-200 dark:border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/production')}
            className="rounded-xl text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white border-slate-200 dark:border-slate-700"
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* ─────────────────────── STEP 1: PRODUCT CLASSIFICATION & PROFILE ─────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Product Classification & Master Profile
              </h2>
              <p className="text-[11px] text-slate-400">
                Filter by product hierarchy or select product directly to view full physical specs and live warehouse stock
              </p>
            </div>
          </div>
          {activeProduct && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Product Loaded
            </span>
          )}
        </div>

        {/* 3 Cascading Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Main Category */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
              Main Group / Category
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                const catId = e.target.value;
                setSelectedCategoryId(catId);
                setSelectedSubcategoryId('');
              }}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-11 cursor-pointer"
            >
              <option value="">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
              Subcategory
            </label>
            <select
              value={selectedSubcategoryId}
              onChange={(e) => setSelectedSubcategoryId(e.target.value)}
              disabled={!selectedCategoryId && filteredSubcategories.length === 0}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-11 cursor-pointer disabled:opacity-50"
            >
              <option value="">All Subcategories ({filteredSubcategories.length})</option>
              {filteredSubcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Finished Product Combobox */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
              Finished Product *
            </label>
            <ProductSelectCombobox
              products={filteredProducts}
              value={selectedProductId}
              selectedProductId={selectedProductId}
              onChange={(pId, p) => {
                setSelectedProductId(pId);
                if (p) {
                  if (p.categoryId) setSelectedCategoryId(p.categoryId);
                  if (p.subcategoryId) setSelectedSubcategoryId(p.subcategoryId);
                }
              }}
              onSelect={(p) => {
                if (p) {
                  setSelectedProductId(p.id);
                  if (p.categoryId) setSelectedCategoryId(p.categoryId);
                  if (p.subcategoryId) setSelectedSubcategoryId(p.subcategoryId);
                } else {
                  setSelectedProductId('');
                }
              }}
              error={formErrors.product}
            />
          </div>
        </div>

        {/* Selected Product Specifications & Physical Metrics Banner */}
        {activeProduct && (
          <div className="p-4 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-white dark:from-slate-850 dark:via-indigo-950/20 dark:to-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4 animate__animated animate__fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {activeProduct.imageUrl ? (
                  <img
                    src={activeProduct.imageUrl}
                    alt={activeProduct.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base shadow-xs">
                    <Package className="w-7 h-7" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-slate-900 dark:text-white text-base">
                      {activeProduct.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-bold">
                      {activeProduct.code || activeProduct.sku || 'SKU-NONE'}
                    </span>
                    {activeProduct.brand && (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {activeProduct.brand}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span>Group: <strong>{activeProduct.category?.name || 'Standard'}</strong></span>
                    <span>•</span>
                    <span>Subcategory: <strong>{activeProduct.subcategory?.name || 'General'}</strong></span>
                    <span>•</span>
                    <span>UOM: <strong>{getCleanUomLabel(activeProduct.unit?.abbreviation || activeProduct.unitId, allUoms)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Inventory & Pricing Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">FG Warehouse Stock</span>
                  <span className={`font-mono font-black ${currentStock <= minBufferStock ? 'text-amber-500' : 'text-slate-800 dark:text-slate-200'}`}>
                    {currentStock.toFixed(2)} {getCleanUomLabel(activeProduct.unit?.abbreviation || activeProduct.unitId, allUoms)}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Safety Buffer</span>
                  <span className="font-mono font-extrabold text-slate-800 dark:text-slate-200">
                    {minBufferStock.toFixed(2)} {getCleanUomLabel(activeProduct.unit?.abbreviation || activeProduct.unitId, allUoms)}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Sale Price / MRP</span>
                  <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                    ₹{Number(activeProduct.salePrice || activeProduct.sellingPrice || activeProduct.mrp || 0).toFixed(2)}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Stock Queue</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {activeProduct.stockMethod || 'FIFO'}
                  </span>
                </div>
              </div>
            </div>

            {/* Physical Specs Pills */}
            {(activeProduct.dimensionLength || activeProduct.weightValue || activeProduct.material || activeProduct.color) && (
              <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center gap-3 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Physical Specs:</span>
                {activeProduct.dimensionLength && (
                  <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                    Size: {activeProduct.dimensionLength} × {activeProduct.dimensionWidth || 0} × {activeProduct.dimensionHeight || 0} {activeProduct.dimensionUnit || 'cm'}
                  </span>
                )}
                {activeProduct.weightValue && (
                  <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                    Weight: {activeProduct.weightValue} {activeProduct.weightUnit || 'kg'}
                  </span>
                )}
                {activeProduct.material && (
                  <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 text-[11px]">
                    Material: {activeProduct.material}
                  </span>
                )}
                {activeProduct.color && (
                  <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 text-[11px]">
                    Color: {activeProduct.color}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─────────────────────── STEP 2: TRIGGER MODES & PARAMETERS ─────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Production Trigger Modes & Operational Parameters
              </h2>
              <p className="text-[11px] text-slate-400">
                Select production trigger reason to auto-calculate batch targets based on warehouse demand
              </p>
            </div>
          </div>
        </div>

        {/* 4 Interactive Trigger Mode Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              id: 'Order-Based',
              title: 'Make-to-Order',
              sub: 'Sales Orders',
              desc: 'Direct fulfillment from confirmed client orders',
              icon: ShoppingBag,
              color: 'text-blue-500'
            },
            {
              id: 'Replenishment',
              title: 'Replenishment',
              sub: 'Make-to-Stock',
              desc: 'Auto-fill warehouse stock up to target ceiling',
              icon: TrendingUp,
              color: 'text-amber-500'
            },
            {
              id: 'Manual',
              title: 'Ad-Hoc / Festive',
              sub: 'Seasonal Run',
              desc: 'Diwali, festivals, special events, or trials',
              icon: Sparkles,
              color: 'text-purple-500'
            },
            {
              id: 'Regular',
              title: 'Regular Cycle',
              sub: 'Daily / Weekly',
              desc: 'Routine production batches based on capacity',
              icon: Sliders,
              color: 'text-emerald-500'
            }
          ].map((mode) => {
            const Icon = mode.icon;
            const isSelected = triggerType === mode.id;
            return (
              <div
                key={mode.id}
                onClick={() => setTriggerType(mode.id)}
                className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-xs'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl bg-white dark:bg-slate-800 shadow-xs ${mode.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-xs text-slate-850 dark:text-white uppercase tracking-wider">
                  {mode.title}
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold">{mode.sub}</p>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                  {mode.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Dynamic Context Panel According to Mode */}
        {/* Mode 1: Order-Based */}
        {triggerType === 'Order-Based' && (
          <div className="p-4 bg-blue-50/30 dark:bg-blue-950/10 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-4 animate__animated animate__fadeIn">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-extrabold text-blue-700 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4" />
                Make-to-Order Linked Sales Order
              </span>
              <span className="text-[11px] text-slate-400">
                Formula: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">(Order Qty - Current Stock) + Buffer</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                  Select Confirmed Sales Order *
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className={`w-full bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-11 cursor-pointer ${
                    formErrors.order ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <option value="">Select Customer Order ({orders.length} Open)...</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber || o.orderCode || 'ORD'} - {o.customer?.name || 'Client'} ({o.status})
                    </option>
                  ))}
                </select>
                {formErrors.order && (
                  <p className="text-[10px] text-rose-500">{formErrors.order}</p>
                )}
              </div>

              {/* Formula Yield Suggestion Box */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Suggested Batch Yield</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-base font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                      {suggestedBatchYield} {getCleanUomLabel(activeProduct?.unit?.abbreviation, allUoms)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      (Req: {customerOrderQty} - Stock: {currentStock} + Buffer: {minBufferStock})
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplySuggestedYield}
                  className="rounded-lg text-xs font-bold border-indigo-200 dark:border-indigo-800 text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                >
                  Apply Yield
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Mode 2: Replenishment */}
        {triggerType === 'Replenishment' && (
          <div className="p-4 bg-amber-50/20 dark:bg-amber-950/10 rounded-2xl border border-amber-100 dark:border-amber-900/40 space-y-4 animate__animated animate__fadeIn">
            <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              Make-to-Stock Warehouse Replenishment
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 text-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase">Current Stock</p>
                <p className="font-extrabold text-slate-800 dark:text-white text-sm mt-0.5">
                  {currentStock} {getCleanUomLabel(activeProduct?.unit?.abbreviation, allUoms)}
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 text-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase">Minimum Hold</p>
                <p className="font-extrabold text-slate-800 dark:text-white text-sm mt-0.5">
                  {minBufferStock} {getCleanUomLabel(activeProduct?.unit?.abbreviation, allUoms)}
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 text-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase">Stock Deficit</p>
                <p className="font-extrabold text-amber-600 dark:text-amber-400 text-sm mt-0.5">
                  {Math.max(0, targetStockLevel - currentStock)} {getCleanUomLabel(activeProduct?.unit?.abbreviation, allUoms)}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                  Target Inventory Ceiling *
                </label>
                <Input
                  type="number"
                  min={minBufferStock + 1}
                  value={targetStockLevel}
                  onChange={(e) => setTargetStockLevel(Number(e.target.value) || 0)}
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-11 rounded-xl text-xs font-mono font-bold"
                />
                {formErrors.targetStock && (
                  <p className="text-[10px] text-rose-500">{formErrors.targetStock}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mode 3: Manual / Seasonal */}
        {triggerType === 'Manual' && (
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 animate__animated animate__fadeIn">
            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Ad-Hoc / Festival Production Run
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                  Occasion / Season *
                </label>
                {!isCustomOccasion ? (
                  <select
                    value={occasion}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        setIsCustomOccasion(true);
                        setOccasion('');
                      } else {
                        setOccasion(e.target.value);
                      }
                    }}
                    className={`w-full bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-11 cursor-pointer ${
                      formErrors.occasion ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <option value="">Select festive occasion or reason...</option>
                    {OCCASION_PRESETS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    <option value="__CUSTOM__" className="font-bold text-indigo-600">
                      + Add Custom Reason...
                    </option>
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Input
                      autoFocus
                      placeholder="Type custom occasion or reason..."
                      value={customOccasionText}
                      onChange={(e) => setCustomOccasionText(e.target.value)}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-11 rounded-xl"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setIsCustomOccasion(false);
                        setCustomOccasionText('');
                      }}
                      className="h-11 text-xs px-2"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                {formErrors.occasion && (
                  <p className="text-[10px] text-rose-500">{formErrors.occasion}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                  Authorized By *
                </label>
                <select
                  value={authorizedBy}
                  onChange={(e) => setAuthorizedBy(e.target.value)}
                  className={`w-full bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-11 cursor-pointer ${
                    formErrors.authorizedBy ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <option value="">Select Authorizing Supervisor / Manager...</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.name}>
                      {u.name} ({u.role || 'Staff'})
                    </option>
                  ))}
                </select>
                {formErrors.authorizedBy && (
                  <p className="text-[10px] text-rose-500">{formErrors.authorizedBy}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mode 4: Regular Cycle */}
        {triggerType === 'Regular' && (
          <div className="p-4 bg-emerald-50/20 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 space-y-4 animate__animated animate__fadeIn">
            <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
              <Sliders className="w-4 h-4" />
              Scheduled Regular Production Cycle
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                  Schedule Frequency
                </label>
                <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 rounded-xl gap-1">
                  {['Daily', 'Weekly', 'One-off'].map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setProductionFrequency(freq)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        productionFrequency === freq
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                  Shift / Cycle Reference
                </label>
                <Input
                  placeholder="e.g. Morning Shift - Cycle A"
                  value={standardBatchRef}
                  onChange={(e) => setStandardBatchRef(e.target.value)}
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-11 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Universal Batch Parameters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* 1. Target Yield Quantity */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
              Target Yield Quantity *
            </label>
            <div className="relative">
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 h-11 rounded-xl text-xs font-mono font-bold pr-16"
              />
              <span className="absolute right-3 top-3 text-xs text-slate-400 font-semibold pointer-events-none">
                {getCleanUomLabel(activeProduct?.unit?.abbreviation, allUoms)}
              </span>
            </div>
            {formErrors.quantity && (
              <p className="text-[10px] text-rose-500">{formErrors.quantity}</p>
            )}
          </div>

          {/* 2. Planned Start Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
              Planned Start Date *
            </label>
            <DatePicker
              value={startDate}
              onChange={(val) => setStartDate(val)}
              placeholder="Select start date..."
              className="w-full bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 h-11 rounded-xl text-xs"
            />
            {formErrors.startDate && (
              <p className="text-[10px] text-rose-500">{formErrors.startDate}</p>
            )}
          </div>

          {/* 3. Shelf Life (Days) */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
              Shelf Life (Days)
            </label>
            <Input
              type="number"
              min="1"
              value={expiryDays}
              onChange={(e) => setExpiryDays(Math.max(1, Number(e.target.value) || 365))}
              className="bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 h-11 rounded-xl text-xs font-mono"
            />
          </div>

          {/* 4. Production Notes */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
              Shop-Floor Instructions
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Machine numbers, shift remarks..."
              className="bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 h-11 rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* ─────────────────────── STEP 3: DYNAMIC RECIPE BOM & FEFO BATCH ALLOCATION ─────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-5">
        <LiveBOMPanel
          bomItems={bomItems}
          setBomItems={setBomItems}
          loading={bomLoading}
          product={activeProduct}
          batchQty={quantity}
          allSelectableItems={allSelectableItems}
          allUoms={allUoms}
          onUndoRemove={handleUndoRemove}
          removedItem={removedBomItem}
          onClearUndo={() => setRemovedBomItem(null)}
          wastagePercent={wastagePercent}
          setWastagePercent={setWastagePercent}
          overheadPercent={overheadPercent}
          setOverheadPercent={setOverheadPercent}
          recipeSource={recipeSource}
          recipeTitle={recipeTitle}
        />
      </div>

      {/* ─────────────────────── STEP 4: STANDARD OPERATING PROCEDURES (SOP) ─────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
              4
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Standard Operating Procedures (SOP) & Quality Control Guide
              </h2>
              <p className="text-[11px] text-slate-400">
                Shop-floor execution stages, temperature parameters, and operator safety checks
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800 self-start sm:self-center">
            {sopSteps.length} Processing Steps
          </span>
        </div>

        <LiveSOPPanel
          sopSteps={sopSteps}
          setSopSteps={setSopSteps}
          product={activeProduct}
          saveAsNewVersion={saveAsNewSopVersion}
          setSaveAsNewVersion={setSaveAsNewSopVersion}
        />
      </div>

      {/* ─────────────────────── STICKY BOTTOM EXECUTION & STATUS BAR ─────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 py-3.5 px-4 sm:px-8 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Summary Stats */}
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Target Output</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {activeProduct ? `${quantity} ${getCleanUomLabel(activeProduct.unit?.abbreviation, allUoms)} of ${activeProduct.name}` : 'No product selected'}
              </span>
            </div>

            <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-slate-700" />

            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Batch Formulation Cost</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                ₹{grandTotalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-slate-700" />

            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Inventory Status</span>
              {hasShortfall ? (
                <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-xs animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {insufficientItems.length} Materials Shortfall
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All Materials Ready
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleExecuteBatch(false)}
              disabled={submitting}
              className="rounded-xl text-xs font-bold h-10 px-4 flex items-center gap-2 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer w-full sm:w-auto"
            >
              <CalendarDays className="w-4 h-4 text-slate-500" />
              <span>Schedule as Planned</span>
            </Button>

            <Button
              type="button"
              onClick={() => setConfirmationModalOpen(true)}
              disabled={submitting || hasShortfall}
              className={`rounded-xl text-xs font-extrabold h-10 px-6 flex items-center gap-2 text-white shadow-md hover:shadow-lg transition-all cursor-pointer w-full sm:w-auto ${
                hasShortfall
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
              }`}
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Start Batch Now</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ─────────────────────── SCHEDULE CONFIRMATION MODAL ─────────────────────── */}
      <ScheduleConfirmationModal
        isOpen={confirmationModalOpen}
        onClose={() => setConfirmationModalOpen(false)}
        onConfirm={() => handleExecuteBatch(true)}
        submitting={submitting}
        product={activeProduct}
        quantity={quantity}
        triggerType={triggerType}
        startDate={startDate}
        bomItems={bomItems}
        totalCost={grandTotalCost}
        order={selectedOrder}
        occasion={isCustomOccasion ? customOccasionText : occasion}
        authorizedBy={authorizedBy}
      />

    </div>
  );
}
