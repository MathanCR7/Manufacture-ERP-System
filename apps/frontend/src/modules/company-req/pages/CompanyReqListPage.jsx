import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import {
  Building2, Search, Plus, Edit, Trash2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  Globe, Phone, MapPin, User, FileText, Download, X, Paperclip, ChevronDown,
  ExternalLink, Layers, CheckCircle2, Factory, Store, Truck, ShoppingBag, MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/Pagination';
import DashboardBackButton from '@/components/ui/DashboardBackButton';

// Type Badge styling
function TypeBadge({ type }) {
  const configs = {
    Manufacture: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    Trader: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    Retailer: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    Supplier: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    Others: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  };

  const style = configs[type] || configs.Others;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border shadow-3xs ${style}`}>
      {type}
    </span>
  );
}

// KPI Stat Card Component
function StatCard({ icon: Icon, label, value, borderClass, bgClass, iconColorClass, isLoading }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border p-3 shadow-2xs flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5 ${borderClass}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bgClass}`}>
        <Icon className={`w-4.5 h-4.5 ${iconColorClass}`} />
      </div>
      <div className="space-y-0.5 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
        {isLoading ? (
          <Skeleton className="h-5 w-16 rounded" />
        ) : (
          <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight truncate">{value}</p>
        )}
      </div>
    </div>
  );
}

