import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getLeadsFromGithub, saveLeadsToGithub } from '@/lib/engine';

// মানুষের মতো ন্যাচারাল বিরতি তৈরি করার ফাংশন (৪৫-৭৫ সেকেন্ড)
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
    return NextResponse.json({ error: 'Missing SMTP credentials' }, { status: 400 });
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
    const DAILY_LIMIT = 10; // নিরাপদ রাখার জন্য দৈনিক সর্বোচ্চ ১০টি
    let sentCount = 0;

    for (const lead of leads) {
      if (sentCount >= DAILY_LIMIT) break;
      if (!lead.email) continue;

      // ১. ইনিশিয়াল ইমেইল পাঠানো
      if (lead.status === 'VERIFIED' && lead.pitch_body) {
        // স্প্যাম রিপোর্ট এড়াতে ভদ্র অপ্ট-আউট ফুটার
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

        // প্রতি ইমেইলের পর ৪৫ থেকে ৭৫ সেকেন্ড র‍্যান্ডম বিরতি
        const randomDelay = Math.floor(Math.random() * 30000) + 45000;
        await sleep(randomDelay);
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

          const randomDelay = Math.floor(Math.random() * 30000) + 45000;
          await sleep(randomDelay);
        }
      }
    }

    if (sentCount > 0) {
      await saveLeadsToGithub(leads, sha, `cron(dispatch): safely sent ${sentCount} throttled emails`);
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
