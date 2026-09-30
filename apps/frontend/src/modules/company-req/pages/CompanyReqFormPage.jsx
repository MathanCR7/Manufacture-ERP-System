import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';
import {
  Building2, ArrowLeft, Plus, Trash2, Upload, FileText, CheckCircle2,
  X, Globe, MapPin, User, Phone, Briefcase, FileSpreadsheet, Eye,
  Save, Sparkles, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import DashboardBackButton from '@/components/ui/DashboardBackButton';
import IndustryTypeSelect from '../components/IndustryTypeSelect';

const COMPANY_TYPES = [
  { value: 'Manufacture', label: 'Manufacture', desc: 'Produces physical goods' },
  { value: 'Trader', label: 'Trader', desc: 'Wholesale & merchant trader' },
  { value: 'Retailer', label: 'Retailer', desc: 'Direct-to-consumer seller' },
  { value: 'Supplier', label: 'Supplier', desc: 'Raw material & parts vendor' },
  { value: 'Others', label: 'Others', desc: 'Services & allied operations' }
];

const COMMON_INDUSTRIES = [
  'Milk Supplier',
  'Poly Bag Supply',
  'Tissue Supply',
  'Packing',
  'Chemicals & Additives',
  'Food & Beverages',
  'Hardware & Spares',
  'Printing & Labels',
  'Logistics & Transport'
];

export default function CompanyReqFormPage() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    industryType: '',
    companyName: '',
    address: '',
    website: '',
    type: 'Manufacture',
    contactPerson: '',
    contactNo: '',
    additionalContacts: [''],
    remarks: '',
    attachments: []
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing record if in edit mode
  const { data: existingData, isLoading: isLoadingRecord } = useQuery({
    queryKey: ['company-req', id],
    queryFn: async () => {
      const res = await api.get(`/company-req/${id}`);
      return res.data?.data || res.data;
    },
    enabled: isEditMode
  });

  // Query distinct industry suggestions from database
  const { data: dbIndustries = [] } = useQuery({
    queryKey: ['company-req-industries'],
    queryFn: async () => {
      const res = await api.get('/company-req/industries');
      return res.data?.data || [];
    }
  });

  // Merge common industries with DB industries
  const industrySuggestions = Array.from(new Set([...COMMON_INDUSTRIES, ...dbIndustries]));

  useEffect(() => {
    if (existingData) {
      setFormData({
        industryType: existingData.industryType || '',
        companyName: (existingData.companyName || '').toUpperCase(),
        address: existingData.address || '',
        website: existingData.website || '',
        type: existingData.type || 'Manufacture',
        contactPerson: (existingData.contactPerson || '').toUpperCase(),
        contactNo: existingData.contactNo || '',
        additionalContacts: Array.isArray(existingData.additionalContacts) && existingData.additionalContacts.length > 0
          ? existingData.additionalContacts
          : [''],
        remarks: existingData.remarks || '',
        attachments: Array.isArray(existingData.attachments) ? existingData.attachments : []
      });
    }
  }, [existingData]);

  // Handle contact number dynamic add-on feature
  const handleAddContact = () => {
    setFormData(prev => ({
      ...prev,
      additionalContacts: [...prev.additionalContacts, '']
    }));
  };

  const handleRemoveContact = (index) => {
    setFormData(prev => ({
      ...prev,
      additionalContacts: prev.additionalContacts.filter((_, i) => i !== index)
    }));
  };

  const handleContactChange = (index, value) => {
    setFormData(prev => {
      const updated = [...prev.additionalContacts];
      updated[index] = value;
      return { ...prev, additionalContacts: updated };
    });
  };

  // Multiple File Attachment handler (converts files to base64 for persistent disk saving)
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file, idx) => {
      if (file.size > 20 * 1024 * 1024) {
        Swal.fire({
          icon: 'warning',
          title: 'File Too Large',
          text: `${file.name} exceeds 20MB limit.`
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const base64Data = loadEvent.target.result;
        setFormData(prev => ({
          ...prev,
          attachments: [
            ...prev.attachments,
            {
              id: `temp_${Date.now()}_${idx}`,
              name: file.name,
              size: file.size,
              type: file.type,
              data: base64Data
            }
          ]
        }));
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  };

  const handleRemoveAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  // Form Validation
  const validate = () => {
    const newErrors = {};
    if (!formData.industryType.trim()) newErrors.industryType = 'Industry Type is required';
    if (!formData.companyName.trim()) newErrors.companyName = 'Company Name is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.contactPerson.trim()) newErrors.contactPerson = 'Contact Person is required';
    if (!formData.contactNo.trim()) newErrors.contactNo = 'Primary Contact No is required';
    if (!formData.type) newErrors.type = 'Type is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e, addAnother = false) => {
    if (e) e.preventDefault();
    if (!validate()) {
      Swal.fire({
        icon: 'error',
        title: 'Validation Error',
        text: 'Please fill in all mandatory fields marked with *.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        industryType: formData.industryType.trim(),
        companyName: formData.companyName.trim().toUpperCase(),
        address: formData.address.trim(),
        website: formData.website.trim() || null,
        type: formData.type,
        contactPerson: formData.contactPerson.trim().toUpperCase(),
        contactNo: formData.contactNo.trim(),
        additionalContacts: formData.additionalContacts.map(c => c.trim()).filter(Boolean),
        remarks: formData.remarks.trim() || null,
        attachments: formData.attachments
      };

      if (isEditMode) {
        await api.put(`/company-req/${id}`, payload);
        await Swal.fire({
          icon: 'success',
          title: 'Updated Successfully',
          text: `Company record "${payload.companyName}" has been updated.`,
          timer: 1800,
          showConfirmButton: false
        });
        queryClient.invalidateQueries({ queryKey: ['company-req'] });
        navigate('/company-directory');
      } else {
        await api.post('/company-req', payload);
        await Swal.fire({
          icon: 'success',
          title: 'Saved Successfully',
          text: `New company requirement for "${payload.companyName}" has been created.`,
          timer: 1800,
          showConfirmButton: false
        });
        queryClient.invalidateQueries({ queryKey: ['company-req'] });
        queryClient.invalidateQueries({ queryKey: ['company-req-industries'] });

        if (addAnother) {
          // Reset for next entry
          setFormData({
            industryType: '',
            companyName: '',
            address: '',
            website: '',
            type: 'Manufacture',
            contactPerson: '',
            contactNo: '',
            additionalContacts: [''],
            remarks: '',
            attachments: []
          });
          setErrors({});
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          navigate('/company-directory');
        }
      }
    } catch (err) {
      console.error('Save failed:', err);
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save record';
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: msg
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditMode && isLoadingRecord) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Loading company details...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-4 transition-all duration-200">
      <DashboardBackButton defaultBack="/company-directory" />

      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {isEditMode ? 'Edit Company Requirement Form' : 'Company Requirement Form (Req Form)'}
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800">
                {isEditMode ? 'Edit Mode' : 'New Form'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Enter industry type, company name (auto-caps), contact numbers with add-on feature, address, and attachments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/company-directory')}
            className="h-8.5 px-3 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Display List
          </Button>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
        <Card className="border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden bg-white dark:bg-slate-900">
          <CardContent className="p-4 sm:p-6 space-y-6">

            {/* Section 1: Company & Classification */}
            <div>
              <div className="flex items-center gap-2 pb-2.5 mb-4 border-b border-slate-100 dark:border-slate-800">
                <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  1. Company & Industry Information
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Industry Type with Search & Master Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <span>Industry Type</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800">
                      <Sparkles className="w-2.5 h-2.5" /> Unique Master
                    </span>
                  </div>

                  <IndustryTypeSelect
                    value={formData.industryType}
                    onChange={(selectedName) => {
                      setFormData(prev => ({ ...prev, industryType: selectedName }));
                      if (errors.industryType) {
                        setErrors(prev => ({ ...prev, industryType: '' }));
                      }
                    }}
                    error={errors.industryType}
                    placeholder="Search or add unique Industry Type (e.g. Milk Supplier)..."
                  />

                  {errors.industryType && (
                    <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3 h-3" /> {errors.industryType}
                    </p>
                  )}
                </div>

                {/* Company Name (CAPS required) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Company Name <span className="text-rose-500">*</span>
                    </label>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800">
                      <Sparkles className="w-2.5 h-2.5" /> Auto-Caps
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="ENTER COMPANY NAME (CAPS)..."
                    value={formData.companyName}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value.toUpperCase() }))}
                    className={`w-full px-3 py-2 text-xs font-bold tracking-wide uppercase rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-3xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:normal-case placeholder:font-normal ${
                      errors.companyName ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {errors.companyName && (
                    <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3 h-3" /> {errors.companyName}
                    </p>
                  )}
                </div>
              </div>

              {/* Type Selection (Manufacture / Trader / Retailer / Supplier / Others) */}
              <div className="mt-4 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>Type Selection</span>
                  <span className="text-rose-500">*</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    (Choose: Manufacture / Trader / Retailer / Supplier / Others)
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {COMPANY_TYPES.map((t) => {
                    const isSelected = formData.type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: t.value }))}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-600 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold tracking-tight">{t.label}</span>
                        <span className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                          {t.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errors.type && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3" /> {errors.type}
                  </p>
                )}
              </div>
            </div>

            {/* Section 2: Contact Details with Add-on Number feature */}
            <div>
              <div className="flex items-center gap-2 pb-2.5 mb-4 border-b border-slate-100 dark:border-slate-800">
                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  2. Contact Person & Phone Numbers
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contact Person (CAPS required) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Contact Person <span className="text-rose-500">*</span>
                    </label>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800">
                      <Sparkles className="w-2.5 h-2.5" /> Auto-Caps
                    </span>
                  </div>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="ENTER CONTACT PERSON (CAPS)..."
                      value={formData.contactPerson}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value.toUpperCase() }))}
                      className={`w-full pl-9 pr-3 py-2 text-xs font-bold tracking-wide uppercase rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-3xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:normal-case placeholder:font-normal ${
                        errors.contactPerson ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                  </div>
                  {errors.contactPerson && (
                    <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3 h-3" /> {errors.contactPerson}
                    </p>
                  )}
                </div>

                {/* Primary Contact No + */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Contact No + (Primary) <span className="text-rose-500">*</span></span>
                    <span className="text-[10px] text-slate-400 font-normal">Supports + country code</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="+91 999556677 or 999556677"
                      value={formData.contactNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactNo: e.target.value }))}
                      className={`w-full pl-9 pr-3 py-2 text-xs font-mono font-medium rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-3xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                        errors.contactNo ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                  </div>
                  {errors.contactNo && (
                    <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3 h-3" /> {errors.contactNo}
                    </p>
                  )}
                </div>
              </div>

              {/* Add-on Contact Numbers Feature */}
              <div className="mt-4 p-3.5 bg-slate-50/80 dark:bg-slate-950/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Contact No + (Add-on Numbers)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Add additional phone / mobile numbers
                    </span>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddContact}
                    variant="outline"
                    className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 inline-flex items-center gap-1 shadow-3xs"
                  >
                    <Plus className="w-3 h-3" /> Add More Contact No
                  </Button>
                </div>

                <div className="space-y-2">
                  {formData.additionalContacts.map((contact, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-400">
                          #{index + 1}
                        </span>
                        <input
                          type="text"
                          placeholder={`Alternate Contact No + (${index === 0 ? 'e.g. 889955541' : 'e.g. +91 9876543210'})`}
                          value={contact}
                          onChange={(e) => handleContactChange(index, e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-3xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(index)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-transparent hover:border-rose-200 transition-all cursor-pointer shrink-0"
                        title="Remove this number"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {formData.additionalContacts.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">No additional numbers added yet. Click "+ Add More Contact No" above if needed.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Address, Website & Remarks */}
            <div>
              <div className="flex items-center gap-2 pb-2.5 mb-4 border-b border-slate-100 dark:border-slate-800">
                <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  3. Address & Web Presence
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Address (Free Text) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Address (Free Text) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter complete office/factory address (e.g. 9/456/ Ram Street, Madurai)..."
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-3xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none ${
                      errors.address ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {errors.address && (
                    <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3 h-3" /> {errors.address}
                    </p>
                  )}
                </div>

                {/* Website (Free Text) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Website (Free Text)
                  </label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="www.bioindia.com or https://company.com"
                      value={formData.website}
                      onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-3xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                    />
                  </div>

                  {/* Remarks (Free Text) */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Remarks / Notes
                    </label>
                    <input
                      type="text"
                      placeholder="Optional notes or supplier requirements..."
                      value={formData.remarks}
                      onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-3xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Attachments (Multiple file upload) */}
            <div>
              <div className="flex items-center justify-between pb-2.5 mb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    4. Attachments (Att 1 / Att 2 / Multiple)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {formData.attachments.length} file(s) attached
                </span>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-2xl p-4 sm:p-6 text-center transition-all bg-slate-50/50 dark:bg-slate-950/30 group">
                <input
                  type="file"
                  id="multiAttachmentInput"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                />
                <label
                  htmlFor="multiAttachmentInput"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                      Click to upload attachments
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400"> or drag and drop files here</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Supports multiple files: Images (PNG, JPG), PDF documents, Excel spreadsheets, Word files (up to 20MB each)
                  </p>
                </label>
              </div>

              {/* Attached Files List */}
              {formData.attachments.length > 0 && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {formData.attachments.map((att, idx) => (
                    <div
                      key={att.id || idx}
                      className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-3xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-[10px]">
                          Att {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={att.name}>
                            {att.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Uploaded file'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer shrink-0"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Action Buttons Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/company-directory')}
            className="w-full sm:w-auto h-10 px-4 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel / Back to List
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isEditMode && (
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={(e) => handleSubmit(e, true)}
                variant="outline"
                className="flex-1 sm:flex-none h-10 px-4 text-xs font-semibold rounded-xl border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 shadow-3xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Save & Add Another
              </Button>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 sm:flex-none h-10 px-6 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  {isEditMode ? 'Update Record' : 'Save Company Details'}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
