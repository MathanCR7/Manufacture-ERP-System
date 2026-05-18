import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Send, Loader2, CheckCircle, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';

const ChangePasswordPage = () => {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '', message: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match.'); return;
    }
    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters.'); return;
    }
    setLoading(true); setError('');
    try {
      await api.post('/users/request-password-change', {
        newPassword: form.newPassword,
        message: form.message,
      });
      setSuccess(true);
      setForm({ newPassword: '', confirmPassword: '', message: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send request.');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Change Password</h1>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">How it works</p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
            Your password change request will be sent to the <strong>Master Admin</strong> via notification. The admin will review and update your password, then notify you.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">Request from: {user?.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-5 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Request sent successfully!</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">The master admin has been notified. Please wait for confirmation.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Requested New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'} required
                value={form.newPassword} minLength={6}
                onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
                placeholder="Enter your desired new password"
                className="w-full px-4 py-2.5 pr-12 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <input
              type={showPass ? 'text' : 'password'} required
              value={form.confirmPassword}
              onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
              placeholder="Confirm your desired password"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Message to Admin (optional)</label>
            <textarea
              value={form.message}
              onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              placeholder="Add any reason or additional message for the admin..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-md disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? 'Sending Request…' : 'Send Request to Admin'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
