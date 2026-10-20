import { NextResponse } from 'next/server';
import { getLeadsFromGithub, saveLeadsToGithub, verifyEmailMx, scoreAndDraftWithGemini, Lead } from '@/lib/engine';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret') || req.headers.get('authorization')?.replace('Bearer ', '');

  const expectedSecret = process.env.CRON_SECRET || process.env.WEBHOOK_SECRET || "selim_cron_secret_2026";
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { leads, sha } = await getLeadsFromGithub();
    const existingEmails = new Set(leads.map((l) => l.email?.toLowerCase()).filter(Boolean));

    const ghRes = await fetch(
      'https://api.github.com/search/repositories?q=solana+nextjs+fork:false+size:<10000+pushed:>2025-01-01&sort=updated&order=desc&per_page=10',
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    const ghData = await ghRes.json();
    const newQualifiedLeads: Lead[] = [];

    for (const repo of ghData.items || []) {
      const commitRes = await fetch(`${repo.url}/commits?per_page=3`, {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      const commits = await commitRes.json();

      for (const c of Array.isArray(commits) ? commits : []) {
        const authorName = c.commit?.author?.name;
        const authorEmail = c.commit?.author?.email;

        if (!authorEmail || existingEmails.has(authorEmail.toLowerCase())) continue;

        const isMxValid = await verifyEmailMx(authorEmail);
        if (!isMxValid) continue;

        existingEmails.add(authorEmail.toLowerCase());

        const analysis = await scoreAndDraftWithGemini({
          founder: authorName || repo.owner.login,
          company: repo.name,
          stack: `Solana, Next.js, ${repo.language || 'TypeScript'}`,
          notes: repo.description || 'Active GitHub Web3 repo',
        });

        if (analysis.score >= 70) {
          newQualifiedLeads.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            company: repo.name,
            website: repo.html_url,
            category: 'Solana/Next.js Open Builder',
            founder: authorName || repo.owner.login,
            role: 'Lead Developer / Founder',
            contact: authorEmail,
            contact_type: 'Email',
            email: authorEmail,
            stack: `Solana, Next.js, ${repo.language || 'TypeScript'}`,
            headcount: '<10 devs',
            hq: 'Remote',
            notes: repo.description || 'Verified via active GitHub repository',
            verification_score: analysis.score,
            fact_checked_at: new Date().toISOString().split('T')[0],
            status: 'VERIFIED',
            pitch_subject: analysis.subject,
            pitch_body: analysis.pitch,
            followup_body: analysis.followup,
          });
          break;
        }
      }
    }

    if (newQualifiedLeads.length > 0) {
      const updatedList = [...leads, ...newQualifiedLeads];
      await saveLeadsToGithub(
        updatedList,
        sha,
        `cron(ingest): added ${newQualifiedLeads.length} verified scored leads`
      );
    }

    return NextResponse.json({
      success: true,
      ingested: newQualifiedLeads.length,
      leads: newQualifiedLeads.map((l) => ({ company: l.company, email: l.email, score: l.verification_score })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
