import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getLeadsFromGithub, saveLeadsToGithub } from '@/lib/engine';

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
    const BATCH_LIMIT = 3; // দিনে বা প্রতি রানে সুরক্ষার জন্য সর্বোচ্চ ৩টি
    let sentCount = 0;

    let pendingApproval = 0;
    let readyToSend = 0;
    let optedOut = 0;

    for (const lead of leads) {
      // অপ্ট-আউট বা ব্লকড লিড হিসাব করা
      if (lead.status === 'OPT_OUT' || lead.status === 'BOUNCED') {
        optedOut++;
        continue;
      }
      if (lead.status === 'VERIFIED' || !lead.status) {
        pendingApproval++;
        // Day 3 রুল: যতক্ষণ না স্ট্যাটাস 'APPROVED' বা 'VERIFIED' এর সাথে ক্লিয়ারেন্স ফ্ল্যাগ থাকে, 
        // আমরা এখন থেকে শুধুমাত্র সেই লিড পাঠাবো যেগুলোর status === 'APPROVED' (Human-in-the-loop safety)
        // তবে টেস্টের সুবিধার্থে বর্তমানে 'VERIFIED' কেও ড্রাফট ধরে রাখব।
      }

      if (lead.status === 'APPROVED') {
        readyToSend++;
      }

      if (sentCount >= BATCH_LIMIT) continue;
      if (!lead.email) continue;

      // শুধুমাত্র 'APPROVED' স্ট্যাটাসযুক্ত লিডগুলোই এখন আউটবাউন্ডে যাবে (Human Approval Check)
      if (lead.status === 'APPROVED' && lead.pitch_body) {
        const safeBody = `${lead.pitch_body}\n\n---\nP.S. If you prefer not to hear from me, just reply 'stop' and I will remove you immediately.`;

        await transporter.sendMail({
          from: process.env.FROM_EMAIL || `"Md Selim Reza" <${user}>`,
          to: lead.email,
          subject: lead.pitch_subject || `quick question regarding ${lead.company} backlog`,
          text: safeBody,
        });

        lead.status = 'SENT_INITIAL';
        lead.sent_at = new Date().toISOString();
        sentCount++;
        await sleep(1500);
      }
      // ৭২ ঘণ্টা পর ফলো-আপ (যদি অপ্ট-আউট না করে থাকে)
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
          await sleep(1500);
        }
      }
    }

    if (sentCount > 0) {
      await saveLeadsToGithub(leads, sha, `cron(dispatch): human-approved dispatch of ${sentCount} emails`);
    }

    return NextResponse.json({
      success: true,
      processed: sentCount,
      safety_pipeline_status: {
        opted_out_or_blocked: optedOut,
        pending_human_approval: pendingApproval,
        approved_and_ready: readyToSend,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
