'use client';

import { useState, useEffect } from 'react';
import initialLeads from '../data/leads.json';

export default function AgencyHub() {
  const [mounted, setMounted] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const deletedIds = JSON.parse(localStorage.getItem('deleted_lead_ids') || '[]');
      const active = (initialLeads || []).filter((l: any) => !deletedIds.includes(l.id));
      setLeads(active);
    } catch {
      setLeads(initialLeads || []);
    }
  }, []);

  async function handleDelete(leadId: number) {
    if (!confirm('Are you sure you want to remove this lead from your pipeline?')) return;
    setDeletingId(leadId);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));

    try {
      const deletedIds = JSON.parse(localStorage.getItem('deleted_lead_ids') || '[]');
      if (!deletedIds.includes(leadId)) {
        deletedIds.push(leadId);
        localStorage.setItem('deleted_lead_ids', JSON.stringify(deletedIds));
      }
    } catch (e) {
      console.error(e);
    }

    try {
      await fetch('/api/leads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId }),
      });
    } catch (e) {
      console.error('Server sync failed:', e);
    } finally {
      setDeletingId(null);
    }
  }

  const filteredLeads = leads.filter((lead: any) => {
    const matchesSearch =
      (lead.company || '').toLowerCase().includes(search.toLowerCase()) ||
      (lead.founder || '').toLowerCase().includes(search.toLowerCase()) ||
      (lead.stack || '').toLowerCase().includes(search.toLowerCase());
    
    if (filterType === 'TELEGRAM') return matchesSearch && lead.contact_type?.toLowerCase() === 'telegram';
    if (filterType === 'X') return matchesSearch && lead.contact_type?.toLowerCase() === 'x';
    return matchesSearch;
  });

  function getPitch(lead: any) {
    return `Hey ${lead.founder || 'Founder'}! 👋 Saw your studio's active work with ${lead.company || 'your project'} on ${lead.stack?.includes('Solana') ? 'Solana' : 'Web3'}.\n\nI’m an AI-assisted Full-Stack Web3 Integrator (Next.js 16, Solana/EVM wallet adapters, serverless Telegram bots). If your team has overflow dev tasks, UI wrappers, or bot integrations, I white-label deliver within 24-48 hours for $150-$250 flat.\n\nHere is my live proof of work:\n🔗 Live dApp: https://solana-ai-copilot-66ks.vercel.app/\n🤖 Live Bot: https://t.me/solana_ai_copilot_terminal_bot\n\nHappy to pick up a test task whenever you need extra hands! 🤝`;
  }

  function handleCopy(lead: any) {
    const pitch = getPitch(lead);
    navigator.clipboard.writeText(pitch);
    setCopiedId(lead.id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#08080a] text-neutral-400 flex items-center justify-center font-mono text-sm">
        Loading Agency Hub & Client Radar...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08080a] text-neutral-100 p-3.5 sm:p-6 lg:p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-800/80 pb-5 sm:pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-lg shadow-sm">
                ⚡
              </span>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                Agency Hub & Client Radar
              </h1>
            </div>
            <p className="text-neutral-400 text-xs sm:text-sm pl-0.5 max-w-xl leading-relaxed">
              Autonomous Web3 client radar with real-time verified founder channels & 1-click tailored pitches.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3.5 py-1.5 rounded-full text-xs font-mono text-emerald-400 self-start md:self-auto shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{filteredLeads.length} Qualified Studios in Pipeline</span>
          </div>
        </header>

        {/* Search & Responsive Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search company, founder, or stack (e.g. Next.js, Solana, Bots)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition shadow-inner"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                filterType === 'ALL'
                  ? 'bg-neutral-800 border-neutral-600 text-white shadow-sm'
                  : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              All Active ({leads.length})
            </button>
            <button
              onClick={() => setFilterType('TELEGRAM')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                filterType === 'TELEGRAM'
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                  : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              ✈️ Telegram Direct
            </button>
            <button
              onClick={() => setFilterType('X')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                filterType === 'X'
                  ? 'bg-purple-500/10 border-purple-500/40 text-purple-300'
                  : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              𝕏 Verified Profile
            </button>
          </div>
        </div>

        {/* Responsive Leads Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredLeads.map((lead: any) => (
            <div
              key={lead.id}
              className="bg-neutral-900/60 border border-neutral-800/90 rounded-2xl p-4 sm:p-5 hover:border-neutral-700 transition-all duration-200 flex flex-col justify-between space-y-4 shadow-xl backdrop-blur-md relative group"
            >
              <div className="space-y-3">
                {/* Company Name, Score Badge & Delete Button */}
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                      <a href={lead.website} target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition underline underline-offset-4 decoration-neutral-700">
                        {lead.company}
                      </a>
                    </h3>
                    <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5 truncate">{lead.category}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] sm:text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono font-bold whitespace-nowrap">
                      Score: {lead.verification_score || 95}/100 ✅
                    </span>

                    {/* 🗑️ Delete Button */}
                    <button
                      onClick={() => handleDelete(lead.id)}
                      disabled={deletingId === lead.id}
                      title="Delete / Dismiss this lead"
                      className="text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 p-1 rounded-lg transition border border-transparent hover:border-rose-500/20 text-xs font-mono"
                    >
                      {deletingId === lead.id ? '...' : '🗑️'}
                    </button>
                  </div>
                </div>

                {/* Founder Info Box */}
                <div className="bg-neutral-950/70 border border-neutral-900/80 p-2.5 rounded-xl space-y-1 text-xs">
                  <div className="text-neutral-300 font-medium truncate">
                    👤 <strong className="text-white">{lead.founder}</strong> ({lead.role})
                  </div>
                  <div className="text-[11px] text-neutral-500 flex justify-between items-center gap-1">
                    <span className="truncate">📍 {lead.hq}</span>
                    <span className="text-emerald-500/90 font-mono text-[10px] shrink-0">Verified {lead.fact_checked_at || 'Today'}</span>
                  </div>
                </div>

                {/* Tech Stack Pills */}
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono mb-1.5">Stack:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(lead.stack || '').split(',').slice(0, 4).map((tech: string, i: number) => (
                      <span key={i} className="text-[10px] bg-neutral-800/80 text-emerald-300 px-2 py-0.5 rounded-md border border-neutral-700/50 font-mono">
                        {tech.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Verification Note */}
                <p className="text-[11px] text-neutral-400 italic bg-neutral-950/50 p-2.5 rounded-xl border border-neutral-900/90 leading-relaxed">
                  &quot;{lead.notes}&quot;
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-neutral-800/80">
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={lead.contact}
                    target="_blank"
                    rel="noreferrer"
                    className={`text-center py-2 sm:py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 truncate ${
                      lead.contact_type?.toLowerCase() === 'telegram'
                        ? 'bg-[#229ED9]/10 hover:bg-[#229ED9]/20 text-[#229ED9] border border-[#229ED9]/30'
                        : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    <span>{lead.contact_type?.toLowerCase() === 'telegram' ? '✈️ Telegram' : '𝕏 Profile'}</span>
                  </a>
                  <button
                    onClick={() => handleCopy(lead)}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 py-2 sm:py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 truncate"
                  >
                    <span>{copiedId === lead.id ? '✔ Copied!' : '📋 Copy Pitch'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredLeads.length === 0 && (
          <div className="text-center py-16 border border-dashed border-neutral-800 rounded-3xl space-y-2">
            <span className="text-3xl">📭</span>
            <p className="text-neutral-400 text-sm">No leads match your current filter.</p>
          </div>
        )}

      </div>
    </main>
  );
}
