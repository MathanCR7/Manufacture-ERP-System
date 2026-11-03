import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { 
  Shield, Plus, Edit, UserX, UserCheck, Key, MapPin, 
  Search, Users, Activity, Lock, Unlock, Calendar, 
  Eye, EyeOff, Sparkles, Filter, RefreshCw, X, AlertCircle, Info, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, RotateCcw,
  Phone, User, Heart, CreditCard, Building, FileText, Upload,
  Image as ImageIcon, DollarSign, Clock, Check, Download, ExternalLink,
  Paperclip, Camera, Copy, CheckCircle2, Navigation, Compass, FileCheck
} from 'lucide-react';
import { format } from 'date-fns';
import Swal from 'sweetalert2';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import Pagination from '@/components/ui/Pagination';

// Helper to resolve backend upload URLs
export const getFileUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const serverOrigin = apiBase.replace(/\/api\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${serverOrigin}${cleanPath}`;
};

// Reusable Searchable Dropdown with embedded Search Bar
function SearchableSelect({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Select...", 
  searchPlaceholder = "Search...", 
  className = "",
  disabled = false 
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt.replace(/_/g, ' ') };
      }
      return opt;
    });
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return normalizedOptions;
    const lower = search.toLowerCase();
    return normalizedOptions.filter(opt => 
      (opt.label || opt.value || '').toLowerCase().includes(lower)
    );
  }, [normalizedOptions, search]);

  const selectedItem = useMemo(() => {
    return normalizedOptions.find(o => o.value === value);
  }, [normalizedOptions, value]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full h-11 px-3 text-left bg-slate-50/50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl flex items-center justify-between text-xs font-medium hover:border-indigo-400 transition-colors cursor-pointer ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      >
        <span className={value ? "font-bold text-slate-900 dark:text-slate-100 uppercase" : "text-slate-400"}>
          {selectedItem ? selectedItem.label : placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-2 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 bg-slate-50/70 dark:bg-slate-950/40">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full text-xs bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50 dark:divide-slate-850">
            {filteredOptions.length === 0 ? (
              <div className="py-3 px-2 text-center text-xs text-slate-400">
                No matching results
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-semibold uppercase">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const INITIAL_FORM_DATA = {
  name: '',
  emails: [''],
  email: '',
  password: '',
  role: '',
  ipAddress: '',
  empId: 'VTE000001',
  contacts: ['+91 '],
  contactNo: '+91 ',
  secondaryContact: '',
  dob: '',
  doj: '',
  gender: '',
  bloodGroup: '',
  fatherName: '',
  fatherContact: '+91 ',
  motherName: '',
  motherContact: '',
  husbandName: '',
  husbandContact: '',
  spouseName: '',
  spouseContact: '',
  presentAddress: '',
  presentAddressProof: '',
  permanentAddress: '',
  permanentAddressProof: '',
  aadhar: '',
  aadharDoc: '',
  pan: '',
  panDoc: '',
  epfoNo: '',
  esiNo: '',
  bankAccountName: '',
  bankName: '',
  bankAccountNo: '',
  bankBranch: '',
  bankIfsc: '',
  bankProof: '',
  familyRemarks: '',
  familyDoc: '',
  grossPay: '',
  yearlyCtc: '',
  workingHours: '8 hrs/day',
  profilePhoto: '',
  selfiePhoto: '',
  selfieLocation: '',
  cv: '',
  familyPhotos: [],
  attachments: []
};

// Reusable Document / Proof Upload Field component for (Attac: X / XX)
function ProofUploadButton({ label, value, onUpload, onRemove, accept = "image/*,.pdf" }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'File too large', text: 'Attachment must be under 15MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onUpload(reader.result, file.name);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isPdf = value && (value.includes('.pdf') || value.startsWith('data:application/pdf'));

  return (
    <div className="flex items-center gap-2 mt-1">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept={accept} 
        className="hidden" 
      />
      {value ? (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
          <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold text-emerald-700 dark:text-emerald-300 truncate max-w-[150px]">
            {label} Attached
          </span>
          <a
            href={getFileUrl(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded text-emerald-700 dark:text-emerald-300 transition-colors"
            title="View Attachment"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded text-rose-600 transition-colors cursor-pointer"
            title="Remove Attachment"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-medium transition-all cursor-pointer"
          title={`Upload ${label}`}
        >
          <Paperclip className="w-3.5 h-3.5" />
          <span>Attach {label} (X)</span>
        </button>
      )}
    </div>
  );
}

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [selectedEnlargedPhoto, setSelectedEnlargedPhoto] = useState(null);
  const [isCapturingGeo, setIsCapturingGeo] = useState(false);
  
  // File input refs
  const profilePhotoInputRef = useRef(null);
  const selfiePhotoInputRef = useRef(null);
  const cvInputRef = useRef(null);
  const familyPhotosInputRef = useRef(null);
  const attachmentsInputRef = useRef(null);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('name_asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRole, selectedStatus, sortBy, itemsPerPage]);

  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    }
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      try {
        const response = await api.get('/roles');
        return response.data;
      } catch (err) {
        console.error('Failed to fetch roles', err);
        return null;
      }
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/users', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreating(false);
      setFormData(INITIAL_FORM_DATA);
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: 'Employee Registered!',
        text: 'The new employee master record has been created successfully.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg'
        }
      });
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: 'Registration Failed',
        text: err.response?.data?.message || 'Error creating employee record',
        icon: 'error',
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg'
        }
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const payload = { ...data };
      if (!payload.password) {
        delete payload.password;
      }
      if (payload.ipAddress === '') {
        payload.ipAddress = null;
      }
      const response = await api.patch(`/users/${id}`, payload);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (viewingUser && viewingUser.id === updated.id) {
        setViewingUser(updated);
      }
      setEditingUser(null);
      setFormData(INITIAL_FORM_DATA);
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: 'Employee Updated!',
        text: 'Employee Master details have been updated successfully.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg'
        }
      });
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: 'Update Failed',
        text: err.response?.data?.message || 'Error updating employee details',
        icon: 'error',
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg'
        }
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/users/${id}?permanent=true`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: 'Employee Deleted!',
        text: 'The employee record has been permanently removed.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg'
        }
      });
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: 'Delete Failed',
        text: err.response?.data?.message || err.message || 'Could not delete employee record.',
        icon: 'error',
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg'
        }
      });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }) => {
      const response = await api.patch(`/users/${id}`, { isActive: !isActive });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: variables.isActive ? 'User Deactivated' : 'User Activated',
        text: `The user account has been ${variables.isActive ? 'deactivated' : 'activated'} successfully.`,
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg'
        }
      });
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: 'Action Failed',
        text: err.response?.data?.message || 'Failed to update user status',
        icon: 'error',
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg'
        }
      });
    }
  });

  // Running number generation helper defaulting to VTE000001
  const handleFetchNextEmpId = async () => {
    try {
      const res = await api.get('/users/next-empid');
      if (res.data?.nextEmpId) {
        return res.data.nextEmpId;
      }
    } catch {
      // fallback calculation from current users list
      let maxNum = 0;
      (users || []).forEach(u => {
        if (!u.empId) return;
        const match = u.empId.match(/^VTE-?(\d+)/i) || u.empId.match(/(\d+)$/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      });
      return `VTE${String(maxNum + 1).padStart(6, '0')}`;
    }
    return 'VTE000001';
  };

  const handleAddUserClick = async () => {
    const nextId = await handleFetchNextEmpId();
    setIsCreating(true);
    setEditingUser(null);
    setActiveTab('basic');
    setFormData({
      ...INITIAL_FORM_DATA,
      empId: nextId
    });
  };

  const handleEditClick = (user) => {
    setEditingUser(user);
    setIsCreating(false);
    setActiveTab('basic');

    // Parse contacts (Primary and optional Secondary)
    let primContact = user.contactNo || '+91 ';
    let secContact = '';
    if (Array.isArray(user.contacts) && user.contacts.length > 0) {
      primContact = user.contacts[0] || '+91 ';
      secContact = user.contacts[1] || '';
    }

    // Parse single login email
    const singleEmail = user.email || (Array.isArray(user.emails) ? user.emails[0] : '') || '';

    setFormData({
      name: (user.name || '').toUpperCase(),
      email: singleEmail,
      emails: [singleEmail],
      password: '',
      role: user.role || '',
      ipAddress: user.ipAddress || '',
      empId: user.empId || '',
      contactNo: primContact,
      secondaryContact: secContact,
      contacts: [primContact, secContact].filter(Boolean),
      dob: user.dob ? String(user.dob).substring(0, 10) : '',
      doj: user.doj ? String(user.doj).substring(0, 10) : '',
      gender: user.gender || '',
      bloodGroup: user.bloodGroup || '',
      fatherName: user.fatherName || '',
      fatherContact: user.fatherContact || '+91 ',
      motherName: user.motherName || '',
      motherContact: user.motherContact || '',
      husbandName: user.husbandName || '',
      husbandContact: user.husbandContact || '',
      spouseName: user.spouseName || '',
      spouseContact: user.spouseContact || '',
      presentAddress: user.presentAddress || '',
      presentAddressProof: user.presentAddressProof || '',
      permanentAddress: user.permanentAddress || '',
      permanentAddressProof: user.permanentAddressProof || '',
      aadhar: user.aadhar || '',
      aadharDoc: user.aadharDoc || '',
      pan: user.pan || '',
      panDoc: user.panDoc || '',
      epfoNo: user.epfoNo || '',
      esiNo: user.esiNo || '',
      bankAccountName: user.bankAccountName || '',
      bankName: user.bankName || '',
      bankAccountNo: user.bankAccountNo || '',
      bankBranch: user.bankBranch || '',
      bankIfsc: user.bankIfsc || '',
      bankProof: user.bankProof || '',
      familyRemarks: user.familyRemarks || '',
      familyDoc: user.familyDoc || '',
      grossPay: user.grossPay !== null && user.grossPay !== undefined ? String(user.grossPay) : '',
      yearlyCtc: user.yearlyCtc !== null && user.yearlyCtc !== undefined ? String(user.yearlyCtc) : '',
      workingHours: user.workingHours || '8 hrs/day',
      profilePhoto: user.profilePhoto || '',
      selfiePhoto: user.selfiePhoto || '',
      selfieLocation: user.selfieLocation || '',
      cv: user.cv || '',
      familyPhotos: Array.isArray(user.familyPhotos) ? user.familyPhotos : [],
      attachments: Array.isArray(user.attachments) ? user.attachments : []
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingUser(null);
    setFormData(INITIAL_FORM_DATA);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Check Mandatory Validations (Man: x)
    if (!formData.name?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Missing Required Field', text: 'Name is mandatory.' });
      setActiveTab('basic');
      return;
    }
    const cleanPrimaryContact = (formData.contacts?.[0] || formData.contactNo || '').trim();
    if (!cleanPrimaryContact || cleanPrimaryContact === '+91' || cleanPrimaryContact === '+91 ') {
      Swal.fire({ icon: 'warning', title: 'Missing Required Field', text: 'Contact No is mandatory.' });
      setActiveTab('basic');
      return;
    }
    if (!formData.profilePhoto) {
      Swal.fire({ icon: 'warning', title: 'Missing Required Field', text: 'Employee Photo is mandatory (Photos).' });
      setActiveTab('basic');
      return;
    }
    if (!formData.dob) {
      Swal.fire({ icon: 'warning', title: 'Missing Required Field', text: 'Date of Birth (DOB) is mandatory.' });
      setActiveTab('basic');
      return;
    }
    if (!formData.doj) {
      Swal.fire({ icon: 'warning', title: 'Missing Required Field', text: 'Date of Joining (DOJ) is mandatory.' });
      setActiveTab('basic');
      return;
    }
    if (!formData.gender) {
      Swal.fire({ icon: 'warning', title: 'Missing Required Field', text: 'Sex / Gender is mandatory.' });
      setActiveTab('basic');
      return;
    }
    if (!formData.bloodGroup) {
      Swal.fire({ icon: 'warning', title: 'Missing Required Field', text: 'Blood Group is mandatory.' });
      setActiveTab('basic');
      return;
    }
    if (!formData.fatherName?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Missing Required Field', text: 'Father Name is mandatory.' });
      setActiveTab('family');
      return;
    }
    const cleanFatherContact = (formData.fatherContact || '').trim();
    if (!cleanFatherContact || cleanFatherContact === '+91' || cleanFatherContact === '+91 ') {
      Swal.fire({ icon: 'warning', title: 'Missing Required Field', text: 'Emergency Contact No (Father) is mandatory.' });
      setActiveTab('family');
      return;
    }

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Primary & Secondary Contact Handlers (exactly 2 fields)
  const handlePrimaryContactChange = (val) => {
    setFormData(prev => {
      const sec = prev.secondaryContact ? [prev.secondaryContact] : [];
      return {
        ...prev,
        contactNo: val,
        contacts: [val, ...sec].filter(Boolean)
      };
    });
  };

  const handleSecondaryContactChange = (val) => {
    setFormData(prev => {
      const prim = prev.contactNo || '+91 ';
      return {
        ...prev,
        secondaryContact: val,
        contacts: [prim, val].filter(Boolean)
      };
    });
  };

  // Single Login Email Handler
  const handleSingleEmailChange = (val) => {
    setFormData(prev => ({
      ...prev,
      email: val,
      emails: [val].filter(Boolean)
    }));
  };

  // Profile photo upload handler (XX)
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'File too large', text: 'Photo must be under 8MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, profilePhoto: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // Selfie photo upload handler
  const handleSelfieUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, selfiePhoto: reader.result }));
      // Auto capture GPS location if not present
      if (!formData.selfieLocation) {
        handleCaptureLocation();
      }
    };
    reader.readAsDataURL(file);
  };

  // GPS Location capture handler
  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      Swal.fire({ icon: 'warning', title: 'Geolocation Not Supported', text: 'Your browser does not support geolocation.' });
      return;
    }
    setIsCapturingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsCapturingGeo(false);
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const loc = `Lat: ${lat}, Lng: ${lng} (${new Date().toLocaleTimeString()})`;
        setFormData(prev => ({ ...prev, selfieLocation: loc }));
        Swal.fire({
          icon: 'success',
          title: 'Location Captured',
          text: loc,
          toast: true,
          position: 'top-end',
          timer: 3000,
          showConfirmButton: false
        });
      },
      (err) => {
        setIsCapturingGeo(false);
        Swal.fire({ icon: 'error', title: 'Location Error', text: err.message || 'Unable to retrieve current location.' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // CV upload handler (X)
  const handleCvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'File too large', text: 'CV must be under 15MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, cv: reader.result }));
    };
    reader.readAsDataURL(file);
    if (cvInputRef.current) cvInputRef.current.value = '';
  };

  // Family photos upload handler (multiple allowed - X)
  const handleFamilyPhotosUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(file => {
      if (file.size > 8 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => {
        setFormData(prev => ({
          ...prev,
          familyPhotos: [
            ...(prev.familyPhotos || []),
            { url: reader.result, name: file.name, size: file.size }
          ]
        }));
      };
      reader.readAsDataURL(file);
    });
    if (familyPhotosInputRef.current) familyPhotosInputRef.current.value = '';
  };

  const handleRemoveFamilyPhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      familyPhotos: (prev.familyPhotos || []).filter((_, i) => i !== index)
    }));
  };

  // Attachments upload handler (XXXXX)
  const handleAttachmentsUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(file => {
      if (file.size > 20 * 1024 * 1024) {
        Swal.fire({ icon: 'warning', title: 'File too large', text: `${file.name} is larger than 20MB` });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setFormData(prev => ({
          ...prev,
          attachments: [
            ...(prev.attachments || []),
            {
              name: file.name,
              size: file.size,
              type: file.type || 'application/octet-stream',
              url: reader.result,
              uploadedAt: new Date().toISOString()
            }
          ]
        }));
      };
      reader.readAsDataURL(file);
    });
    if (attachmentsInputRef.current) attachmentsInputRef.current.value = '';
  };

  const handleRemoveAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== index)
    }));
  };

  const handleCopyAddress = () => {
    setFormData(prev => ({
      ...prev,
      permanentAddress: prev.presentAddress
    }));
  };

  const handleGrossPayChange = (val) => {
    const num = parseFloat(val);
    setFormData(prev => ({
      ...prev,
      grossPay: val,
      yearlyCtc: !isNaN(num) && num > 0 ? String(Math.round(num * 12)) : prev.yearlyCtc
    }));
  };

  const ROLES_FALLBACK = [
    'MAIN_MASTER',
    'SUPERVISOR',
    'PURCHASE_ACCOUNTANT',
    'MATERIALS_RECEIVER',
    'LAB_ASSISTANT',
    'SALES_TEAM',
    'PRODUCTION_STAFF'
  ];

  const availableRoles = rolesData && rolesData.length > 0
    ? rolesData.map(r => r.name)
    : ROLES_FALLBACK;

  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter(u => u.isActive).length || 0;
  const ipLockedUsers = users?.filter(u => u.ipAddress && u.ipAddress.trim() !== '').length || 0;
  const adminUsers = users?.filter(u => u.role === 'MAIN_MASTER' || u.role === 'SUPERVISOR').length || 0;

  const sortedAndFiltered = useMemo(() => {
    let result = (users || []).filter(user => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || (
        (user.name || '').toLowerCase().includes(term) ||
        (user.email || '').toLowerCase().includes(term) ||
        (user.empId || '').toLowerCase().includes(term) ||
        (user.role || '').toLowerCase().includes(term) ||
        (user.contactNo || '').toLowerCase().includes(term) ||
        (user.ipAddress || '').toLowerCase().includes(term)
      );
      
      const matchesRole = selectedRole === 'ALL' || user.role === selectedRole;
      const matchesStatus = 
        selectedStatus === 'ALL' || 
        (selectedStatus === 'ACTIVE' && user.isActive) ||
        (selectedStatus === 'INACTIVE' && !user.isActive);
        
      return matchesSearch && matchesRole && matchesStatus;
    });

    result.sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
      if (sortBy === 'empId_asc') return (a.empId || '').localeCompare(b.empId || '', undefined, { numeric: true, sensitivity: 'base' });
      if (sortBy === 'empId_desc') return (b.empId || '').localeCompare(a.empId || '', undefined, { numeric: true, sensitivity: 'base' });
      if (sortBy === 'role_asc') return (a.role || '').localeCompare(b.role || '', undefined, { sensitivity: 'base' });
      if (sortBy === 'role_desc') return (b.role || '').localeCompare(a.role || '', undefined, { sensitivity: 'base' });
      if (sortBy === 'status_active') return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
      if (sortBy === 'status_inactive') return (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
      if (sortBy === 'latest') return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      if (sortBy === 'oldest') return (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return 0;
    });

    return result;
  }, [users, searchTerm, selectedRole, selectedStatus, sortBy]);

  const totalPages = Math.ceil(sortedAndFiltered.length / itemsPerPage) || 1;
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFiltered.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFiltered, currentPage, itemsPerPage]);

  const handleToggleSortName = () => {
    setSortBy(prev => (prev === 'name_asc' ? 'name_desc' : 'name_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortEmpId = () => {
    setSortBy(prev => (prev === 'empId_asc' ? 'empId_desc' : 'empId_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortRole = () => {
    setSortBy(prev => (prev === 'role_asc' ? 'role_desc' : 'role_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortStatus = () => {
    setSortBy(prev => (prev === 'status_active' ? 'status_inactive' : 'status_active'));
    setCurrentPage(1);
  };

  const handleToggleSortDate = () => {
    setSortBy(prev => (prev === 'latest' ? 'oldest' : 'latest'));
    setCurrentPage(1);
  };

  const isFilterActive = searchTerm || selectedRole !== 'ALL' || selectedStatus !== 'ALL' || sortBy !== 'name_asc';

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedRole('ALL');
    setSelectedStatus('ALL');
    setSortBy('name_asc');
    setCurrentPage(1);
  };

  const getAvatarGradient = (name) => {
    const colors = [
      'from-pink-500/20 to-rose-500/20 text-rose-400 border-rose-500/30',
      'from-purple-500/20 to-indigo-500/20 text-indigo-400 border-indigo-500/30',
      'from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'from-emerald-500/20 to-teal-500/20 text-teal-400 border-teal-500/30',
      'from-amber-500/20 to-orange-500/20 text-orange-400 border-orange-500/30',
      'from-violet-500/20 to-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30'
    ];
    let sum = 0;
    for (let i = 0; i < (name || '').length; i++) {
      sum += (name || '').charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  const getInitials = (name) => {
    if (!name) return 'VT';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getRoleBadgeStyle = (role) => {
    const r = (role || '').toUpperCase();
    if (r.includes('MASTER') || r.includes('ADMIN')) return 'bg-amber-500/10 text-amber-500 border-amber-500/25';
    if (r.includes('SUPERVISOR')) return 'bg-violet-500/10 text-violet-500 border-violet-500/25';
    if (r.includes('ACCOUNTANT') || r.includes('FINANCE')) return 'bg-blue-500/10 text-blue-500 border-blue-500/25';
    if (r.includes('RECEIVER') || r.includes('INVENTORY') || r.includes('MATERIALS')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25';
    if (r.includes('ASSISTANT') || r.includes('LAB') || r.includes('QC')) return 'bg-rose-500/10 text-rose-500 border-rose-500/25';
    if (r.includes('PRODUCTION') || r.includes('STAFF')) return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/25';
    if (r.includes('SALES') || r.includes('TEAM')) return 'bg-pink-500/10 text-pink-500 border-pink-500/25';
    return 'bg-slate-500/10 text-slate-500 border-slate-500/25';
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl dark:bg-indigo-500/20 dark:text-indigo-400">
              <Shield className="w-6 h-6" />
            </div>
            Employee Master & User Configuration
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Running ID sequence (<strong className="text-indigo-600 dark:text-indigo-400 font-mono">VTE000001</strong>), mandatory validations (Man: x), per-field document proofs (Attac: X / XX), multi-contacts (++), and GPS-tagged selfie verification.
          </p>
        </div>
        {!isCreating && !editingUser && (
          <Button 
            onClick={handleAddUserClick} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all font-semibold flex items-center gap-2 h-11 px-5 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Add Employee
          </Button>
        )}
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Staff</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                {isLoading ? <Skeleton className="h-8 w-12" /> : totalUsers}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Employees</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 text-emerald-600">
                {isLoading ? <Skeleton className="h-8 w-12" /> : activeUsers}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">IP Restricted</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 text-amber-600">
                {isLoading ? <Skeleton className="h-8 w-12" /> : ipLockedUsers}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-400">
              <Lock className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Administrators</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 text-rose-600">
                {isLoading ? <Skeleton className="h-8 w-12" /> : adminUsers}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-400">
              <Shield className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Unified Create / Edit Employee Form Section */}
      {(isCreating || editingUser) && (
        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100 dark:border-transparent">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {editingUser ? `Edit Employee Master: ${editingUser.name}` : 'New Employee Master Registration'}
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                    {formData.empId || 'VTE000001'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Fields marked with <span className="text-rose-500 font-bold">* (Man: x)</span> are mandatory. Multi-entry fields allow adding multiple values with <span className="font-bold text-indigo-600">(++)</span>.
                </p>
              </div>
            </div>
            <button 
              onClick={handleCancel} 
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Tabs Navigation */}
          <div className="flex flex-wrap gap-2 pb-4 mb-6 border-b border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'basic'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <User className="w-4 h-4" />
              <span>1. Basic Profile & Photos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('family')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'family'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Heart className="w-4 h-4" />
              <span>2. Family & Emergency Contacts</span>
              {formData.familyPhotos?.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white">
                  {formData.familyPhotos.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('address_kyc')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'address_kyc'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>3. Address & Statutory Proofs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('banking_salary')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'banking_salary'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>4. Banking & Compensation</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('attachments')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'attachments'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Paperclip className="w-4 h-4" />
              <span>5. CV & Multi-Attachments</span>
              {(formData.attachments?.length > 0 || formData.cv) && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white">
                  {(formData.attachments?.length || 0) + (formData.cv ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            {/* TAB 1: BASIC PROFILE */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                {/* Photo & Selfie Strip */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Employee Profile Photo (XX - Mandatory) */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 flex items-center gap-4">
                    <div className="relative group shrink-0">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-md bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                        {formData.profilePhoto ? (
                          <img 
                            src={getFileUrl(formData.profilePhoto)} 
                            alt="Employee Photo" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 text-xs">
                            <Camera className="w-7 h-7 mb-0.5 text-indigo-400" />
                            <span className="text-[10px] font-bold">Photo (XX)*</span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => profilePhotoInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-all cursor-pointer"
                        title="Upload Employee Photo"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                      <input 
                        type="file" 
                        ref={profilePhotoInputRef} 
                        onChange={handlePhotoUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                          Photos <span className="text-rose-500 font-bold">* (Man: x | Attac: XX)</span>
                        </h4>
                        {formData.profilePhoto && (
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, profilePhoto: '' }))}
                            className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Official portrait photo for identity card. Saved under employee uploads folder.
                      </p>
                    </div>
                  </div>

                  {/* Selfie Photo with Current Location */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 flex items-center gap-4">
                    <div className="relative group shrink-0">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-md bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                        {formData.selfiePhoto ? (
                          <img 
                            src={getFileUrl(formData.selfiePhoto)} 
                            alt="Selfie" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 text-xs">
                            <Navigation className="w-7 h-7 mb-0.5 text-indigo-400" />
                            <span className="text-[10px]">Selfie</span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => selfiePhotoInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-slate-800 text-white shadow-md hover:bg-slate-900 transition-all cursor-pointer"
                        title="Upload Selfie"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                      <input 
                        type="file" 
                        ref={selfiePhotoInputRef} 
                        onChange={handleSelfieUpload} 
                        accept="image/*" 
                        capture="user"
                        className="hidden" 
                      />
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-indigo-500" />
                        Selfie Photo with Current Location
                      </h4>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleCaptureLocation}
                          disabled={isCapturingGeo}
                          className="h-7 px-2.5 text-[11px] rounded-lg border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 cursor-pointer"
                        >
                          <Navigation className="w-3 h-3" />
                          {isCapturingGeo ? 'Fetching GPS...' : 'Capture GPS Location'}
                        </Button>
                      </div>
                      {formData.selfieLocation && (
                        <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                          📍 {formData.selfieLocation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Employee ID - Running no (VTE000001) - Read Only */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs flex items-center gap-1.5">
                        <span>Employee ID (Running No)</span>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Read Only
                        </span>
                      </Label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">#</span>
                      <Input 
                        disabled
                        readOnly
                        value={formData.empId} 
                        placeholder="VTE000001" 
                        className="pl-9 bg-slate-100 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-indigo-700 dark:text-indigo-400 rounded-xl h-11 font-mono font-bold tracking-wider cursor-not-allowed opacity-90"
                      />
                    </div>
                  </div>

                  {/* Name (Mandatory: ALL CAPITAL) */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs flex items-center justify-between">
                      <span>Full Name <span className="text-rose-500 font-bold">*</span></span>
                      <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">Always Capital</span>
                    </Label>
                    <div className="relative">
                      <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input 
                        required 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} 
                        placeholder="ARUN KUMAR" 
                        className="pl-9 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 text-slate-900 dark:text-white rounded-xl h-11 font-bold uppercase tracking-wide"
                      />
                    </div>
                  </div>

                  {/* Designation / Role with Search Bar */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">
                      Designation Role *
                    </Label>
                    <SearchableSelect 
                      options={availableRoles}
                      value={formData.role}
                      onChange={val => setFormData({ ...formData, role: val })}
                      placeholder="Select official role"
                      searchPlaceholder="Search designation roles..."
                    />
                  </div>

                  {/* Contact Numbers (Primary & Secondary Only) */}
                  <div className="space-y-3 md:col-span-2 lg:col-span-3 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-indigo-500" />
                        Mobile Numbers
                        <span className="text-slate-400 font-normal ml-1 text-[11px]">(Primary Required, Secondary Optional)</span>
                      </Label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          Primary Mobile Number <span className="text-rose-500 font-bold">*</span>
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-indigo-600 font-mono">#1</span>
                          <Input 
                            required
                            value={formData.contactNo} 
                            onChange={e => handlePrimaryContactChange(e.target.value)} 
                            placeholder="+91 99945 56698" 
                            className="pl-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl h-10 font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          Secondary Mobile Number <span className="text-slate-400 text-[10px]">(Optional)</span>
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 font-mono">#2</span>
                          <Input 
                            value={formData.secondaryContact || ''} 
                            onChange={e => handleSecondaryContactChange(e.target.value)} 
                            placeholder="+91 98421 23456" 
                            className="pl-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl h-10 font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Single Email Address for Login */}
                  <div className="space-y-2 md:col-span-2 lg:col-span-3 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5">
                        <span className="font-bold text-xs text-indigo-500">@</span>
                        Email Address (Login ID) <span className="text-rose-500 font-bold">*</span>
                      </Label>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Single email used for login page</span>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">@</span>
                      <Input 
                        required
                        type="email"
                        value={formData.email} 
                        onChange={e => handleSingleEmailChange(e.target.value)} 
                        placeholder="official.email@kulfierp.com" 
                        className="pl-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl h-11 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">
                      {editingUser ? 'New Password (Optional)' : 'Login Password *'}
                    </Label>
                    <div className="relative">
                      <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input 
                        required={!editingUser} 
                        type={showPassword ? "text" : "password"} 
                        autoComplete="new-password"
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                        placeholder={editingUser ? "•••••••• (Leave blank to keep)" : "••••••••"} 
                        className="pl-9 pr-10 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 text-slate-900 dark:text-white rounded-xl h-11" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white focus:outline-none transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* DOB (Mandatory: x) */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">
                      Date of Birth (DOB) <span className="text-rose-500 font-bold">* (Man: x)</span>
                    </Label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <Input 
                        required
                        type="date"
                        value={formData.dob} 
                        onChange={e => setFormData({...formData, dob: e.target.value})} 
                        className="pl-9 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 text-slate-900 dark:text-white rounded-xl h-11"
                      />
                    </div>
                  </div>

                  {/* DOJ (Mandatory: x) */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">
                      Date of Joining (DOJ) <span className="text-rose-500 font-bold">* (Man: x)</span>
                    </Label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <Input 
                        required
                        type="date"
                        value={formData.doj} 
                        onChange={e => setFormData({...formData, doj: e.target.value})} 
                        className="pl-9 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 text-slate-900 dark:text-white rounded-xl h-11"
                      />
                    </div>
                  </div>

                  {/* Sex / Gender (Mandatory: x) with Search */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">
                      Sex / Gender <span className="text-rose-500 font-bold">* (Man: x)</span>
                    </Label>
                    <SearchableSelect
                      options={['Male', 'Female', 'Other']}
                      value={formData.gender}
                      onChange={val => setFormData({ ...formData, gender: val })}
                      placeholder="Select Sex"
                      searchPlaceholder="Search gender..."
                    />
                  </div>

                  {/* Blood Group (Mandatory: x) with Search */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">
                      Blood Group <span className="text-rose-500 font-bold">* (Man: x)</span>
                    </Label>
                    <SearchableSelect
                      options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']}
                      value={formData.bloodGroup}
                      onChange={val => setFormData({ ...formData, bloodGroup: val })}
                      placeholder="Select Blood Group"
                      searchPlaceholder="Search blood group..."
                    />
                  </div>

                  {/* Working Hours */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">Working Hours</Label>
                    <div className="relative">
                      <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input 
                        value={formData.workingHours} 
                        onChange={e => setFormData({...formData, workingHours: e.target.value})} 
                        placeholder="8 hrs/day" 
                        className="pl-9 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 text-slate-900 dark:text-white rounded-xl h-11"
                      />
                    </div>
                  </div>

                  {/* IP Restriction */}
                  <div className="space-y-2 md:col-span-2 lg:col-span-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">IP Address Restriction Lock (Optional)</Label>
                    </div>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input 
                        value={formData.ipAddress} 
                        onChange={e => setFormData({...formData, ipAddress: e.target.value})} 
                        placeholder="e.g. 192.168.1.100 (Leave blank for unrestricted access)"
                        className="pl-9 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 text-slate-900 dark:text-white rounded-xl h-11" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: FAMILY DETAILS & PHOTOS */}
            {activeTab === 'family' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Father Name & Emer. Contact (Mandatory: x) */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/40 border-2 border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-indigo-500" /> Father Details
                      </h4>
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        * Mandatory (Man: x)
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Father Name *</Label>
                      <Input 
                        required
                        value={formData.fatherName} 
                        onChange={e => setFormData({...formData, fatherName: e.target.value})} 
                        placeholder="Father Full Name" 
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Emer. Contact No *</Label>
                      <Input 
                        required
                        value={formData.fatherContact} 
                        onChange={e => setFormData({...formData, fatherContact: e.target.value})} 
                        placeholder="+91 Emer. Contact No" 
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-mono font-medium"
                      />
                    </div>
                  </div>

                  {/* Mother Name & Emer. Contact */}
                  <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-pink-500" /> Mother Details
                    </h4>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Mother Name</Label>
                      <Input 
                        value={formData.motherName} 
                        onChange={e => setFormData({...formData, motherName: e.target.value})} 
                        placeholder="Mother Full Name" 
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Emer. Contact No</Label>
                      <Input 
                        value={formData.motherContact} 
                        onChange={e => setFormData({...formData, motherContact: e.target.value})} 
                        placeholder="+91 Emer. Contact No" 
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Husband Name & Emer. Contact */}
                  <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Heart className="w-3.5 h-3.5 text-rose-500" /> Husband Details
                    </h4>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Husband Name</Label>
                      <Input 
                        value={formData.husbandName} 
                        onChange={e => setFormData({...formData, husbandName: e.target.value})} 
                        placeholder="Husband Full Name" 
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Emer. Contact No</Label>
                      <Input 
                        value={formData.husbandContact} 
                        onChange={e => setFormData({...formData, husbandContact: e.target.value})} 
                        placeholder="+91 Emer. Contact No" 
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Spouse Name & Emer. Contact */}
                  <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Heart className="w-3.5 h-3.5 text-purple-500" /> Spouse Details
                    </h4>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Spouse Name</Label>
                      <Input 
                        value={formData.spouseName} 
                        onChange={e => setFormData({...formData, spouseName: e.target.value})} 
                        placeholder="Spouse Full Name" 
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Emer. Contact No</Label>
                      <Input 
                        value={formData.spouseContact} 
                        onChange={e => setFormData({...formData, spouseContact: e.target.value})} 
                        placeholder="+91 Emer. Contact No" 
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Remarks on Family Details (Attac: X) */}
                <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">
                      Remarks Box on family Details :- (e.g., &quot;Family 2 Kids and wife works in IT, etc…&quot;)
                    </Label>
                    <ProofUploadButton 
                      label="Family Doc" 
                      value={formData.familyDoc}
                      onUpload={(val) => setFormData(prev => ({ ...prev, familyDoc: val }))}
                      onRemove={() => setFormData(prev => ({ ...prev, familyDoc: '' }))}
                    />
                  </div>
                  <textarea
                    rows={3}
                    value={formData.familyRemarks}
                    onChange={e => setFormData({...formData, familyRemarks: e.target.value})}
                    placeholder="Remarks Box on family Details :- Family 2 Kids and wife works in IT, etc…"
                    className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Family Photos Section (Attac: X) */}
                <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-indigo-500" /> Family Photos <span className="text-indigo-600 font-bold text-xs">(Attac: X)</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Upload family pictures or dependent portraits.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => familyPhotosInputRef.current?.click()}
                      className="rounded-xl border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Add Family Photos (X)
                    </Button>
                    <input 
                      type="file" 
                      multiple 
                      ref={familyPhotosInputRef} 
                      onChange={handleFamilyPhotosUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>

                  {formData.familyPhotos && formData.familyPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {formData.familyPhotos.map((photo, idx) => {
                        const url = typeof photo === 'string' ? photo : photo.url;
                        return (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-square bg-slate-100 dark:bg-slate-900">
                            <img 
                              src={getFileUrl(url)} 
                              alt={`Family ${idx + 1}`} 
                              className="w-full h-full object-cover" 
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedEnlargedPhoto(getFileUrl(url))}
                                className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-900 text-xs cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveFamilyPhoto(idx)}
                                className="p-1.5 rounded-lg bg-rose-600 text-white text-xs cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      No family photos uploaded yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: ADDRESS & STATUTORY / KYC */}
            {activeTab === 'address_kyc' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Present Address (Attac: X) */}
                  <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">
                        Address - Present <span className="text-indigo-600 font-bold">(Attac: X)</span>
                      </Label>
                      <ProofUploadButton 
                        label="Present Address Proof" 
                        value={formData.presentAddressProof}
                        onUpload={(val) => setFormData(prev => ({ ...prev, presentAddressProof: val }))}
                        onRemove={() => setFormData(prev => ({ ...prev, presentAddressProof: '' }))}
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={formData.presentAddress}
                      onChange={e => setFormData({...formData, presentAddress: e.target.value})}
                      placeholder="Door No, Street, Landmark, Area, City, State, PIN..."
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Permanent Address (Attac: X) */}
                  <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">
                          / Permanent Address <span className="text-indigo-600 font-bold">(Attac: X)</span>
                        </Label>
                        <button
                          type="button"
                          onClick={handleCopyAddress}
                          className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Same as Present
                        </button>
                      </div>
                      <ProofUploadButton 
                        label="Permanent Address Proof" 
                        value={formData.permanentAddressProof}
                        onUpload={(val) => setFormData(prev => ({ ...prev, permanentAddressProof: val }))}
                        onRemove={() => setFormData(prev => ({ ...prev, permanentAddressProof: '' }))}
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={formData.permanentAddress}
                      onChange={e => setFormData({...formData, permanentAddress: e.target.value})}
                      placeholder="Permanent Residence Address, City, State, PIN..."
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" /> Statutory Numbers & KYC Document Proofs
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Aadhar (Attac: X) */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                          Aadhar Number <span className="text-indigo-600 font-bold">(Attac: X)</span>
                        </Label>
                        <ProofUploadButton 
                          label="Aadhar Card" 
                          value={formData.aadharDoc}
                          onUpload={(val) => setFormData(prev => ({ ...prev, aadharDoc: val }))}
                          onRemove={() => setFormData(prev => ({ ...prev, aadharDoc: '' }))}
                        />
                      </div>
                      <Input 
                        value={formData.aadhar} 
                        onChange={e => setFormData({...formData, aadhar: e.target.value})} 
                        placeholder="12-digit Aadhar" 
                        maxLength={16}
                        className="bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-mono"
                      />
                    </div>

                    {/* PAN (Attac: X) */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                          PAN Number <span className="text-indigo-600 font-bold">(Attac: X)</span>
                        </Label>
                        <ProofUploadButton 
                          label="PAN Card" 
                          value={formData.panDoc}
                          onUpload={(val) => setFormData(prev => ({ ...prev, panDoc: val }))}
                          onRemove={() => setFormData(prev => ({ ...prev, panDoc: '' }))}
                        />
                      </div>
                      <Input 
                        value={formData.pan} 
                        onChange={e => setFormData({...formData, pan: e.target.value.toUpperCase()})} 
                        placeholder="ABCDE1234F" 
                        maxLength={10}
                        className="bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-mono uppercase"
                      />
                    </div>

                    {/* EPFO No */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                      <Label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                        EPFO No / UAN
                      </Label>
                      <Input 
                        value={formData.epfoNo} 
                        onChange={e => setFormData({...formData, epfoNo: e.target.value})} 
                        placeholder="12-digit UAN / PF No" 
                        className="bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-mono"
                      />
                    </div>

                    {/* ESI No */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                      <Label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                        ESI No
                      </Label>
                      <Input 
                        value={formData.esiNo} 
                        onChange={e => setFormData({...formData, esiNo: e.target.value})} 
                        placeholder="17-digit ESI IP Number" 
                        className="bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: BANKING & COMPENSATION */}
            {activeTab === 'banking_salary' && (
              <div className="space-y-6">
                {/* Banking Information (Attac: XX) */}
                <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Building className="w-4 h-4 text-indigo-500" /> Banking Details - Name / Bank Name / Account No / Branch / IFSC <span className="text-indigo-600 font-bold">(Attac: XX)</span>
                    </h4>
                    <ProofUploadButton 
                      label="Cancelled Cheque / Passbook" 
                      value={formData.bankProof}
                      onUpload={(val) => setFormData(prev => ({ ...prev, bankProof: val }))}
                      onRemove={() => setFormData(prev => ({ ...prev, bankProof: '' }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Account Holder Name</Label>
                      <Input 
                        value={formData.bankAccountName} 
                        onChange={e => setFormData({...formData, bankAccountName: e.target.value})} 
                        placeholder="Name as per Bank Passbook" 
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Bank Name</Label>
                      <Input 
                        value={formData.bankName} 
                        onChange={e => setFormData({...formData, bankName: e.target.value})} 
                        placeholder="e.g. State Bank of India" 
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Account Number</Label>
                      <Input 
                        value={formData.bankAccountNo} 
                        onChange={e => setFormData({...formData, bankAccountNo: e.target.value})} 
                        placeholder="Bank Account Number" 
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Branch</Label>
                      <Input 
                        value={formData.bankBranch} 
                        onChange={e => setFormData({...formData, bankBranch: e.target.value})} 
                        placeholder="e.g. Guindy Industrial Branch" 
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">IFSC Code</Label>
                      <Input 
                        value={formData.bankIfsc} 
                        onChange={e => setFormData({...formData, bankIfsc: e.target.value.toUpperCase()})} 
                        placeholder="SBIN0001234" 
                        maxLength={11}
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Compensation Package */}
                <div className="p-5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Salary Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Gross Pay : 10000 */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                        Gross Pay : 10000 (Monthly ₹)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                        <Input 
                          type="number"
                          step="0.01"
                          value={formData.grossPay} 
                          onChange={e => handleGrossPayChange(e.target.value)} 
                          placeholder="10000" 
                          className="pl-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-mono font-bold"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400">Auto-syncs with Yearly CTC (Gross × 12).</p>
                    </div>

                    {/* Yearly CTC : 1,20,000 */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                        Yearly CTC : 1,20,000 (Annual ₹)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                        <Input 
                          type="number"
                          step="0.01"
                          value={formData.yearlyCtc} 
                          onChange={e => setFormData({...formData, yearlyCtc: e.target.value})} 
                          placeholder="120000" 
                          className="pl-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    {/* Working Hours */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Working Hours</Label>
                      <div className="relative">
                        <Clock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input 
                          value={formData.workingHours} 
                          onChange={e => setFormData({...formData, workingHours: e.target.value})} 
                          placeholder="8 hrs/day" 
                          className="pl-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: CV & ATTACHMENTS */}
            {activeTab === 'attachments' && (
              <div className="space-y-6">
                {/* CV (Curriculum Vitae / Resume) (Attac: X) */}
                <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500" /> CV (Curriculum Vitae / Resume) <span className="text-indigo-600 font-bold text-xs">(Attac: X)</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Upload employee resume / curriculum vitae in PDF or DOCX format.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => cvInputRef.current?.click()}
                      className="rounded-xl border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload CV (X)
                    </Button>
                    <input 
                      type="file" 
                      ref={cvInputRef} 
                      onChange={handleCvUpload} 
                      accept=".pdf,.docx,.doc" 
                      className="hidden" 
                    />
                  </div>

                  {formData.cv ? (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">Curriculum Vitae (CV) Attached</p>
                          <p className="text-[11px] text-slate-400">Saved in employee uploads directory</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={getFileUrl(formData.cv)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs"
                          title="View CV"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, cv: '' }))}
                          className="p-1.5 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 text-xs cursor-pointer"
                          title="Remove CV"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No CV document uploaded yet.</p>
                  )}
                </div>

                {/* General Attachment: XXXXX */}
                <div className="space-y-4">
                  <div className="p-6 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/10 flex flex-col items-center justify-center text-center gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        Attachment: <span className="font-mono text-indigo-600">XXXXX</span> (Multi-Files)
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Appointment letters, educational degrees, police verification, medical fitness, experience letters.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => attachmentsInputRef.current?.click()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold px-4 h-9 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Browse Files
                    </Button>
                    <input 
                      type="file" 
                      multiple 
                      ref={attachmentsInputRef} 
                      onChange={handleAttachmentsUpload} 
                      className="hidden" 
                    />
                  </div>

                  {formData.attachments && formData.attachments.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/50">
                      {formData.attachments.map((att, idx) => (
                        <div key={idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                              <FileText className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {att.name}
                              </p>
                              <p className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span>{formatFileSize(att.size)}</span>
                                <span>•</span>
                                <span>{att.uploadedAt ? format(new Date(att.uploadedAt), 'MMM d, yyyy') : 'Uploaded'}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={getFileUrl(att.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 text-xs transition-colors"
                              title="Open File"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(idx)}
                              className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-500 hover:bg-rose-50 text-xs transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No additional attachments uploaded.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Form Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t border-slate-100 dark:border-slate-800/80">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Files saved under employee directory <code className="text-indigo-500 font-mono">uploads/employees/{formData.empId || 'VTE000001'}</code></span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button 
                  type="button" 
                  onClick={handleCancel} 
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md font-semibold px-6 h-11 transition-colors flex items-center justify-center cursor-pointer flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 h-11 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center justify-center cursor-pointer flex-1 sm:flex-none"
                >
                  {editingUser ? (
                    updateMutation.isPending ? 'Saving...' : 'Update Employee Master'
                  ) : (
                    createMutation.isPending ? 'Registering...' : 'Register Employee Master'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Control Panel: Search & Filters */}
      <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            value={searchTerm} 
            onChange={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }} 
            placeholder="Search Arun, VTE000001, phone, role..." 
            className="pl-10 pr-8 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 focus:border-indigo-500 rounded-xl h-10 w-full text-xs"
          />
          {searchTerm && (
            <button 
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }} 
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 p-0.5 rounded-full cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
          {/* Role Filter */}
          <div className="relative min-w-[130px] sm:min-w-[150px]">
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-full pl-3 pr-8 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              {availableRoles.map(role => (
                <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative min-w-[110px] sm:min-w-[130px]">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-full pl-3 pr-8 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Sort Dropdown */}
          <div className="relative flex items-center min-w-[160px] sm:min-w-[190px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-indigo-600">
              <ArrowUpDown className="w-3.5 h-3.5" />
            </span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-full pl-9 pr-8 text-xs font-semibold border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
            >
              <option value="name_asc">Sort: Name (A → Z)</option>
              <option value="name_desc">Sort: Name (Z → A)</option>
              <option value="empId_asc">Sort: Emp ID (Ascending)</option>
              <option value="empId_desc">Sort: Emp ID (Descending)</option>
              <option value="role_asc">Sort: Role (A → Z)</option>
              <option value="role_desc">Sort: Role (Z → A)</option>
              <option value="status_active">Sort: Active First</option>
              <option value="status_inactive">Sort: Inactive First</option>
              <option value="latest">Sort: Registered (Newest)</option>
              <option value="oldest">Sort: Registered (Oldest)</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {isFilterActive && (
            <button
              onClick={handleResetFilters}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              title="Reset filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/60 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/85">
              <TableRow>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs h-11 py-2 px-4">
                  <button onClick={handleToggleSortName} className="inline-flex items-center gap-1.5 uppercase font-bold text-xs cursor-pointer">
                    <span>Employee (ALL CAPITAL)</span>
                    {sortBy === 'name_asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                </TableHead>

                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs h-11 py-2 px-3">
                  <button onClick={handleToggleSortEmpId} className="inline-flex items-center gap-1.5 uppercase font-bold text-xs cursor-pointer">
                    <span>Emp ID (VTE000001)</span>
                    {sortBy === 'empId_asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                </TableHead>

                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs h-11 py-2 px-3">
                  <button onClick={handleToggleSortRole} className="inline-flex items-center gap-1.5 uppercase font-bold text-xs cursor-pointer">
                    <span>Role</span>
                  </button>
                </TableHead>

                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs h-11 py-2 px-3 hidden md:table-cell">
                  Mobile Numbers (Primary / Sec)
                </TableHead>

                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs h-11 py-2 px-3 hidden lg:table-cell">
                  Gross / Yearly CTC
                </TableHead>

                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs h-11 py-2 px-3">
                  <button onClick={handleToggleSortStatus} className="inline-flex items-center gap-1.5 uppercase font-bold text-xs cursor-pointer">
                    <span>Status</span>
                  </button>
                </TableHead>

                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs text-right h-11 py-2 pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-slate-400 text-xs">
                    No employees found matching filter.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/35 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {user.profilePhoto ? (
                          <img 
                            src={getFileUrl(user.profilePhoto)} 
                            alt={user.name} 
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" 
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border bg-gradient-to-br shrink-0 ${getAvatarGradient(user.name)}`}>
                            {getInitials(user.name)}
                          </div>
                        )}
                        <div>
                          <p className="font-bold uppercase tracking-wider text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                            {user.name}
                            {user.gender && <span className="text-[10px] text-slate-400 font-normal">({user.gender})</span>}
                          </p>
                          <p className="text-xs text-slate-500 font-mono">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 tracking-wider">
                        {user.empId || '—'}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getRoleBadgeStyle(user.role)}`}>
                        {user.role.replace(/_/g, ' ')}
                      </span>
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-xs font-mono">
                      <div className="space-y-0.5">
                        <div className="text-slate-800 dark:text-slate-200 font-semibold">{user.contactNo || (Array.isArray(user.contacts) ? user.contacts[0] : '—')}</div>
                        {Array.isArray(user.contacts) && user.contacts[1] && (
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <span className="text-[9px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">Sec</span>
                            {user.contacts[1]}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="hidden lg:table-cell text-xs font-mono">
                      {user.grossPay || user.yearlyCtc ? (
                        <div>
                          <span className="text-slate-900 dark:text-white font-semibold">₹{Number(user.grossPay || 0).toLocaleString()}</span>
                          <span className="text-slate-400 text-[11px] block">CTC: ₹{Number(user.yearlyCtc || 0).toLocaleString()}/yr</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {user.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingUser(user)}
                          className="rounded-xl h-9 px-2.5 border text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200 cursor-pointer"
                          title="View Employee Dossier"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(user)}
                          className="rounded-xl h-9 px-3 border text-indigo-650 hover:bg-indigo-50 border-indigo-200 font-medium flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger
                            className={`rounded-xl h-9 px-3 border transition-all font-medium inline-flex items-center justify-center cursor-pointer text-xs ${
                              user.isActive 
                                ? "text-amber-600 hover:bg-amber-50 border-amber-200" 
                                : "text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                            }`}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-lg font-bold">
                                {user.isActive ? 'Deactivate Employee?' : 'Reactivate Employee?'}
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-xs text-slate-500">
                                {user.isActive ? `Are you sure you want to deactivate ${user.name}?` : `Reactivate ${user.name}?`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => toggleStatusMutation.mutate({ id: user.id, isActive: user.isActive })}
                                className="rounded-xl bg-indigo-600 text-white"
                              >
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        {/* Permanent Hard Delete Button */}
                        <AlertDialog>
                          <AlertDialogTrigger
                            className="rounded-xl h-9 px-2.5 border transition-all font-medium inline-flex items-center justify-center cursor-pointer text-xs text-rose-600 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40"
                            title="Permanently Delete Employee"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-500" />
                            Delete
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-lg font-bold text-rose-600 flex items-center gap-2">
                                <Trash2 className="w-5 h-5 text-rose-600" />
                                Permanently Delete Employee?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                                Are you sure you want to permanently delete <strong>{user.name}</strong> ({user.empId || 'No ID'})? This will completely erase this employee record from the system and release the ID. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteMutation.mutate(user.id)}
                                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                              >
                                Permanently Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-500 font-medium">Rows per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="ml-2 text-slate-500">
              Showing <strong className="text-slate-800 dark:text-slate-200 font-bold">{sortedAndFiltered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-slate-800 dark:text-slate-200 font-bold">{Math.min(currentPage * itemsPerPage, sortedAndFiltered.length)}</strong> of <strong className="text-slate-800 dark:text-slate-200 font-bold">{sortedAndFiltered.length}</strong> employees
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`min-w-[30px] h-8 px-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                  currentPage === pageNum
                    ? 'bg-indigo-600 text-white shadow-indigo-200 dark:shadow-none'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* VIEW DOSSIER MODAL */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-4">
                {viewingUser.profilePhoto ? (
                  <img 
                    src={getFileUrl(viewingUser.profilePhoto)} 
                    alt={viewingUser.name} 
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500 shadow-md shrink-0" 
                  />
                ) : (
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl border bg-gradient-to-br shrink-0 ${getAvatarGradient(viewingUser.name)}`}>
                    {getInitials(viewingUser.name)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black uppercase tracking-wider text-slate-900 dark:text-white">{viewingUser.name}</h2>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white font-bold tracking-wider">
                      {viewingUser.empId || 'VTE000001'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">{viewingUser.email} • {viewingUser.contactNo}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    handleEditClick(viewingUser);
                    setViewingUser(null);
                  }}
                  className="bg-indigo-600 text-white rounded-xl text-xs font-semibold h-9 px-3.5 flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit Master
                </Button>
                <button onClick={() => setViewingUser(null)} className="p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Dossier Body */}
            <div className="space-y-6 text-xs">
              {/* Quick Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Sex / Blood Group</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                    {viewingUser.gender || '—'} / {viewingUser.bloodGroup || '—'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">DOB / DOJ</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 mt-1 block">
                    {viewingUser.dob ? format(new Date(viewingUser.dob), 'dd/MM/yyyy') : '—'} • {viewingUser.doj ? format(new Date(viewingUser.doj), 'dd/MM/yyyy') : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                  <span className="text-[10px] text-indigo-500 uppercase font-bold tracking-wider block">Gross / Yearly CTC</span>
                  <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 mt-1 block">
                    ₹{Number(viewingUser.grossPay || 0).toLocaleString()} • ₹{Number(viewingUser.yearlyCtc || 0).toLocaleString()}/yr
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Working Hours</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                    {viewingUser.workingHours || '8 hrs/day'}
                  </span>
                </div>
              </div>

              {/* Contacts & Login Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-indigo-600">
                    <Phone className="w-3.5 h-3.5" /> Mobile Numbers (Primary & Secondary)
                  </h4>
                  <div className="space-y-1 font-mono">
                    {Array.isArray(viewingUser.contacts) && viewingUser.contacts.length > 0 ? (
                      viewingUser.contacts.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">#{i + 1}</span>
                          <span className="font-semibold">{c}</span>
                          {i === 0 && <span className="text-[9px] px-1 bg-emerald-50 text-emerald-600 rounded">Primary</span>}
                          {i === 1 && <span className="text-[9px] px-1 bg-slate-100 text-slate-600 rounded">Secondary</span>}
                        </div>
                      ))
                    ) : (
                      <span>{viewingUser.contactNo || '—'}</span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-indigo-600">
                    <span className="text-xs font-bold">@</span> Email Address (Login ID)
                  </h4>
                  <div className="space-y-1 font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">#1</span>
                      <span className="font-semibold">{viewingUser.email || (Array.isArray(viewingUser.emails) ? viewingUser.emails[0] : '—')}</span>
                      <span className="text-[9px] px-1 bg-indigo-50 text-indigo-600 rounded">Login ID</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selfie & Location Proof */}
              {(viewingUser.selfiePhoto || viewingUser.selfieLocation) && (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
                  {viewingUser.selfiePhoto && (
                    <img 
                      src={getFileUrl(viewingUser.selfiePhoto)} 
                      alt="Selfie" 
                      className="w-16 h-16 rounded-xl object-cover border shrink-0 cursor-pointer"
                      onClick={() => setSelectedEnlargedPhoto(getFileUrl(viewingUser.selfiePhoto))}
                    />
                  )}
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-indigo-600">
                      <Compass className="w-3.5 h-3.5" /> Selfie Verification & GPS Location
                    </h4>
                    {viewingUser.selfieLocation ? (
                      <p className="font-mono text-emerald-600 font-bold mt-1">📍 {viewingUser.selfieLocation}</p>
                    ) : (
                      <p className="text-slate-400">Selfie uploaded without GPS coordinates</p>
                    )}
                  </div>
                </div>
              )}

              {/* Family Members */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-indigo-600">
                  <Heart className="w-3.5 h-3.5" /> Family Members & Emer. Contact Nos
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-400 block font-semibold">Father Name *</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingUser.fatherName || '—'}</span>
                    <span className="font-mono text-[11px] text-slate-500 block">Emer: {viewingUser.fatherContact || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Mother Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingUser.motherName || '—'}</span>
                    <span className="font-mono text-[11px] text-slate-500 block">Emer: {viewingUser.motherContact || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Husband Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingUser.husbandName || '—'}</span>
                    <span className="font-mono text-[11px] text-slate-500 block">Emer: {viewingUser.husbandContact || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Spouse Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingUser.spouseName || '—'}</span>
                    <span className="font-mono text-[11px] text-slate-500 block">Emer: {viewingUser.spouseContact || '—'}</span>
                  </div>
                </div>

                {viewingUser.familyRemarks && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block font-semibold">Remarks Box on family Details :-</span>
                    <p className="text-slate-800 dark:text-slate-200 italic mt-0.5">{viewingUser.familyRemarks}</p>
                    {viewingUser.familyDoc && (
                      <a 
                        href={getFileUrl(viewingUser.familyDoc)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 text-indigo-600 font-bold text-[11px] hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" /> View Family Document Proof (X)
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Address with Proofs (Attac: X) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Address - Present</h4>
                    {viewingUser.presentAddressProof && (
                      <a href={getFileUrl(viewingUser.presentAddressProof)} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold text-[11px] hover:underline flex items-center gap-1">
                        <FileCheck className="w-3.5 h-3.5" /> Proof (X)
                      </a>
                    )}
                  </div>
                  <p className="text-slate-800 dark:text-slate-200">{viewingUser.presentAddress || '—'}</p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">/ Permanent Address</h4>
                    {viewingUser.permanentAddressProof && (
                      <a href={getFileUrl(viewingUser.permanentAddressProof)} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold text-[11px] hover:underline flex items-center gap-1">
                        <FileCheck className="w-3.5 h-3.5" /> Proof (X)
                      </a>
                    )}
                  </div>
                  <p className="text-slate-800 dark:text-slate-200">{viewingUser.permanentAddress || '—'}</p>
                </div>
              </div>

              {/* KYC Proofs & Banking Proofs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
                <div className="p-3 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold">Aadhar (X)</span>
                  <span className="font-bold">{viewingUser.aadhar || '—'}</span>
                  {viewingUser.aadharDoc && (
                    <a href={getFileUrl(viewingUser.aadharDoc)} target="_blank" rel="noopener noreferrer" className="text-indigo-600 block text-[11px] hover:underline font-sans">
                      View Aadhar Doc ↗
                    </a>
                  )}
                </div>

                <div className="p-3 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold">PAN (X)</span>
                  <span className="font-bold">{viewingUser.pan || '—'}</span>
                  {viewingUser.panDoc && (
                    <a href={getFileUrl(viewingUser.panDoc)} target="_blank" rel="noopener noreferrer" className="text-indigo-600 block text-[11px] hover:underline font-sans">
                      View PAN Doc ↗
                    </a>
                  )}
                </div>

                <div className="p-3 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold">EPFO / UAN</span>
                  <span className="font-bold">{viewingUser.epfoNo || '—'}</span>
                </div>

                <div className="p-3 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold">ESI No</span>
                  <span className="font-bold">{viewingUser.esiNo || '—'}</span>
                </div>
              </div>

              {/* Banking Details (Attac: XX) */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-indigo-600">
                    <Building className="w-3.5 h-3.5" /> Banking Details - Name / Bank Name / Account No / Branch / IFSC (XX)
                  </h4>
                  {viewingUser.bankProof && (
                    <a href={getFileUrl(viewingUser.bankProof)} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold text-[11px] hover:underline flex items-center gap-1">
                      <FileCheck className="w-3.5 h-3.5" /> Bank Cheque / Passbook Proof (XX)
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
                  <div>
                    <span className="text-slate-400 font-sans block text-[10px]">Holder Name</span>
                    <span className="font-semibold font-sans">{viewingUser.bankAccountName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans block text-[10px]">Bank Name</span>
                    <span className="font-semibold font-sans">{viewingUser.bankName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans block text-[10px]">Account No</span>
                    <span className="font-bold">{viewingUser.bankAccountNo || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans block text-[10px]">Branch</span>
                    <span className="font-sans">{viewingUser.bankBranch || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans block text-[10px]">IFSC Code</span>
                    <span className="font-bold">{viewingUser.bankIfsc || '—'}</span>
                  </div>
                </div>
              </div>

              {/* CV & Attachments (Attac: X / XXXXX) */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-indigo-600">
                  <Paperclip className="w-3.5 h-3.5" /> CV & General Attachments (XXXXX)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {viewingUser.cv && (
                    <a
                      href={getFileUrl(viewingUser.cv)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 text-indigo-700 font-semibold flex items-center gap-2 text-xs"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Curriculum Vitae (CV)</span>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  )}
                  {Array.isArray(viewingUser.attachments) && viewingUser.attachments.map((att, i) => (
                    <a
                      key={i}
                      href={getFileUrl(att.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl border border-slate-200 flex items-center gap-2 text-xs hover:bg-slate-50 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-indigo-500" />
                      <span>{att.name}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 ml-1" />
                    </a>
                  ))}
                  {!viewingUser.cv && (!Array.isArray(viewingUser.attachments) || viewingUser.attachments.length === 0) && (
                    <p className="text-slate-400">No attachments uploaded.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewingUser(null)} className="rounded-xl px-5 cursor-pointer">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ENLARGED PHOTO PREVIEW POPUP */}
      {selectedEnlargedPhoto && (
        <div 
          onClick={() => setSelectedEnlargedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img 
              src={selectedEnlargedPhoto} 
              alt="Enlarged" 
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/20" 
            />
            <button
              onClick={() => setSelectedEnlargedPhoto(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-white text-slate-900 shadow-xl cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
