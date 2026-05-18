import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Camera, Save, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';

const ChangeProfilePage = () => {
  const user = useAuthStore(s => s.user);
  const setAuth = useAuthStore(s => s.setAuth);
  const token = useAuthStore(s => s.token);
  const navigate = useNavigate();
  const fileRef = useRef();

  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [preview, setPreview] = useState(user?.profilePhoto || null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { setError('Image must be under 1MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
      setPhotoBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const payload = { name: form.name, email: form.email };
      if (photoBase64) payload.profilePhoto = photoBase64;
      const res = await api.patch('/users/profile', payload);
      // Update auth store
      setAuth(token, { ...user, name: res.data.name, email: res.data.email, profilePhoto: res.data.profilePhoto });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Change Profile</h1>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header Banner */}
        <div className="h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />

        <div className="px-8 pb-8">
          {/* Avatar */}
          <div className="relative -mt-16 mb-6 flex items-end gap-4">
            <div className="relative">
              <div className="w-28 h-28 rounded-2xl border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                {preview ? (
                  <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-300">
                    {form.name?.substring(0, 2).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/jpg" className="hidden" onChange={handlePhotoChange} />
            </div>
            <div className="mb-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">Photo: 45×45px, jpeg/jpg/png, max 1MB</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Profile updated successfully!
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Name <span className="text-red-500">*</span></label>
                <input
                  type="text" required value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input
                  type="email" required value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Role</label>
              <input disabled value={user?.role?.replace(/_/g, ' ')} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-500 cursor-not-allowed" />
            </div>
            <button
              type="submit" disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangeProfilePage;
