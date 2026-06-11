import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createTicket, hasActiveTicket, saveRegistration } from '../../lib/db';
import { 
  Mountain, 
  Calendar, 
  User, 
  ArrowRight, 
  ChevronLeft,
  AlertCircle,
  Sparkles,
  CheckSquare,
  Square,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';

interface FormData {
  mountain: string;
  dateStart: string;
  dateEnd: string;
  isLeader: boolean;
  members: Array<{ id: string; name: string }>;
  checkedGears: Record<string, boolean>;
}

const MANDATORY_ITEMS = [
  { id: 'tenda', label: 'Tenda Dome (min. 1 tenda kapasitas sesuai anggota)', category: 'Kelompok' },
  { id: 'kompor', label: 'Kompor Portable & Gas Cadangan', category: 'Kelompok' },
  { id: 'nesting', label: 'Peralatan Memasak / Nesting', category: 'Kelompok' },
  { id: 'p3k', label: 'Kotak P3K & Obat Darurat Kelompok', category: 'Kelompok' },
  { id: 'trash_bag', label: 'Kantong Sampah / Trash Bag (Wajib bawa turun kembali)', category: 'Kelompok' },
  { id: 'sleeping_bag', label: 'Sleeping Bag (1 buah per pendaki)', category: 'Pribadi' },
  { id: 'matras', label: 'Matras Alas Tidur (1 buah per pendaki)', category: 'Pribadi' },
  { id: 'jaket', label: 'Jaket Gunung Tebal (1 buah per pendaki)', category: 'Pribadi' },
  { id: 'jas_hujan', label: 'Jas Hujan / Windshield (1 buah per pendaki)', category: 'Pribadi' },
  { id: 'air', label: 'Air Konsumsi Bersih (Minimum 3 Liter)', category: 'Pribadi' },
  { id: 'senter', label: 'Headlamp / Senter & Baterai Cadangan', category: 'Pribadi' }
];

export default function SimaksiSubmit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<FormData>({
    mountain: 'Gn. Slamet',
    dateStart: '',
    dateEnd: '',
    isLeader: false,
    members: [],
    checkedGears: MANDATORY_ITEMS.reduce((acc, item) => ({ ...acc, [item.id]: false }), {}),
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTicketError, setActiveTicketError] = useState('');

  useEffect(() => {
    // Check if user already has active ticket
    const checkTicket = async () => {
      if (!user?.id) return;
      const hasActive = await hasActiveTicket(user.id);
      if (hasActive) {
        setActiveTicketError('Anda sudah memiliki tiket aktif. Silakan selesaikan pendakian sebelumnya.');
      }
    };
    checkTicket();
  }, [user?.id]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.dateStart) {
      errors.dateStart = 'Tanggal naik wajib diisi';
    }
    if (!formData.dateEnd) {
      errors.dateEnd = 'Tanggal turun wajib diisi';
    }
    if (formData.dateStart && formData.dateEnd && new Date(formData.dateStart) > new Date(formData.dateEnd)) {
      errors.dateEnd = 'Tanggal turun tidak boleh lebih awal dari tanggal naik';
    }

    if (formData.isLeader) {
      const allChecked = Object.values(formData.checkedGears).every(val => val === true);
      if (!allChecked) {
        errors.gear = 'Seluruh checklist barang bawaan wajib harus dicentang demi keselamatan kelompok';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user) return;

    if (activeTicketError) {
      alert(activeTicketError);
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate ticket ID (use user's ID as ticket ID)
      const ticketId = user.id;

      // Create ticket in Supabase
      const ticketCreated = await createTicket({
        id: ticketId,
        mountainName: formData.mountain,
        date: formData.dateStart,
        endDate: formData.dateEnd,
        status: 'PENDING',
      });

      if (!ticketCreated) {
        setFormErrors({ submit: 'Gagal membuat tiket. Silakan coba lagi.' });
        setIsSubmitting(false);
        return;
      }

      // Save registration record
      await saveRegistration({
        userId: user.id,
        name: user.name,
        nik: user.nik || '',
        phone: user.phone || '',
        emergencyPhone: user.emergencyPhone || '',
        birthDate: '1995-01-01',
        gender: user.gender || 'Laki-laki',
        address: user.address || '',
        mountain: formData.mountain,
        date: formData.dateStart,
        endDate: formData.dateEnd,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        isLeader: formData.isLeader,
        ...(formData.isLeader && { members: formData.members }),
        ...(formData.isLeader && { checkedGears: Object.keys(formData.checkedGears).filter(k => formData.checkedGears[k]) }),
      });

      // Show success and redirect
      setTimeout(() => {
        navigate('/user/dashboard', { state: { simaksiSuccess: true } });
      }, 1500);
    } catch (err) {
      console.error('Submission error:', err);
      setFormErrors({ submit: 'Terjadi kesalahan. Silakan coba lagi.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (activeTicketError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-rose-50 border border-rose-200 rounded-[2rem] p-8 max-w-md text-center"
        >
          <AlertCircle className="w-16 h-16 text-rose-600 mx-auto mb-4" />
          <h2 className="text-xl font-black text-rose-700 italic uppercase mb-3">Tiket Sudah Aktif</h2>
          <p className="text-slate-600 text-sm font-bold mb-6">{activeTicketError}</p>
          <button
            onClick={() => navigate('/user/dashboard')}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-3 rounded-xl transition-all"
          >
            Kembali ke Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto pt-10 pb-12 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/user/dashboard')}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 italic uppercase">Ajukan SIMAKSI</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Buat rencana pendakian baru</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mountain */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-lg">
          <label className="block text-sm font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Mountain className="w-5 h-5 text-emerald-600" />
            Gunung Tujuan
          </label>
          <input
            type="text"
            value={formData.mountain}
            readOnly
            className="w-full bg-emerald-50 border border-emerald-200 rounded-xl py-3 px-4 text-slate-800 font-bold cursor-not-allowed"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-lg">
            <label className="block text-sm font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Tanggal Naik
            </label>
            <input
              type="date"
              value={formData.dateStart}
              onChange={(e) => setFormData({ ...formData, dateStart: e.target.value })}
              className="w-full border border-slate-200 rounded-xl py-3 px-4 text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
            />
            {formErrors.dateStart && (
              <p className="text-xs text-rose-500 font-bold mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {formErrors.dateStart}
              </p>
            )}
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-lg">
            <label className="block text-sm font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Tanggal Turun
            </label>
            <input
              type="date"
              value={formData.dateEnd}
              onChange={(e) => setFormData({ ...formData, dateEnd: e.target.value })}
              className="w-full border border-slate-200 rounded-xl py-3 px-4 text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
            />
            {formErrors.dateEnd && (
              <p className="text-xs text-rose-500 font-bold mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {formErrors.dateEnd}
              </p>
            )}
          </div>
        </div>

        {/* Leader Checkbox */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isLeader}
              onChange={(e) => setFormData({ ...formData, isLeader: e.target.checked })}
              className="w-5 h-5 cursor-pointer"
            />
            <span className="font-black text-slate-800 uppercase tracking-wide">Saya adalah Ketua Kelompok</span>
          </label>
        </div>

        {/* Gear Checklist (if leader) */}
        {formData.isLeader && (
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-lg space-y-4">
            <h3 className="font-black text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
              Checklist Barang Bawaan
            </h3>
            <div className="space-y-3">
              {MANDATORY_ITEMS.map(item => (
                <label key={item.id} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.checkedGears[item.id] || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        checkedGears: { ...formData.checkedGears, [item.id]: e.target.checked }
                      })
                    }
                    className="w-5 h-5 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{item.label}</p>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">{item.category}</p>
                  </div>
                </label>
              ))}
            </div>
            {formErrors.gear && (
              <p className="text-xs text-rose-500 font-bold flex items-center gap-1 mt-3">
                <AlertCircle className="w-3 h-3" /> {formErrors.gear}
              </p>
            )}
          </div>
        )}

        {/* Submit Error */}
        {formErrors.submit && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
            <p className="text-sm text-rose-700 font-bold">{formErrors.submit}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/user/dashboard')}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black px-6 py-4 rounded-2xl uppercase tracking-widest transition-all"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black px-6 py-4 rounded-2xl uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Mengirim...' : 'Ajukan SIMAKSI'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
