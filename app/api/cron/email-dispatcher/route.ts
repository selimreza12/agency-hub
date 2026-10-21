import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getLeadsFromGithub, saveLeadsToGithub } from '@/lib/engine';

export const dynamic = 'force-dynamic';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret') || req.headers.get('authorization')?.replace('Bearer ', '');
  const expectedSecret = process.env.CRON_SECRET || process.env.WEBHOOK_SECRET || 'selim_cron_secret_2026';

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return NextResponse.json({ error: 'Missing SMTP credentials in Vercel' }, { status: 400 });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    const { leads, sha } = await getLeadsFromGithub();
    const now = Date.now();
    const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;
    const BATCH_LIMIT = 5;
    let sentCount = 0;

    // ডায়াগনস্টিক কাউন্টার
    let totalWithEmail = 0;
    let pendingVerified = 0;
    let alreadySent = 0;

    for (const lead of leads) {
      if (lead.email) totalWithEmail++;
      if (lead.status === 'VERIFIED') pendingVerified++;
      if (lead.status === 'SENT_INITIAL') alreadySent++;

      if (sentCount >= BATCH_LIMIT) continue;
      if (!lead.email) continue;

      // ১. ইনিশিয়াল ইমেইল পাঠানো
      if (lead.status === 'VERIFIED' && lead.pitch_body) {
        const safeBody = `${lead.pitch_body}\n\n---\nP.S. If you prefer not to hear from me, reply 'stop' and I'll remove you immediately.`;

        await transporter.sendMail({
          from: process.env.FROM_EMAIL || `"Md Selim Reza" <${user}>`,
          to: lead.email,
          subject: lead.pitch_subject || `quick question regarding ${lead.company} backlog`,
          text: safeBody,
        });

        lead.status = 'SENT_INITIAL';
        lead.sent_at = new Date().toISOString();
        sentCount++;
        await sleep(1000);
      }
      // ২. ৭২ ঘণ্টা পর ফলো-আপ
      else if (lead.status === 'SENT_INITIAL' && lead.sent_at && lead.followup_body) {
        const timeElapsed = now - new Date(lead.sent_at).getTime();

        if (timeElapsed >= SEVENTY_TWO_HOURS) {
          await transporter.sendMail({
            from: process.env.FROM_EMAIL || `"Md Selim Reza" <${user}>`,
            to: lead.email,
            subject: `Re: ${lead.pitch_subject || `quick question regarding ${lead.company} backlog`}`,
            text: lead.followup_body,
          });

          lead.status = 'FOLLOWED_UP';
          lead.followed_up_at = new Date().toISOString();
          sentCount++;
          await sleep(1000);
        }
      }
    }

    if (sentCount > 0) {
      await saveLeadsToGithub(leads, sha, `cron(dispatch): sent ${sentCount} outbound emails`);
    }

    return NextResponse.json({
      success: true,
      processed: sentCount,
      database_status: {
        total_leads_in_pipeline: leads.length,
        leads_with_valid_email: totalWithEmail,
        ready_to_send_now: pendingVerified,
        already_sent_waiting_72h: alreadySent,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
