import React, { useState, useEffect } from 'react';
import { Building2, BookOpen, Layers, Plus, X } from 'lucide-react';
import { api } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

export default function AdminAcademic() {
  const { showToast } = useNotification();
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);

  // New Department Form
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');

  // New Subject Form
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subDeptId, setSubDeptId] = useState('');
  const [subCredits, setSubCredits] = useState('4');

  const loadStructure = async () => {
    try {
      setLoading(true);
      const res = await api.get('/academic/structure');
      if (res.success) {
        setStructure(res.data);
        if (res.data.departments.length > 0) {
          setSubDeptId(res.data.departments[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load academic structure:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStructure();
  }, []);

  const handleCreateDept = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/academic/department', { code: deptCode, name: deptName });
      if (res.success) {
        showToast('Department created successfully!', 'success');
        setIsDeptModalOpen(false);
        setDeptCode('');
        setDeptName('');
        loadStructure();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/academic/subject', {
        code: subCode,
        name: subName,
        department_id: subDeptId,
        credits: parseInt(subCredits) || 3
      });
      if (res.success) {
        showToast('Subject created successfully!', 'success');
        setIsSubModalOpen(false);
        setSubCode('');
        setSubName('');
        loadStructure();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Academic Hierarchy & Curriculum</h2>
          <p className="text-xs text-slate-500">Departments, Degree Classes, Sections, and Course Modules</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDeptModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" /> Add Department
          </button>
          <button
            onClick={() => setIsSubModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Subject
          </button>
        </div>
      </div>

      {/* Grid: Departments & Classes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Departments List */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Departments ({structure?.departments?.length || 0})
              </h3>
            </div>
          </div>

          <div className="space-y-2">
            {structure?.departments?.map((d) => (
              <div
                key={d.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-slate-900 text-xs block">{d.name}</span>
                  <span className="text-[10px] text-indigo-700 font-mono font-bold">Code: {d.code}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 shadow-xs">
                  4 Active Classes
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Classes & Sections List */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Classes & Sections ({structure?.classes?.length || 0})
              </h3>
            </div>
          </div>

          <div className="space-y-2">
            {structure?.classes?.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-slate-900 text-xs block">{c.name}</span>
                  <span className="text-[10px] text-slate-500">
                    Dept: {c.department_name} • {c.year_label}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {c.code}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subjects Catalog */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Subjects & Course Modules ({structure?.subjects?.length || 0})
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {structure?.subjects?.map((sub) => (
            <div key={sub.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-mono">
                  {sub.code}
                </span>
                <span className="text-[10px] text-slate-500 font-bold">{sub.credits} Credits</span>
              </div>
              <h4 className="text-xs font-bold text-slate-900">{sub.name}</h4>
              <p className="text-[11px] text-slate-500">{sub.department_name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: ADD DEPARTMENT */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create Department</h3>
              <button onClick={() => setIsDeptModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateDept} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department Code</label>
                <input
                  required
                  type="text"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  placeholder="e.g. MECH, BIOTECH"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department Full Name</label>
                <input
                  required
                  type="text"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Mechanical Engineering"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>
              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
              >
                Create Department
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUBJECT */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create Subject</h3>
              <button onClick={() => setIsSubModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubject} className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject Code</label>
                  <input
                    required
                    type="text"
                    value={subCode}
                    onChange={(e) => setSubCode(e.target.value)}
                    placeholder="e.g. CS305"
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Credits</label>
                  <input
                    type="number"
                    value={subCredits}
                    onChange={(e) => setSubCredits(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject Name</label>
                <input
                  required
                  type="text"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. Cloud Computing & DevOps"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={subDeptId}
                  onChange={(e) => setSubDeptId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                >
                  {structure?.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
              >
                Create Subject
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
