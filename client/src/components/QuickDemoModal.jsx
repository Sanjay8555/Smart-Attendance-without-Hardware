import React from 'react';
import { Sparkles, Shield, User, Layers, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export default function QuickDemoModal({ isOpen, onClose }) {
  const { login } = useAuth();
  const { showToast } = useNotification();

  if (!isOpen) return null;

  const demoAccounts = [
    {
      role: 'admin',
      title: 'Administrator (Dean)',
      name: 'Dr. Vikram Malhotra',
      email: 'admin@college.edu',
      password: 'Admin@123',
      icon: Shield,
      badge: 'Full Control',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      description: 'Manage users, geofences, dynamic rules, reports & misuse security audits.'
    },
    {
      role: 'faculty',
      title: 'Faculty Member',
      name: 'Prof. Rajesh Sharma (HOD CSE)',
      email: 'faculty.sharma@college.edu',
      password: 'Faculty@123',
      icon: Layers,
      badge: 'Start Sessions',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      description: 'Launch live attendance session, dynamic rotating QR, OTP & live monitor.'
    },
    {
      role: 'student',
      title: 'Student (Normal Attendance)',
      name: 'Alex Johnson (Roll: 22CS01)',
      email: 'alex@college.edu',
      password: 'Student@123',
      icon: User,
      badge: '95% Attendance',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Mark attendance using dynamic QR code or camera face verification + GPS + OTP.'
    },
    {
      role: 'student',
      title: 'Student (Low Attendance Warning)',
      name: 'Rahul Mehta (Roll: 22CS03)',
      email: 'rahul@college.edu',
      password: 'Student@123',
      icon: User,
      badge: '68% Attendance (Alert)',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      description: 'Shows low-attendance recovery meter, deficit classes counter, and active alerts.'
    }
  ];

  const handleSelect = async (account) => {
    try {
      await login(account.email, account.password);
      showToast(`Logged in as ${account.name} (${account.role.toUpperCase()})`, 'success');
      onClose();
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Select Demo Account</h2>
              <p className="text-xs text-slate-500">Switch roles instantly to test all multi-factor attendance workflows</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {demoAccounts.map((account, idx) => {
            const Icon = account.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSelect(account)}
                className="group flex flex-col justify-between text-left p-4 rounded-2xl bg-slate-50/70 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all duration-200 cursor-pointer shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-700">{account.title}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${account.badgeColor}`}>
                      {account.badge}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                    {account.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">{account.email}</p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{account.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-indigo-600 group-hover:text-indigo-700 font-bold">
                  <span>Sign In Instantly</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
