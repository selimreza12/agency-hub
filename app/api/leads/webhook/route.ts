import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret') || req.headers.get('x-webhook-secret');
    const expectedSecret = process.env.WEBHOOK_SECRET || 'selim_hub_secret_2026';

    // 1. Security verification
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized: Invalid webhook secret' }, { status: 401 });
    }

    const body = await req.json();
    const incomingLeads = Array.isArray(body) ? body : (body.leads || []);

    if (!incomingLeads.length) {
      return NextResponse.json({ error: 'Empty payload: No leads found' }, { status: 400 });
    }

    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO || 'selimreza12/agency-hub';
    const filePath = 'data/leads.json';

    if (!token) {
      return NextResponse.json({ error: 'Server configuration error: GITHUB_TOKEN missing' }, { status: 500 });
    }

    // 2. Fetch current leads file directly from GitHub API
    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'AgencyHub-Webhook',
      },
      cache: 'no-store'
    });

    if (!getRes.ok) {
      return NextResponse.json({ error: 'Failed to read leads from GitHub' }, { status: getRes.status });
    }

    const fileData = await getRes.json();
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    let existingLeads = [];
    try {
      existingLeads = JSON.parse(currentContent);
    } catch (e) {
      existingLeads = [];
    }

    // 3. Deduplicate and format incoming leads
    const existingNames = new Set(existingLeads.map((l: any) => l.company.toLowerCase()));
    let startId = existingLeads.length > 0 ? Math.max(...existingLeads.map((l: any) => l.id || 0)) + 1 : 1;

    const verifiedNewLeads = [];
    for (const item of incomingLeads) {
      if (!item.company || existingNames.has(item.company.toLowerCase())) continue;

      verifiedNewLeads.push({
        id: startId++,
        company: item.company,
        website: item.website || '',
        category: item.category || 'Solana Development Studio',
        founder: item.founder || 'Lead Founder',
        role: item.role || 'Founder & CEO',
        contact: item.contact || '',
        contact_type: item.contact_type || (item.contact?.includes('t.me') ? 'Telegram' : 'X'),
        stack: item.stack || 'Next.js, Solana, TypeScript',
        headcount: item.headcount || '5-10 devs',
        hq: item.hq || 'Remote',
        notes: item.notes || 'Verified boutique lead delivered via Ottermind scheduled automation.',
        verification_score: item.verification_score || 95,
        fact_checked_at: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });
      existingNames.add(item.company.toLowerCase());
    }

    if (!verifiedNewLeads.length) {
      return NextResponse.json({ message: 'All incoming leads were already in the database', total: existingLeads.length });
    }

    // 4. Prepend verified leads to the top
    const updatedLeads = [...verifiedNewLeads, ...existingLeads];
    const updatedBase64 = Buffer.from(JSON.stringify(updatedLeads, null, 2)).toString('base64');

    // 5. Commit updated file back to GitHub repository
    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'AgencyHub-Webhook',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `chore: auto-sync ${verifiedNewLeads.length} verified leads via Ottermind webhook`,
        content: updatedBase64,
        sha: fileData.sha,
      }),
    });

    if (!putRes.ok) {
      const errData = await putRes.json();
      return NextResponse.json({ error: 'GitHub commit failed', details: errData }, { status: putRes.status });
    }

    return NextResponse.json({
      success: true,
      addedCount: verifiedNewLeads.length,
      totalLeads: updatedLeads.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
