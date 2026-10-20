import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getLeadsFromGithub, saveLeadsToGithub } from '@/lib/engine';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret') || req.headers.get('authorization')?.replace('Bearer ', '');
  const expectedSecret = process.env.CRON_SECRET || process.env.WEBHOOK_SECRET || 'selim_cron_secret_2026';

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Vercel Environment Variables চেক
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return NextResponse.json({
      error: 'SMTP_USER or SMTP_PASS is missing in Vercel Environment Variables. Please add them in Vercel Dashboard Settings.',
    }, { status: 400 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE === 'true' || true,
      auth: { user, pass },
    });

    const { leads, sha } = await getLeadsFromGithub();
    const now = Date.now();
    const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;
    const DAILY_LIMIT = 15;
    let sentCount = 0;

    for (const lead of leads) {
      if (sentCount >= DAILY_LIMIT) break;
      if (!lead.email) continue;

      // ১. ইনিশিয়াল ইমেইল পাঠানো
      if (lead.status === 'VERIFIED' && lead.pitch_body) {
        await transporter.sendMail({
          from: process.env.FROM_EMAIL || `"Md Selim Reza" <${user}>`,
          to: lead.email,
          subject: lead.pitch_subject || `quick question regarding ${lead.company} backlog`,
          text: lead.pitch_body,
        });

        lead.status = 'SENT_INITIAL';
        lead.sent_at = new Date().toISOString();
        sentCount++;
      }
      // ২. ৭২ ঘণ্টা পর স্বয়ংক্রিয় ফলো-আপ
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
        }
      }
    }

    if (sentCount > 0) {
      await saveLeadsToGithub(leads, sha, `cron(dispatch): processed ${sentCount} outbound emails`);
    }

    return NextResponse.json({
      success: true,
      processed: sentCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
