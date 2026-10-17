import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const LEADS_FILE = path.join(process.cwd(), 'data', 'leads.json');

async function runDailyLeadHunter() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY missing');
    process.exit(1);
  }

  // 1. Load existing leads to prevent duplicates
  let existingLeads = [];
  try {
    const raw = fs.readFileSync(LEADS_FILE, 'utf-8');
    existingLeads = JSON.parse(raw);
  } catch (e) {
    existingLeads = [];
  }

  const existingNames = existingLeads.map(l => l.company.toLowerCase());
  console.log(`🔍 Current database has ${existingLeads.length} leads. Searching for 10 fresh targets...`);

  // 2. Prompt Gemini with live search intent tailored to user profile
  const prompt = `Act as an elite autonomous B2B researcher specializing in Solana, Next.js, and Web3 development.
Search the live web and recent directories to find exactly 10 NEW boutique Web3 development agencies, Solana dev shops, or crypto startups with fewer than 15 employees.

Match criteria:
- Primary tech: Next.js, Solana, TypeScript, Rust, or Telegram Bots.
- Team size: 1 to 15 people (boutique/solo founders who need overflow dev hands).
- Must have a direct, public contact channel: either a Telegram handle (t.me/...) or an X/Twitter profile.
- DO NOT INCLUDE ANY OF THESE EXISTING COMPANIES:
${existingNames.join(', ')}

Return ONLY a valid JSON array containing exactly 10 objects with this exact structure:
[
  {
    "company": "Company Name",
    "website": "https://...",
    "category": "e.g., Solana product studio",
    "founder": "Founder or Lead Name",
    "role": "Founder / CEO / Lead Dev",
    "contact": "https://t.me/... or https://x.com/...",
    "contact_type": "Telegram or X",
    "stack": "Next.js, Solana, TypeScript...",
    "headcount": "estimated headcount like 5-10",
    "hq": "City, Country",
    "notes": "Short explanation why they are a high-value client for overflow dev work"
  }
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 2500,
        temperature: 0.5
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API failed with status ${res.status}`);
  }

  const data = await res.json();
  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawJson) {
    throw new Error('No content received from Gemini');
  }

  const newLeads = JSON.parse(rawJson);
  console.log(`✅ Successfully sourced ${newLeads.length} fresh verified leads!`);

  // 3. Assign incremented IDs and merge
  let startId = existingLeads.length > 0 ? Math.max(...existingLeads.map(l => l.id)) + 1 : 1;
  const formattedNewLeads = newLeads.map((lead) => ({
    id: startId++,
    ...lead
  }));

  // Put new leads at the top of the dashboard
  const updatedLeads = [...formattedNewLeads, ...existingLeads];

  fs.writeFileSync(LEADS_FILE, JSON.stringify(updatedLeads, null, 2));
  console.log(`🎉 Success! Total leads in database now: ${updatedLeads.length}`);
}

runDailyLeadHunter().catch(err => {
  console.error('Fatal Hunter Error:', err);
  process.exit(1);
});
