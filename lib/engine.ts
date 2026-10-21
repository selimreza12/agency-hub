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

export async function verifyEmailMx(email: string): Promise<boolean> {
  try {
    const cleanEmail = email.toLowerCase().trim();
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

export async function saveLeadsToGithub(leads: Lead[], sha: string, commitMessage: string) {
  const content = Buffer.from(JSON.stringify(leads, null, 2)).toString('base64');
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/contents/data/leads.json`, {
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
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(`GitHub Save Failed: ${errorData.message}`);
  }
}

export async function scoreAndDraftWithGemini(lead: Partial<Lead>): Promise<{
  score: number;
  subject: string;
  pitch: string;
  followup: string;
}> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  const prompt = `
Analyze this Web3 developer lead for Md Selim Reza:
Name: ${lead.founder}
Company: ${lead.company}
Stack: ${lead.stack}

Return STRICT JSON:
{
  "score": 85,
  "subject": "quick question regarding ${lead.company} backlog",
  "pitch": "Hey ${lead.founder}, saw you guys are shipping on ${lead.stack}. If you have overflow Next.js/telemetry tickets, I can clear them in 48h. Proof: https://solana-ai-copilot-66ks.vercel.app/",
  "followup": "Hey ${lead.founder}, bumping this in case your sprint is heavy."
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );
    const data = await res.json();
    let rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return JSON.parse(rawJson.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim());
  } catch {
    return {
      score: 85,
      subject: `quick question regarding ${lead.company} backlog`,
      pitch: `Hey ${lead.founder}, saw you shipping on ${lead.stack}. Happy to clear backlog tickets in 48h. Proof: https://solana-ai-copilot-66ks.vercel.app/`,
      followup: `Hey ${lead.founder}, just bumping this regarding backlog dev.`,
    };
  }
}
