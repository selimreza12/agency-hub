import dns from 'dns/promises';

export interface Lead {
  id: number | string;
  company: string;
  website?: string;
  category: string;
  founder: string;
  role: string;
  contact: string;
  contact_type: 'Email' | 'X' | 'Telegram';
  stack: string;
  headcount?: string;
  hq?: string;
  notes?: string;
  verification_score: number;
  fact_checked_at: string;
  email?: string;
  status?: 'PENDING' | 'VERIFIED' | 'SENT_INITIAL' | 'FOLLOWED_UP' | 'REPLIED' | 'BOUNCED';
  pitch_subject?: string;
  pitch_body?: string;
  followup_body?: string;
  sent_at?: string;
  followed_up_at?: string;
}

// ১. ডোমেইন ও নো-রিপ্লাই ফিল্টারিং
export async function verifyEmailMx(email: string): Promise<boolean> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    
    // বট, নো-রিপ্লাই ও গিটহাব ডামি ইমেইল বাদ দেওয়া
    if (
      cleanEmail.startsWith('noreply') ||
      cleanEmail.startsWith('no-reply') ||
      cleanEmail.startsWith('donotreply') ||
      cleanEmail.includes('users.noreply.github.com')
    ) {
      return false;
    }

    const domain = cleanEmail.split('@')[1];
    if (!domain) return false;

    const mxRecords = await dns.resolveMx(domain);
    return mxRecords && mxRecords.length > 0;
  } catch {
    return false;
  }
}

// ২. গিটহাব থেকে leads.json ফেচ করা
export async function getLeadsFromGithub(): Promise<{ leads: Lead[]; sha: string }> {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/contents/data/leads.json`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-store',
  });
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { leads: JSON.parse(content), sha: data.sha };
}

// ৩. গিটহাবে আপডেট করা leads.json পুশ করা
export async function saveLeadsToGithub(leads: Lead[], sha: string, commitMessage: string) {
  const content = Buffer.from(JSON.stringify(leads, null, 2)).toString('base64');
  await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/contents/data/leads.json`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: commitMessage,
      content,
      sha,
    }),
  });
}

// ৪. Gemini AI দিয়ে নিখুঁত স্কোরিং ও পিচ ড্রাফটিং (gemini-1.5-flash মডেল)
export async function scoreAndDraftWithGemini(lead: Partial<Lead>): Promise<{
  score: number;
  subject: string;
  pitch: string;
  followup: string;
}> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

  const prompt = `
Analyze this Web3 developer lead for Md Selim Reza (Stack: Next.js 16, TypeScript, Solana Web3.js, AI SDK, Telegram Bots):
Name: ${lead.founder}
Company / Repo: ${lead.company}
Stack: ${lead.stack}
Notes: ${lead.notes}

Return a STRICT JSON object without markdown formatting:
{
  "score": <number 0-100 evaluating fit for Solana/Next.js/Web3 frontend needs>,
  "subject": "<punchy, lowercase 4-6 word subject line referencing ${lead.company}>",
  "pitch": "<personalized, concise 3-sentence pitch mentioning their stack, offering 48h overflow UI/telemetry sprint with Selim's live portfolio: https://solana-ai-copilot-66ks.vercel.app/ >",
  "followup": "<1-sentence gentle follow-up bump for 3 days later>"
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      console.error('Gemini API Error details:', data?.error?.message || data);
      throw new Error(data?.error?.message || 'Gemini call failed');
    }

    let rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // ক্লিনআপ ব্যাকটিক যদি থাকে
    rawJson = rawJson.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

    return JSON.parse(rawJson);
  } catch (err: any) {
    console.error('Gemini fallback triggered:', err?.message || err);
    return {
      score: 80,
      subject: `quick question regarding ${lead.company} frontend backlog`,
      pitch: `Hey ${lead.founder}, saw you guys are shipping on ${lead.stack}. If your team needs to offload frontend tickets or telemetry integration without hiring full-time, I can knock out a sprint in 48h. Proof of work: https://solana-ai-copilot-66ks.vercel.app/ - happy to pick up a test task.`,
      followup: `Hey ${lead.founder}, bumping this in case you're deep in a sprint—still open to taking a small UI ticket off your plate.`,
    };
  }
}
