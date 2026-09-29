import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, CheckCircle2, Navigation, Radio, X } from 'lucide-react';
import { api } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { getDeviceCoordinates } from '../../services/geo';

export default function AdminGeofences() {
  const { showToast } = useNotification();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [locName, setLocName] = useState('');
  const [locLat, setLocLat] = useState('12.971598');
  const [locLng, setLocLng] = useState('77.594562');
  const [locRadius, setLocRadius] = useState('150');
  const [locDesc, setLocDesc] = useState('');
  const [editingId, setEditingId] = useState(null);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/locations');
      if (res.success) {
        setLocations(res.data);
      }
    } catch (err) {
      console.error('Failed to load locations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const handleUseCurrentLocation = async () => {
    try {
      showToast('Reading GPS coordinates from device...', 'info');
      const coords = await getDeviceCoordinates();
      setLocLat(coords.latitude.toFixed(6));
      setLocLng(coords.longitude.toFixed(6));
      showToast('Coordinates filled from current location!', 'success');
    } catch (e) {
      showToast(e.message || 'Could not fetch device GPS', 'error');
    }
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: locName.trim(),
        latitude: parseFloat(locLat),
        longitude: parseFloat(locLng),
        radius_meters: parseFloat(locRadius) || 100,
        description: locDesc.trim()
      };

      if (editingId) {
        await api.put(`/locations/${editingId}`, payload);
        showToast('Geofence location updated.', 'success');
      } else {
        await api.post('/locations', payload);
        showToast('New geofence location created.', 'success');
      }

      setIsModalOpen(false);
      setEditingId(null);
      setLocName('');
      setLocDesc('');
      loadLocations();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteLocation = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove geofence: ${name}?`)) return;
    try {
      await api.delete(`/locations/${id}`);
      showToast('Geofence location removed.', 'info');
      loadLocations();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Campus GPS Geofence Boundaries</h2>
          <p className="text-xs text-slate-500">Configure authorized physical latitude/longitude zones and radius tolerance</p>
        </div>

        <button
          onClick={() => {
            setEditingId(null);
            setLocName('');
            setLocDesc('');
            setLocLat('12.971598');
            setLocLng('77.594562');
            setLocRadius('150');
            setIsModalOpen(true);
          }}
          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Campus Geofence
        </button>
      </div>

      {/* Geofence Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {locations.map((loc) => (
          <div
            key={loc.id}
            className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200">
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active Radius: {loc.radius_meters}m
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900">{loc.name}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {loc.description || 'Authorized classroom lecture zones'}
              </p>

              {/* Coordinates details */}
              <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Latitude:</span>
                  <span className="text-slate-900 font-bold">{loc.latitude}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Longitude:</span>
                  <span className="text-slate-900 font-bold">{loc.longitude}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setEditingId(loc.id);
                  setLocName(loc.name);
                  setLocLat(String(loc.latitude));
                  setLocLng(String(loc.longitude));
                  setLocRadius(String(loc.radius_meters));
                  setLocDesc(loc.description || '');
                  setIsModalOpen(true);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit Geofence
              </button>

              <button
                onClick={() => handleDeleteLocation(loc.id, loc.name)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                title="Delete Geofence"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE / EDIT GEOFENCE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit Campus Geofence' : 'New Campus Geofence'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Geofence Name</label>
                <input
                  required
                  type="text"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  placeholder="e.g. Computing Lab Complex"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Latitude</label>
                  <input
                    required
                    type="number"
                    step="any"
                    value={locLat}
                    onChange={(e) => setLocLat(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Longitude</label>
                  <input
                    required
                    type="number"
                    step="any"
                    value={locLng}
                    onChange={(e) => setLocLng(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-sky-700 border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5 text-sky-600" /> Auto-Fill from Device Current Coordinates
              </button>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Allowed Radius (Meters)</label>
                <input
                  required
                  type="number"
                  min="20"
                  max="1000"
                  value={locRadius}
                  onChange={(e) => setLocRadius(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Zone Description</label>
                <textarea
                  rows={2}
                  value={locDesc}
                  onChange={(e) => setLocDesc(e.target.value)}
                  placeholder="Lecture halls and seminar rooms inside this perimeter..."
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
              >
                {editingId ? 'Save Changes' : 'Create Geofence Zone'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
