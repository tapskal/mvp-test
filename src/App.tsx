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
  Plane
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

interface Appointment {
  id: number;
  client_name: string;
  phone_number: string;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'sent';
}

export default function App() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [n8nUrl, setN8nUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [apptsRes, settingsRes] = await Promise.all([
        fetch('/api/appointments'),
        fetch('/api/settings')
      ]);
      const apptsData = await apptsRes.json();
      const settingsData = await settingsRes.json();
      setAppointments(apptsData);
      setN8nUrl(settingsData.n8n_webhook_url || '');
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAppt)
      });
      if (res.ok) {
        setNewAppt({ client_name: '', phone_number: '', appointment_date: '', appointment_time: '' });
        setIsAdding(false);
        fetchData();
      }
    } catch (error) {
      console.error('Error adding appointment:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleTrigger = async (id: number) => {
    setTriggeringIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/trigger-reminder/${id}`, { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        await fetchData();
      } else {
        alert(`Error: ${data.error || 'Failed to trigger reminder'}`);
      }
    } catch (error) {
      console.error('Error triggering:', error);
      alert('Network error. Please check your connection.');
    } finally {
      setTriggeringIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const saveSettings = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n8n_webhook_url: n8nUrl })
      });
      alert('Settings saved!');
    } catch (error) {
      console.error('Error saving settings:', error);
    }
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
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Remindly</h1>
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
                <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                  {appointments.length} Total
                </span>
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

            {/* n8n Settings */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Settings size={18} className="text-slate-400" />
                <h3 className="font-semibold">Automation Settings</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">n8n Webhook URL</label>
                  <input 
                    type="text" 
                    value={n8nUrl}
                    onChange={(e) => setN8nUrl(e.target.value)}
                    placeholder="https://n8n.your-domain.com/..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <button 
                  onClick={saveSettings}
                  className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-all"
                >
                  Save Configuration
                </button>
              </div>
            </div>

            {/* Guide */}
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6">
              <div className="flex items-center gap-2 mb-3 text-amber-700">
                <AlertCircle size={18} />
                <h3 className="font-semibold">MVP Guide</h3>
              </div>
              <ul className="text-sm text-amber-800 space-y-3">
                <li className="flex gap-2">
                  <span className="font-bold">1.</span>
                  <span>Set up an n8n workflow with a "Webhook" trigger.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">2.</span>
                  <span>Add a "WhatsApp" node (using Twilio or Meta API).</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">3.</span>
                  <span>Paste the Webhook URL here in settings.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">4.</span>
                  <span>Click the "Send" icon on any appointment to trigger.</span>
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
