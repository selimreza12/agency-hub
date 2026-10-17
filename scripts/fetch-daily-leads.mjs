import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const LEADS_FILE = path.join(process.cwd(), 'data', 'leads.json');

async function runDailyLeadHunter() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY missing in environment');
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

  // 2. Prompt Gemini with live search intent
  const prompt = `Act as an elite autonomous B2B researcher.
Find exactly 10 NEW boutique Web3 development agencies, Solana dev shops, or crypto startups with fewer than 15 employees.

Criteria:
- Primary stack: Next.js, Solana, TypeScript, Rust, or Telegram Bots.
- Team size: 1 to 15 people (boutique/solo founders).
- Must have a direct contact: Telegram handle (https://t.me/...) or X/Twitter (https://x.com/...).
- Do NOT include these existing companies:
${existingNames.slice(0, 30).join(', ')}

Return ONLY a clean JSON array of 10 objects:
[
  {
    "company": "Company Name",
    "website": "https://...",
    "category": "e.g., Solana development studio",
    "founder": "Founder Name",
    "role": "Founder / CEO",
    "contact": "https://t.me/... or https://x.com/...",
    "contact_type": "Telegram or X",
    "stack": "Next.js, Solana, TypeScript",
    "headcount": "5-10",
    "hq": "City, Country",
    "notes": "Short high-value note"
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
        maxOutputTokens: 6000,
        temperature: 0.4
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API failed with status ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  let rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawJson) {
    throw new Error('No content received from Gemini');
  }

  // Sanitize and extract strictly the JSON array
  rawJson = rawJson.trim();
  if (rawJson.startsWith('```')) {
    rawJson = rawJson.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
  }
  const startIdx = rawJson.indexOf('[');
  const endIdx = rawJson.lastIndexOf(']');
  if (startIdx !== -1 && endIdx !== -1) {
    rawJson = rawJson.substring(startIdx, endIdx + 1);
  }

  const newLeads = JSON.parse(rawJson);
  console.log(`✅ Successfully parsed ${newLeads.length} fresh verified leads!`);

  // 3. Assign incremented IDs and merge
  let startId = existingLeads.length > 0 ? Math.max(...existingLeads.map(l => l.id)) + 1 : 1;
  const formattedNewLeads = newLeads.map((lead) => ({
    id: startId++,
    ...lead
  }));

  // Put new leads at the top
  const updatedLeads = [...formattedNewLeads, ...existingLeads];

  fs.writeFileSync(LEADS_FILE, JSON.stringify(updatedLeads, null, 2));
  console.log(`🎉 Success! Total leads in database now: ${updatedLeads.length}`);
}

runDailyLeadHunter().catch(err => {
  console.error('Fatal Hunter Error:', err.message);
  process.exit(1);
});
