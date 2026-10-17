'use client';

import { useState } from 'react';
import leadsData from '../data/leads.json';

export default function AgencyHub() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filteredLeads = leadsData.filter((lead) => {
    const matchesSearch =
      lead.company.toLowerCase().includes(search.toLowerCase()) ||
      lead.founder.toLowerCase().includes(search.toLowerCase()) ||
      lead.stack.toLowerCase().includes(search.toLowerCase());
    
    if (filterType === 'TELEGRAM') return matchesSearch && lead.contact_type === 'Telegram';
    if (filterType === 'X') return matchesSearch && lead.contact_type === 'X';
    return matchesSearch;
  });

  function getPitch(lead: any) {
    return `Hey ${lead.founder}! 👋 Saw the great work you're doing with ${lead.company} on ${lead.stack.includes('Solana') ? 'Solana' : 'Web3'}.\n\nI’m an AI-assisted Full-Stack Web3 Integrator (Next.js 16, Solana/EVM wallet adapters, serverless Telegram bots). If your team ever has overflow dev tasks, UI wrappers, or bot integrations you don't have time for, I can white-label deliver within 24-48 hours for $150-$250 flat.\n\nHere is my live proof of work:\n🔗 Live dApp: https://solana-ai-copilot-66ks.vercel.app/\n🤖 Live Bot: https://t.me/solana_ai_copilot_terminal_bot\n\nHappy to take on a test task whenever you need extra hands! 🤝`;
  }

  function handleCopy(lead: any) {
    const pitch = getPitch(lead);
    navigator.clipboard.writeText(pitch);
    setCopiedId(lead.id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                Agency Hub & Client Radar
              </h1>
            </div>
            <p className="text-neutral-400 text-sm mt-1">
              Autonomous client acquisition radar with verified founder channels & 1-click tailored pitches.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3.5 py-1.5 rounded-full text-xs font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{filteredLeads.length} Studios Ready for Outreach</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search company, founder, or stack (e.g. Next.js, Rust)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-neutral-900/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition border ${
                filterType === 'ALL'
                  ? 'bg-neutral-800 border-neutral-600 text-white'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              All ({leadsData.length})
            </button>
            <button
              onClick={() => setFilterType('TELEGRAM')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition border ${
                filterType === 'TELEGRAM'
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              ✈️ Telegram Direct
            </button>
            <button
              onClick={() => setFilterType('X')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition border ${
                filterType === 'X'
                  ? 'bg-purple-500/10 border-purple-500/40 text-purple-400'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              𝕏 Twitter Direct
            </button>
          </div>
        </div>

        {/* Leads Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLeads.map((lead) => (
            <div
              key={lead.id}
              className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 hover:border-neutral-700 transition flex flex-col justify-between space-y-4 shadow-lg backdrop-blur-sm"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <a href={lead.website} target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition underline underline-offset-4 decoration-neutral-700">
                        {lead.company}
                      </a>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">{lead.category}</p>
                  </div>
                  <span className="text-[10px] bg-neutral-800/80 text-neutral-300 px-2 py-0.5 rounded-full border border-neutral-700 font-mono">
                    {lead.headcount} devs
                  </span>
                </div>

                <div className="bg-neutral-950/60 border border-neutral-900 p-2.5 rounded-xl space-y-1">
                  <div className="text-xs text-neutral-300 font-medium">
                    👤 <strong className="text-white">{lead.founder}</strong> ({lead.role})
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    📍 {lead.hq}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-neutral-400 uppercase tracking-wider font-mono mb-1.5">Stack:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.stack.split(',').slice(0, 4).map((tech, i) => (
                      <span key={i} className="text-[10px] bg-neutral-800/60 text-cyan-300 px-2 py-0.5 rounded border border-neutral-800 font-mono">
                        {tech.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-neutral-400 italic bg-neutral-950/40 p-2 rounded-lg border border-neutral-900/80">
                  &quot;{lead.notes}&quot;
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                <div className="flex gap-2">
                  <a
                    href={lead.contact}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex-1 text-center py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      lead.contact_type === 'Telegram'
                        ? 'bg-[#229ED9]/10 hover:bg-[#229ED9]/20 text-[#229ED9] border border-[#229ED9]/30'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                    }`}
                  >
                    {lead.contact_type === 'Telegram' ? '✈️ Open Telegram' : '𝕏 Open Profile'}
                  </a>
                  <button
                    onClick={() => handleCopy(lead)}
                    className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                  >
                    {copiedId === lead.id ? '✔ Copied Pitch!' : '📋 Copy Pitch'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