// Attachment Preview & Download Modal
function AttachmentModal({ record, onClose }) {
  if (!record || !record.attachments || record.attachments.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-900 dark:to-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800 shrink-0">
              <Paperclip className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Attachments for {record.companyName}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {record.attachments.length} file(s) available
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {record.attachments.map((att, idx) => {
            const isImage = att.type?.startsWith('image/') || att.url?.match(/\.(jpeg|jpg|png|gif|webp)$/i);
            const downloadUrl = att.url || att.data;

            return (
              <div
                key={att.id || idx}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-900 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[260px]" title={att.name}>
                      {att.name || `Attachment ${idx + 1}`}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Attached Document'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {downloadUrl && (
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 inline-flex items-center gap-1 transition-all"
                    >
                      <Eye className="w-3 h-3" /> View
                    </a>
                  )}
                  {downloadUrl && (
                    <a
                      href={downloadUrl}
                      download={att.name || `attachment_${idx + 1}`}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="h-8 text-xs font-semibold rounded-xl"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// Company Detail View Modal
function CompanyDetailModal({ record, onClose, onEdit }) {
  if (!record) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-900 dark:to-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white uppercase tracking-wide">
                  {record.companyName}
                </h3>
                <TypeBadge type={record.type} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Industry: <span className="font-bold text-slate-700 dark:text-slate-300">{record.industryType}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Contact Person</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 uppercase">
                {record.contactPerson}
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Primary Contact No</span>
              <p className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {record.contactNo}
              </p>
            </div>
          </div>

          {/* Add-on Contact Numbers */}
          {Array.isArray(record.additionalContacts) && record.additionalContacts.length > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Additional Contact Numbers (Add-on feature)
              </span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {record.additionalContacts.map((no, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-3xs"
                  >
                    <Phone className="w-3 h-3 text-slate-400" />
                    {no}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Address */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Address</span>
            <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 leading-relaxed whitespace-pre-line">
              {record.address}
            </p>
          </div>

          {/* Website & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Website</span>
              <p className="text-xs font-mono mt-1">
                {record.website ? (
                  <a
                    href={record.website.startsWith('http') ? record.website : `https://${record.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                  >
                    {record.website} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Remarks</span>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                {record.remarks || '—'}
              </p>
            </div>
          </div>

          {/* Attachments Section */}
          {Array.isArray(record.attachments) && record.attachments.length > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Attachments ({record.attachments.length})
              </span>
              <div className="flex flex-wrap gap-2 mt-2">
                {record.attachments.map((att, idx) => (
                  <a
                    key={att.id || idx}
                    href={att.url || att.data}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:border-indigo-300 inline-flex items-center gap-1.5 shadow-3xs"
                  >
                    <Paperclip className="w-3 h-3" />
                    <span>Att {idx + 1}</span>
                    <span className="text-[10px] text-slate-400">({att.name})</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Created: {record.createdAt ? format(new Date(record.createdAt), 'dd MMM yyyy, hh:mm a') : '—'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="h-8 text-xs font-semibold rounded-xl"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onClose();
                onEdit(record.id);
              }}
              className="h-8 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-1.5"
            >
              <Edit className="w-3.5 h-3.5" /> Edit Record
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompanyReqListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [industryFilter, setIndustryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('recent');

  // Modals state
  const [activeAttachmentRecord, setActiveAttachmentRecord] = useState(null);
  const [activeDetailRecord, setActiveDetailRecord] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch list of company requirement forms
  const { data: responseData, isLoading, refetch } = useQuery({
    queryKey: ['company-req', { searchTerm, typeFilter, industryFilter, sortBy }],
    queryFn: async () => {
      const res = await api.get('/company-req', {
        params: {
          search: searchTerm,
          type: typeFilter,
          industryType: industryFilter,
          sortBy: sortBy,
          limit: 200
        }
      });
      return res.data?.data || res.data || [];
    }
  });

  const records = useMemo(() => {
    return Array.isArray(responseData) ? responseData : [];
  }, [responseData]);

  // Fetch distinct industries for filter dropdown
  const { data: dbIndustries = [] } = useQuery({
    queryKey: ['company-req-industries'],
    queryFn: async () => {
      const res = await api.get('/company-req/industries');
      if (Array.isArray(res.data?.industries)) return res.data.industries;
      if (Array.isArray(res.data?.data)) return res.data.data.map(i => i.name || i);
      if (Array.isArray(res.data)) return res.data.map(i => i.name || i);
      return [];
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/company-req/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-req'] });
      queryClient.invalidateQueries({ queryKey: ['company-req-industries'] });
      Swal.fire({
        icon: 'success',
        title: 'Deleted',
        text: 'Record has been removed successfully.',
        timer: 1500,
        showConfirmButton: false
      });
    },
    onError: (err) => {
      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: err.response?.data?.error || 'Could not delete record.'
      });
    }
  });

  const handleDelete = (record) => {
    Swal.fire({
      title: 'Delete Company Record?',
      text: `Are you sure you want to delete "${record.companyName}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(record.id);
      }
    });
  };

  // Client-side filtering & sorting (Just like /purchase-orders)
  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || (
        (item.companyName || '').toLowerCase().includes(term) ||
        (item.industryType || '').toLowerCase().includes(term) ||
        (item.address || '').toLowerCase().includes(term) ||
        (item.website || '').toLowerCase().includes(term) ||
        (item.type || '').toLowerCase().includes(term) ||
        (item.contactPerson || '').toLowerCase().includes(term) ||
        (item.contactNo || '').toLowerCase().includes(term) ||
        (item.remarks || '').toLowerCase().includes(term) ||
        (Array.isArray(item.additionalContacts) && item.additionalContacts.some(c => (c || '').toLowerCase().includes(term)))
      );

      const matchesType = typeFilter === 'ALL' || item.type === typeFilter;
      const matchesIndustry = industryFilter === 'ALL' || item.industryType === industryFilter;

      return matchesSearch && matchesType && matchesIndustry;
    });
  }, [records, searchTerm, typeFilter, industryFilter]);

  // Sort logic (Just like /purchase-orders)
  const sortedRecords = useMemo(() => {
    let list = [...filteredRecords];
    list.sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (sortBy === 'company_asc') return (a.companyName || '').localeCompare(b.companyName || '');
      if (sortBy === 'company_desc') return (b.companyName || '').localeCompare(a.companyName || '');
      if (sortBy === 'industry_asc') return (a.industryType || '').localeCompare(b.industryType || '');
      if (sortBy === 'industry_desc') return (b.industryType || '').localeCompare(a.industryType || '');
      if (sortBy === 'person_asc') return (a.contactPerson || '').localeCompare(b.contactPerson || '');
      if (sortBy === 'person_desc') return (b.contactPerson || '').localeCompare(a.contactPerson || '');
      if (sortBy === 'type_asc') return (a.type || '').localeCompare(b.type || '');
      if (sortBy === 'type_desc') return (b.type || '').localeCompare(a.type || '');
      return 0;
    });
    return list;
  }, [filteredRecords, sortBy]);

  // Paginated records
  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedRecords, currentPage, itemsPerPage]);

  // Header quick column sorting toggles (Blue arrow "Sort Feature" from user request)
  const handleToggleSort = (keyAsc, keyDesc) => {
    setSortBy(prev => (prev === keyAsc ? keyDesc : keyAsc));
    setCurrentPage(1);
  };

  // KPIs
  const totalCount = records.length;
  const manufacturerCount = records.filter(r => r.type === 'Manufacture').length;
  const supplierCount = records.filter(r => r.type === 'Supplier').length;
  const traderCount = records.filter(r => r.type === 'Trader').length;

  return (
    <div className="w-full max-w-full px-3 sm:px-4 py-2.5 space-y-2.5 mx-auto transition-all duration-200">
      <DashboardBackButton />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800 shadow-3xs shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Company Requirement Directory
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                {records.length} Records
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Directory list with sorting, common search, add-on contact numbers, and multiple attachments.
            </p>
          </div>
        </div>

        <Button
          onClick={() => navigate('/company-directory/req-form')}
          className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-3xs transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          Req Form
        </Button>
      </div>

      {/* Stat Cards Grid (Matched with /purchase-orders) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard
          icon={Building2}
          label="Total Companies"
          value={totalCount}
          borderClass="border-slate-200/70 dark:border-slate-800"
          bgClass="bg-indigo-50/80 dark:bg-indigo-950/30"
          iconColorClass="text-indigo-600 dark:text-indigo-400"
          isLoading={isLoading}
        />
        <StatCard
          icon={Factory}
          label="Manufacturers"
          value={manufacturerCount}
          borderClass="border-slate-200/70 dark:border-slate-800"
          bgClass="bg-blue-50/80 dark:bg-blue-950/30"
          iconColorClass="text-blue-600 dark:text-blue-400"
          isLoading={isLoading}
        />
        <StatCard
          icon={Truck}
          label="Suppliers"
          value={supplierCount}
          borderClass="border-slate-200/70 dark:border-slate-800"
          bgClass="bg-purple-50/80 dark:bg-purple-950/30"
          iconColorClass="text-purple-600 dark:text-purple-400"
          isLoading={isLoading}
        />
        <StatCard
          icon={Store}
          label="Traders & Others"
          value={traderCount + (records.length - manufacturerCount - supplierCount - traderCount)}
          borderClass="border-slate-200/70 dark:border-slate-800"
          bgClass="bg-emerald-50/80 dark:bg-emerald-950/30"
          iconColorClass="text-emerald-600 dark:text-emerald-400"
          isLoading={isLoading}
        />
      </div>

      {/* Main Table Card */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden flex flex-col text-xs">
        <CardContent className="p-0">
          {/* Integrated Pro Toolbar (Matched with /purchase-orders & Common Search) */}
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
            
            {/* Common Search Input (Annotated in Yellow box on user's image) */}
            <div className="relative w-full md:w-72 lg:w-80">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Common Search: Industry, company, contact, address..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-7 py-1.5 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 h-8 shadow-3xs transition-all placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
              {searchTerm && (
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium hidden lg:inline-flex items-center gap-1">
                  <span>Found {sortedRecords.length} matches</span>
                </div>
              )}

              {/* Type Filter */}
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <option value="ALL">Type: All</option>
                  <option value="Manufacture">Manufacture</option>
                  <option value="Trader">Trader</option>
                  <option value="Retailer">Retailer</option>
                  <option value="Supplier">Supplier</option>
                  <option value="Others">Others</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Industry Filter */}
              <div className="relative">
                <select
                  value={industryFilter}
                  onChange={(e) => {
                    setIndustryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600 max-w-[150px] truncate"
                >
                  <option value="ALL">Industry: All</option>
                  {dbIndustries.map((ind, i) => (
                    <option key={i} value={ind}>{ind}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Sort Dropdown (Styled identically to /purchase-orders) */}
              <div className="relative flex items-center">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-indigo-600 dark:text-indigo-400">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-8 pr-7 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                  aria-label="Sort options"
                >
                  <option value="recent">Sort: Date (Newest First)</option>
                  <option value="oldest">Sort: Date (Oldest First)</option>
                  <option value="company_asc">Sort: Company Name (A → Z)</option>
                  <option value="company_desc">Sort: Company Name (Z → A)</option>
                  <option value="industry_asc">Sort: Industry Type (A → Z)</option>
                  <option value="industry_desc">Sort: Industry Type (Z → A)</option>
                  <option value="person_asc">Sort: Contact Person (A → Z)</option>
                  <option value="person_desc">Sort: Contact Person (Z → A)</option>
                  <option value="type_asc">Sort: Type (A → Z)</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Table displaying all columns matching the spreadsheet screenshot */}
          <div className="overflow-x-auto min-h-[350px]">
            <Table>
              <TableHeader className="bg-slate-50/90 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800">
                <TableRow className="hover:bg-transparent">
                  {/* # Column */}
                  <TableHead className="w-10 text-center font-bold text-slate-700 dark:text-slate-300 text-[11px] py-2.5 px-2">
                    #
                  </TableHead>

                  {/* Industry Type with Sort */}
                  <TableHead
                    onClick={() => handleToggleSort('industry_asc', 'industry_desc')}
                    className="font-bold text-slate-700 dark:text-slate-300 text-[11px] py-2.5 px-3 cursor-pointer hover:text-indigo-600 transition-colors select-none"
                    title="Click to sort by Industry Type"
                  >
                    <div className="flex items-center gap-1">
                      <span>Industry Type</span>
                      {sortBy === 'industry_asc' && <ArrowUp className="w-3 h-3 text-indigo-600" />}
                      {sortBy === 'industry_desc' && <ArrowDown className="w-3 h-3 text-indigo-600" />}
                      {sortBy !== 'industry_asc' && sortBy !== 'industry_desc' && <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </TableHead>

                  {/* Company Name with Sort */}
                  <TableHead
                    onClick={() => handleToggleSort('company_asc', 'company_desc')}
                    className="font-bold text-slate-700 dark:text-slate-300 text-[11px] py-2.5 px-3 cursor-pointer hover:text-indigo-600 transition-colors select-none"
                    title="Click to sort by Company Name"
                  >
                    <div className="flex items-center gap-1">
                      <span>Company Name</span>
                      {sortBy === 'company_asc' && <ArrowUp className="w-3 h-3 text-indigo-600" />}
                      {sortBy === 'company_desc' && <ArrowDown className="w-3 h-3 text-indigo-600" />}
                      {sortBy !== 'company_asc' && sortBy !== 'company_desc' && <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </TableHead>

                  {/* Address */}
                  <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-[11px] py-2.5 px-3">
                    Address
                  </TableHead>

                  {/* Website */}
                  <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-[11px] py-2.5 px-3">
                    Website
                  </TableHead>

                  {/* Type with Sort */}
                  <TableHead
                    onClick={() => handleToggleSort('type_asc', 'type_desc')}
                    className="font-bold text-slate-700 dark:text-slate-300 text-[11px] py-2.5 px-3 cursor-pointer hover:text-indigo-600 transition-colors select-none text-center"
                    title="Click to sort by Type"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Type</span>
                      {sortBy === 'type_asc' && <ArrowUp className="w-3 h-3 text-indigo-600" />}
                      {sortBy === 'type_desc' && <ArrowDown className="w-3 h-3 text-indigo-600" />}
                      {sortBy !== 'type_asc' && sortBy !== 'type_desc' && <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </TableHead>

                  {/* Contact Person with Sort */}
                  <TableHead
                    onClick={() => handleToggleSort('person_asc', 'person_desc')}
                    className="font-bold text-slate-700 dark:text-slate-300 text-[11px] py-2.5 px-3 cursor-pointer hover:text-indigo-600 transition-colors select-none"
                    title="Click to sort by Contact Person"
                  >
                    <div className="flex items-center gap-1">
                      <span>Contact Person</span>
                      {sortBy === 'person_asc' && <ArrowUp className="w-3 h-3 text-indigo-600" />}
                      {sortBy === 'person_desc' && <ArrowDown className="w-3 h-3 text-indigo-600" />}
                      {sortBy !== 'person_asc' && sortBy !== 'person_desc' && <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </TableHead>

                  {/* Primary Contact No */}
                  <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-[11px] py-2.5 px-3">
                    Contact No
                  </TableHead>

                  {/* Add-on Contact No */}
                  <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-[11px] py-2.5 px-3">
                    Contact No (Add-on)
                  </TableHead>

                  {/* Remarks */}
                  <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-[11px] py-2.5 px-3">
                    Remarks
                  </TableHead>

                  {/* Attachment */}
                  <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-[11px] py-2.5 px-3 text-center">
                    Attachment
                  </TableHead>

                  {/* Actions */}
                  <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-[11px] py-2.5 px-3 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={12} className="py-3 px-4">
                        <Skeleton className="h-5 w-full rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Building2 className="w-8 h-8 opacity-40" />
                        <p className="text-xs font-semibold">No company requirement records found.</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/company-directory/req-form')}
                          className="mt-1 h-7 text-xs font-bold rounded-lg border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Create First Entry
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRecords.map((item, index) => {
                    const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;
                    const addOnContacts = Array.isArray(item.additionalContacts) ? item.additionalContacts : [];
                    const attachments = Array.isArray(item.attachments) ? item.attachments : [];

                    return (
                      <TableRow
                        key={item.id}
                        onClick={() => setActiveDetailRecord(item)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      >
                        {/* # Row Number */}
                        <TableCell className="text-center font-mono font-bold text-slate-400 text-xs py-2 px-2">
                          {rowNumber}
                        </TableCell>

                        {/* Industry Type */}
                        <TableCell className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {item.industryType}
                        </TableCell>

                        {/* Company Name (CAPS) */}
                        <TableCell className="py-2 px-3 font-bold text-slate-900 dark:text-white uppercase tracking-tight whitespace-nowrap">
                          <span className="text-indigo-600 dark:text-indigo-400 group-hover:underline">
                            {item.companyName}
                          </span>
                        </TableCell>

                        {/* Address (Free Text) */}
                        <TableCell className="py-2 px-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={item.address}>
                          {item.address}
                        </TableCell>

                        {/* Website (Clickable Link) */}
                        <TableCell className="py-2 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {item.website ? (
                            <a
                              href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                            >
                              {item.website}
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </a>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </TableCell>

                        {/* Type */}
                        <TableCell className="py-2 px-3 text-center whitespace-nowrap">
                          <TypeBadge type={item.type} />
                        </TableCell>

                        {/* Contact Person (CAPS) */}
                        <TableCell className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight whitespace-nowrap">
                          {item.contactPerson}
                        </TableCell>

                        {/* Primary Contact No */}
                        <TableCell className="py-2 px-3 font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {item.contactNo}
                        </TableCell>

                        {/* Add-on Contact No */}
                        <TableCell className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {addOnContacts.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <span>{addOnContacts[0]}</span>
                              {addOnContacts.length > 1 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500" title={addOnContacts.join(', ')}>
                                  +{addOnContacts.length - 1} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </TableCell>

                        {/* Remarks */}
                        <TableCell className="py-2 px-3 text-slate-500 dark:text-slate-400 max-w-[150px] truncate" title={item.remarks || ''}>
                          {item.remarks || '—'}
                        </TableCell>

                        {/* Attachments ("Att 1 / Att 2" as requested in screenshot) */}
                        <TableCell className="py-2 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {attachments.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setActiveAttachmentRecord(item)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer shadow-3xs"
                              title="Click to view/download attachments"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>{attachments.length === 1 ? 'Att 1' : attachments.length === 2 ? 'Att 1 / Att 2' : `Att (${attachments.length})`}</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-2 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setActiveDetailRecord(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/company-directory/edit/${item.id}`)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
                              title="Edit record"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Integrated Pagination Toolbar */}
          <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Showing <span className="font-bold text-slate-800 dark:text-slate-200">
                {sortedRecords.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
              </span> to <span className="font-bold text-slate-800 dark:text-slate-200">
                {Math.min(currentPage * itemsPerPage, sortedRecords.length)}
              </span> of <span className="font-bold text-slate-800 dark:text-slate-200">{sortedRecords.length}</span> records
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-7 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attachment Preview Modal */}
      {activeAttachmentRecord && (
        <AttachmentModal
          record={activeAttachmentRecord}
          onClose={() => setActiveAttachmentRecord(null)}
        />
      )}

      {/* Full Detail Modal */}
      {activeDetailRecord && (
        <CompanyDetailModal
          record={activeDetailRecord}
          onClose={() => setActiveDetailRecord(null)}
          onEdit={(recId) => navigate(`/company-directory/edit/${recId}`)}
        />
      )}
    </div>
  );
}
