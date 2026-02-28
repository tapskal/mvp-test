import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Plus, 
  Send, 
  Trash2, 
  Settings, 
  CheckCircle2, 
  AlertCircle,
  Video,
  Loader2,
  Plane,
  Github,
  Database as DbIcon,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { GitHubStorage, LocalStorageService, GitHubConfig } from './services/storage';

interface Appointment {
  id: number;
  client_name: string;
  phone_number: string;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'sent';
}

interface AppSettings {
  n8n_webhook_url: string;
  use_github: boolean;
  github_token: string;
  github_repo: string;
  github_path: string;
  github_branch: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  n8n_webhook_url: '',
  use_github: false,
  github_token: '',
  github_repo: '',
  github_path: 'remindly-data.json',
  github_branch: 'main'
};

export default function App() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newAppt, setNewAppt] = useState({
    client_name: '',
    phone_number: '',
    appointment_date: '',
    appointment_time: ''
  });

  // Triggering State
  const [triggeringIds, setTriggeringIds] = useState<Set<number>>(new Set());

  // Video Generation State
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoStatus, setVideoStatus] = useState('');

  useEffect(() => {
    const initialSettings = LocalStorageService.load('remindly_settings', DEFAULT_SETTINGS);
    setSettings(initialSettings);
    loadInitialData(initialSettings);
  }, []);

  const loadInitialData = async (currentSettings: AppSettings) => {
    setIsLoading(true);
    try {
      if (currentSettings.use_github && currentSettings.github_token && currentSettings.github_repo) {
        const gh = new GitHubStorage({
          token: currentSettings.github_token,
          repo: currentSettings.github_repo,
          path: currentSettings.github_path,
          branch: currentSettings.github_branch
        });
        const data = await gh.loadData<Appointment[]>([]);
        setAppointments(data);
      } else {
        const data = LocalStorageService.load('remindly_appointments', []);
        setAppointments(data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      const data = LocalStorageService.load('remindly_appointments', []);
      setAppointments(data);
    } finally {
      setIsLoading(false);
    }
  };

  const persistData = async (newAppointments: Appointment[]) => {
    setAppointments(newAppointments);
    setIsSaving(true);
    try {
      LocalStorageService.save('remindly_appointments', newAppointments);
      
      if (settings.use_github && settings.github_token && settings.github_repo) {
        const gh = new GitHubStorage({
          token: settings.github_token,
          repo: settings.github_repo,
          path: settings.github_path,
          branch: settings.github_branch
        });
        await gh.saveData(newAppointments);
      }
    } catch (error) {
      console.error('Error persisting data:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const appt: Appointment = {
      ...newAppt,
      id: Date.now(),
      status: 'pending'
    };
    const updated = [...appointments, appt];
    await persistData(updated);
    setNewAppt({ client_name: '', phone_number: '', appointment_date: '', appointment_time: '' });
    setIsAdding(false);
  };

  const handleDelete = async (id: number) => {
    const updated = appointments.filter(a => a.id !== id);
    await persistData(updated);
  };

  const handleTrigger = async (id: number) => {
    const appt = appointments.find(a => a.id === id);
    if (!appt || !settings.n8n_webhook_url) {
      alert('Missing appointment data or n8n Webhook URL');
      return;
    }

    setTriggeringIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(settings.n8n_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appt)
      });
      
      if (res.ok) {
        const updated = appointments.map(a => a.id === id ? { ...a, status: 'sent' as const } : a);
        await persistData(updated);
      } else {
        alert(`n8n error: ${res.status}`);
      }
    } catch (error) {
      console.error('Error triggering:', error);
      alert('Network error. Make sure your n8n webhook allows CORS or check your connection.');
    } finally {
      setTriggeringIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const saveSettings = async () => {
    LocalStorageService.save('remindly_settings', settings);
    alert('Settings saved locally! Attempting to sync...');
    await loadInitialData(settings);
  };

  const generateAirportVideo = async () => {
    setIsVideoLoading(true);
    setVideoStatus('Connecting to Veo...');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      setVideoStatus('Generating your airport video...');
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: 'A cinematic shot of a young entrepreneur working on a laptop in a busy modern airport lounge, looking focused and productive, cinematic lighting, 4k',
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        setVideoStatus('Processing video (this may take a minute)...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': process.env.GEMINI_API_KEY as string,
          },
        });
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob));
      }
    } catch (error) {
      console.error('Error generating video:', error);
      alert('Video generation failed. Please check your API key and billing.');
    } finally {
      setIsVideoLoading(false);
      setVideoStatus('');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Remindly</h1>
              {isSaving && <Loader2 size={16} className="animate-spin text-indigo-400" />}
            </div>
            <p className="text-slate-500 mt-1">Manage your business appointments and automate reminders.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              <Plus size={20} />
              <span>New Appointment</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content: Appointments List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-bottom border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-600" />
                  Upcoming Appointments
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {settings.use_github ? 'GitHub Sync On' : 'Local Storage'}
                  </span>
                  <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                    {appointments.length} Total
                  </span>
                </div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {appointments.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No appointments scheduled yet.</p>
                  </div>
                ) : (
                  appointments.map((appt) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={appt.id} 
                      className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                          {appt.client_name[0]}
                        </div>
                        <div>
                          <h3 className="font-medium">{appt.client_name}</h3>
                          <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                            <span className="flex items-center gap-1"><Phone size={14} /> {appt.phone_number}</span>
                            <span className="flex items-center gap-1"><Clock size={14} /> {appt.appointment_date} @ {appt.appointment_time}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {appt.status === 'sent' ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                            <CheckCircle2 size={12} /> Sent
                          </span>
                        ) : (
                          <button 
                            onClick={() => handleTrigger(appt.id)}
                            disabled={triggeringIds.has(appt.id)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-50"
                            title="Trigger n8n Reminder"
                          >
                            {triggeringIds.has(appt.id) ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Send size={18} />
                            )}
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(appt.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar: Settings & Tools */}
          <div className="space-y-6">
            
            {/* Airport MVP Mode */}
            <div className="bg-indigo-900 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Plane size={20} className="text-indigo-300" />
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">Airport MVP Mode</span>
                </div>
                <h3 className="text-lg font-bold mb-2">Building in the Airport?</h3>
                <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
                  Generate a cinematic video of your "Airport Coding Session" to share your journey.
                </p>
                
                {videoUrl ? (
                  <div className="space-y-4">
                    <video src={videoUrl} controls className="w-full rounded-xl shadow-2xl" />
                    <button 
                      onClick={() => setVideoUrl(null)}
                      className="text-xs text-indigo-300 hover:text-white underline"
                    >
                      Generate another
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={generateAirportVideo}
                    disabled={isVideoLoading}
                    className="w-full flex items-center justify-center gap-2 bg-white text-indigo-900 font-bold py-3 rounded-xl hover:bg-indigo-50 transition-all disabled:opacity-50"
                  >
                    {isVideoLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        <span className="text-sm">{videoStatus}</span>
                      </>
                    ) : (
                      <>
                        <Video size={20} />
                        <span>Generate Airport Video</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-800 rounded-full blur-3xl opacity-50"></div>
            </div>

            {/* GitHub Database Settings */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Github size={18} className="text-slate-900" />
                  <h3 className="font-semibold">GitHub Database</h3>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.use_github}
                  onChange={(e) => setSettings({...settings, use_github: e.target.checked})}
                  className="w-4 h-4 accent-indigo-600"
                />
              </div>
              
              <AnimatePresence>
                {settings.use_github && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <p className="text-[10px] text-slate-400 leading-tight mb-2">
                      Store your data in a JSON file in your repo. Requires a Personal Access Token with 'repo' scope.
                    </p>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Personal Access Token</label>
                      <input 
                        type="password" 
                        value={settings.github_token}
                        onChange={(e) => setSettings({...settings, github_token: e.target.value})}
                        placeholder="ghp_..."
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Repository (owner/repo)</label>
                      <input 
                        type="text" 
                        value={settings.github_repo}
                        onChange={(e) => setSettings({...settings, github_repo: e.target.value})}
                        placeholder="username/remindly-data"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">File Path</label>
                        <input 
                          type="text" 
                          value={settings.github_path}
                          onChange={(e) => setSettings({...settings, github_path: e.target.value})}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Branch</label>
                        <input 
                          type="text" 
                          value={settings.github_branch}
                          onChange={(e) => setSettings({...settings, github_branch: e.target.value})}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <Settings size={16} className="text-slate-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">n8n Webhook</h4>
                </div>
                <input 
                  type="text" 
                  value={settings.n8n_webhook_url}
                  onChange={(e) => setSettings({...settings, n8n_webhook_url: e.target.value})}
                  placeholder="https://n8n.your-domain.com/..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 mb-3"
                />
                <button 
                  onClick={saveSettings}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-all"
                >
                  <Save size={16} />
                  Save All Settings
                </button>
              </div>
            </div>

            {/* Guide */}
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6">
              <div className="flex items-center gap-2 mb-3 text-amber-700">
                <AlertCircle size={18} />
                <h3 className="font-semibold text-sm">Deployment Guide</h3>
              </div>
              <ul className="text-xs text-amber-800 space-y-3">
                <li className="flex gap-2">
                  <span className="font-bold">1.</span>
                  <span>Netlify is static. SQLite won't work there.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">2.</span>
                  <span>I've enabled **LocalStorage** so it works instantly on Netlify.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">3.</span>
                  <span>To sync across devices, enable **GitHub Database** above.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">4.</span>
                  <span>Create a GitHub Token at `github.com/settings/tokens`.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Add Appointment Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold">New Appointment</h2>
              </div>
              <form onSubmit={handleAddAppointment} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                      required
                      type="text" 
                      value={newAppt.client_name}
                      onChange={(e) => setNewAppt({...newAppt, client_name: e.target.value})}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                      required
                      type="tel" 
                      value={newAppt.phone_number}
                      onChange={(e) => setNewAppt({...newAppt, phone_number: e.target.value})}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      placeholder="+1234567890"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input 
                      required
                      type="date" 
                      value={newAppt.appointment_date}
                      onChange={(e) => setNewAppt({...newAppt, appointment_date: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                    <input 
                      required
                      type="time" 
                      value={newAppt.appointment_time}
                      onChange={(e) => setNewAppt({...newAppt, appointment_time: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl font-medium hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-md"
                  >
                    Schedule
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
