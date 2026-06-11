import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { 
  Shield, Plus, Edit, UserX, UserCheck, Key, MapPin, 
  Search, Users, Activity, Lock, Unlock, Calendar, 
  Eye, EyeOff, Sparkles, Filter, RefreshCw, X, AlertCircle, Info, Trash2
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

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    ipAddress: '',
    empId: ''
  });

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
      setFormData({ name: '', email: '', password: '', role: '', ipAddress: '', empId: '' });
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: 'User Created!',
        text: 'The new user account has been successfully configured and activated.',
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
        title: 'Failed to Create User',
        text: err.response?.data?.message || 'Error creating user',
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
      // If password is empty, don't send it in the request
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: '', ipAddress: '', empId: '' });
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: 'User Updated!',
        text: 'The user account details have been successfully updated.',
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
        title: 'Failed to Update User',
        text: err.response?.data?.message || 'Error updating user',
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
      const response = await api.delete(`/users/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: 'User Deleted!',
        text: 'The user account has been successfully removed/deactivated.',
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
        text: err.response?.data?.message || 'Error deleting user',
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

  const generateNextEmpId = () => {
    const dateStr = format(new Date(), 'MMdd');
    const prefix = `emp-${dateStr}-`;
    const matchingIds = (users || [])
      .map(u => u.empId)
      .filter(id => id && id.startsWith(prefix));

    let maxNum = 0;
    matchingIds.forEach(id => {
      const numPart = id.substring(prefix.length);
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    const runningNumberStr = String(nextNum).padStart(3, '0');
    return `${prefix}${runningNumberStr}`;
  };

  const handleAddUserClick = () => {
    setIsCreating(true);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: '',
      ipAddress: '',
      empId: generateNextEmpId()
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEditClick = (user) => {
    setEditingUser(user);
    setIsCreating(false);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // security: do not pre-fill existing password hashes
      role: user.role,
      ipAddress: user.ipAddress || '',
      empId: user.empId || ''
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: '', ipAddress: '', empId: '' });
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

  // Stats calculations
  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter(u => u.isActive).length || 0;
  const ipLockedUsers = users?.filter(u => u.ipAddress && u.ipAddress.trim() !== '').length || 0;
  const adminUsers = users?.filter(u => u.role === 'MAIN_MASTER' || u.role === 'SUPERVISOR').length || 0;

  // Filtered users list
  const filteredUsers = users?.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesRole = selectedRole === 'ALL' || user.role === selectedRole;
    
    const matchesStatus = 
      selectedStatus === 'ALL' || 
      (selectedStatus === 'ACTIVE' && user.isActive) ||
      (selectedStatus === 'INACTIVE' && !user.isActive);
      
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Helper for generating custom lettered avatars with nice premium gradients
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
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Helper for role badge colors matching each team type
  const getRoleBadgeStyle = (role) => {
    const r = role.toUpperCase();
    if (r.includes('MASTER') || r.includes('ADMIN')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/15';
    }
    if (r.includes('SUPERVISOR')) {
      return 'bg-violet-500/10 text-violet-400 border-violet-500/25 hover:bg-violet-500/15';
    }
    if (r.includes('ACCOUNTANT') || r.includes('FINANCE')) {
      return 'bg-blue-500/10 text-blue-400 border-blue-500/25 hover:bg-blue-500/15';
    }
    if (r.includes('RECEIVER') || r.includes('INVENTORY') || r.includes('MATERIALS')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/15';
    }
    if (r.includes('ASSISTANT') || r.includes('LAB') || r.includes('QC')) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/25 hover:bg-rose-500/15';
    }
    if (r.includes('PRODUCTION') || r.includes('STAFF')) {
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25 hover:bg-cyan-500/15';
    }
    if (r.includes('SALES') || r.includes('TEAM')) {
      return 'bg-pink-500/10 text-pink-400 border-pink-500/25 hover:bg-pink-500/15';
    }
    return 'bg-slate-500/10 text-slate-400 border-slate-500/25 hover:bg-slate-50/15';
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl dark:bg-indigo-500/20 dark:text-indigo-400">
              <Shield className="w-6 h-6" />
            </div>
            User Configuration
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Provision user identity credentials, role policies, and coordinate secure IP restriction locking.
          </p>
        </div>
        {!isCreating && !editingUser && (
          <Button 
            onClick={handleAddUserClick} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all font-semibold flex items-center gap-2 h-11 px-5"
          >
            <Plus className="w-5 h-5" />
            Add User
          </Button>
        )}
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users Card */}
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-md hover:shadow-lg dark:shadow-indigo-500/5 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Users</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {isLoading ? <Skeleton className="h-8 w-12 bg-slate-200 dark:bg-slate-800" /> : totalUsers}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-gradient-to-br dark:from-indigo-500/20 dark:to-purple-500/5 dark:text-indigo-400 dark:border-indigo-500/20">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium mr-1.5 flex items-center">
              Active accounts managed
            </span>
          </div>
        </div>

        {/* Active Users Card */}
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-md hover:shadow-lg dark:shadow-emerald-500/5 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Users</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {isLoading ? <Skeleton className="h-8 w-12 bg-slate-200 dark:bg-slate-800" /> : activeUsers}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-gradient-to-br dark:from-emerald-500/20 dark:to-teal-500/5 dark:text-emerald-400 dark:border-emerald-500/20">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold mr-1.5">
              {totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0}%
            </span>
            <span>of total users active</span>
          </div>
        </div>

        {/* IP Locked Card */}
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-md hover:shadow-lg dark:shadow-amber-500/5 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">IP Locked</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                {isLoading ? <Skeleton className="h-8 w-12 bg-slate-200 dark:bg-slate-800" /> : ipLockedUsers}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 dark:bg-gradient-to-br dark:from-amber-500/20 dark:to-orange-500/5 dark:text-amber-400 dark:border-amber-500/20">
              <Lock className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="text-amber-600 dark:text-amber-400 font-semibold mr-1.5">
              Strict access
            </span>
            <span>security locks enabled</span>
          </div>
        </div>

        {/* System Admins Card */}
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-md hover:shadow-lg dark:shadow-rose-500/5 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Administrators</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                {isLoading ? <Skeleton className="h-8 w-12 bg-slate-200 dark:bg-slate-800" /> : adminUsers}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 dark:bg-gradient-to-br dark:from-rose-500/20 dark:to-pink-500/5 dark:text-rose-400 dark:border-rose-500/20">
              <Shield className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="text-rose-600 dark:text-rose-400 font-semibold mr-1.5">
              High privilege
            </span>
            <span>accounts configuration</span>
          </div>
        </div>
      </div>

      {/* Unified Create / Edit User Form Section */}
      {(isCreating || editingUser) && (
        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100 dark:border-transparent">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingUser ? `Edit User: ${editingUser.name}` : 'Create New User'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editingUser ? 'Update account credentials, role assignments, and security parameters.' : 'Set up credentials, role assignments, and security parameters.'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleCancel} 
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Employee ID</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Users className="w-4 h-4" />
                  </span>
                  <Input 
                    value={formData.empId} 
                    onChange={e => setFormData({...formData, empId: e.target.value})} 
                    placeholder="emp-0610-001" 
                    className="pl-9 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 dark:text-white rounded-xl h-11 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Full Name</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Users className="w-4 h-4" />
                  </span>
                  <Input 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="John Doe" 
                    className="pl-9 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 dark:text-white rounded-xl h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Email Address</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
                  <Input 
                    required 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    placeholder="john@kulfierp.com" 
                    className="pl-9 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 dark:text-white rounded-xl h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">
                  {editingUser ? 'New Password (Optional)' : 'Password'}
                </Label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input 
                    required={!editingUser} 
                    type={showPassword ? "text" : "password"} 
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                    placeholder={editingUser ? "•••••••• (Leave blank to keep unchanged)" : "••••••••"} 
                    className="pl-9 pr-10 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 dark:text-white rounded-xl h-11" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white focus:outline-none transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">User Role</Label>
                <Select required value={formData.role} onValueChange={val => setFormData({...formData, role: val})}>
                  <SelectTrigger className="bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 focus:border-indigo-500 text-slate-900 dark:text-white rounded-xl h-11">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                    {availableRoles.map(role => (
                      <SelectItem key={role} value={role}>{role.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex justify-between items-center">
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">IP Address Lock (Optional)</Label>
                  {(formData.role === 'MAIN_MASTER' || formData.role === 'SUPERVISOR') && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-500/20">
                      System bypass active
                    </span>
                  )}
                </div>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input 
                    value={formData.ipAddress} 
                    onChange={e => setFormData({...formData, ipAddress: e.target.value})} 
                    placeholder={
                      formData.role === 'MAIN_MASTER' || formData.role === 'SUPERVISOR'
                        ? "Bypassed for MAIN_MASTER and SUPERVISOR"
                        : "e.g. 192.168.1.100 (Leave blank for unrestricted access)"
                    }
                    className="pl-9 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 dark:text-white rounded-xl h-11 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-950/30" 
                    disabled={formData.role === 'MAIN_MASTER' || formData.role === 'SUPERVISOR'}
                  />
                </div>
                {(formData.role === 'MAIN_MASTER' || formData.role === 'SUPERVISOR') ? (
                  <p className="text-xs text-amber-600 dark:text-amber-500/80 flex items-center gap-1.5 mt-1">
                    <Info className="w-3.5 h-3.5" />
                    MAIN_MASTER and SUPERVISOR accounts bypass IP restrictions by default to enable remote administration.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                    <Info className="w-3.5 h-3.5" />
                    Restricts logins to this specific IP. Leave empty to allow logging in from any network interface.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <Button type="button" variant="ghost" onClick={handleCancel} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all"
              >
                {editingUser ? (
                  updateMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </div>
                  ) : 'Save Changes'
                ) : (
                  createMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </div>
                  ) : 'Create User'
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Control Panel: Search & Filters */}
      <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors" />
          <Input 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            placeholder="Search users by name or email..." 
            className="pl-10 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 dark:text-white rounded-xl h-10 w-full transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 h-10">
            <Filter className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Filter Matrix</span>
          </div>

          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-full sm:w-44 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 focus:border-indigo-500 text-slate-800 dark:text-slate-200 rounded-xl h-10">
              <SelectValue placeholder="Filter by Role" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
              <SelectItem value="ALL">All Roles</SelectItem>
              {availableRoles.map(role => (
                <SelectItem key={role} value={role}>{role.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-36 bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 focus:border-indigo-500 text-slate-800 dark:text-slate-200 rounded-xl h-10">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active Only</SelectItem>
              <SelectItem value="INACTIVE">Inactive Only</SelectItem>
            </SelectContent>
          </Select>

          {(searchTerm || selectedRole !== 'ALL' || selectedStatus !== 'ALL') && (
            <Button 
              variant="ghost" 
              onClick={() => { setSearchTerm(''); setSelectedRole('ALL'); setSelectedStatus('ALL'); }}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl h-10 px-3 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/40"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Users Data Grid Card */}
      <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md dark:shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/60 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/85">
              <TableRow>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs h-12">User Identity</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs h-12">Employee ID</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs h-12">Designation Role</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs h-12">IP Security Lock</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs h-12">Status Flag</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs h-12">Registered Date</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs text-right h-12 pr-6">Access Control & Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100 dark:border-slate-800/80">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-28 bg-slate-200 dark:bg-slate-800" />
                          <Skeleton className="h-3 w-36 bg-slate-200 dark:bg-slate-800" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-28 rounded-lg bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-lg bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-9 w-24 rounded-xl bg-slate-200 dark:bg-slate-800 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-3">
                      <div className="p-3 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <AlertCircle className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No users matched query parameters</p>
                        <p className="text-xs text-slate-500 mt-1">Try adjusting search query strings or resetting structural role filters.</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => { setSearchTerm(''); setSelectedRole('ALL'); setSelectedStatus('ALL'); }}
                        className="text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl mt-2"
                      >
                        Reset Matrix Filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers?.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/35 transition-colors border-b border-slate-100 dark:border-slate-800/80">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border bg-gradient-to-br ${getAvatarGradient(user.name)}`}>
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white tracking-wide text-sm">{user.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-650 dark:text-slate-300 font-semibold">{user.empId || '—'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getRoleBadgeStyle(user.role)}`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.ipAddress ? (
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-lg">
                            {user.ipAddress}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <Unlock className="w-3.5 h-3.5 text-emerald-500/70" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Open Access</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 shadow-none">
                          <span className="relative flex h-2 w-2 mr-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 shadow-none">
                          <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500 mr-1.5"></span>
                          Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500/60 dark:text-indigo-400/60" />
                        <span>{format(new Date(user.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(user)}
                          className="rounded-xl h-9 px-3 border text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all font-medium flex items-center gap-1.5"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Button>

                        {/* Status Toggle Button */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className={`rounded-xl h-9 px-3 border transition-all font-medium ${
                                user.isActive 
                                  ? "text-amber-600 dark:text-amber-400 hover:text-amber-750 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 hover:border-amber-300 dark:hover:border-amber-500/30" 
                                  : "text-emerald-600 dark:text-emerald-400 hover:text-emerald-770 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-500/30"
                              }`}
                            >
                              {user.isActive ? (
                                <div className="flex items-center gap-1.5">
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Deactivate</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Activate</span>
                                </div>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl max-w-md shadow-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
                                {user.isActive ? (
                                  <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                                    <UserX className="w-5 h-5" />
                                  </div>
                                ) : (
                                  <div className="p-2 bg-emerald-50 dark:bg-emerald-50/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                    <UserCheck className="w-5 h-5" />
                                  </div>
                                )}
                                {user.isActive ? 'Deactivate User Account?' : 'Activate User Account?'}
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-500 dark:text-slate-400 pt-2 text-sm leading-relaxed">
                                {user.isActive 
                                  ? `Are you sure you want to deactivate ${user.name}? This user will lose all access to the manufacturing ERP immediately. This action can be reversed by an administrator.` 
                                  : `Are you sure you want to reactivate ${user.name}? This will restore their access to the ERP. They will be allowed to log in using their credentials.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                              <AlertDialogCancel className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-transparent dark:border-slate-700 rounded-xl hover:text-slate-900 dark:hover:text-white">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => toggleStatusMutation.mutate({ id: user.id, isActive: user.isActive })}
                                className={`rounded-xl text-white font-semibold transition-all ${
                                  user.isActive 
                                    ? "bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20 hover:shadow-amber-600/30" 
                                    : "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30"
                                }`}
                              >
                                {user.isActive ? 'Confirm Deactivation' : 'Confirm Activation'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        {/* Delete Button */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-xl h-9 px-3 border text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 hover:border-rose-300 dark:hover:border-rose-500/30 transition-all font-medium flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl max-w-md shadow-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
                                <div className="p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
                                  <Trash2 className="w-5 h-5" />
                                </div>
                                Delete User Account?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-500 dark:text-slate-400 pt-2 text-sm leading-relaxed">
                                Are you sure you want to permanently delete the user account for <strong>{user.name}</strong>?
                                <br /><br />
                                <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-start gap-1">
                                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                  <span>Warning: This action will soft-delete the user record in order to maintain database reference integrity. They will not be able to log in or be selected for future transactions.</span>
                                </span>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                              <AlertDialogCancel className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-transparent dark:border-slate-700 rounded-xl hover:text-slate-900 dark:hover:text-white">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteMutation.mutate(user.id)}
                                className="rounded-xl text-white font-semibold transition-all bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/20 hover:shadow-rose-600/30"
                              >
                                Confirm Delete
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
      </div>
    </div>
  );
}
