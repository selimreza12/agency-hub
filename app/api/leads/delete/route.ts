import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing lead ID' }, { status: 400 });
    }

    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO || 'selimreza12/agency-hub';
    const filePath = 'data/leads.json';

    if (!token) {
      // Local fallback if token not configured
      return NextResponse.json({ success: true, message: 'Local UI deletion only' });
    }

    // 1. Fetch current leads file from GitHub
    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'AgencyHub-Delete',
      },
      cache: 'no-store'
    });

    if (!getRes.ok) {
      return NextResponse.json({ error: 'Failed to access repository' }, { status: getRes.status });
    }

    const fileData = await getRes.json();
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    let existingLeads = JSON.parse(currentContent);

    // 2. Remove the specific lead by ID
    const updatedLeads = existingLeads.filter((l: any) => l.id !== id);
    const updatedBase64 = Buffer.from(JSON.stringify(updatedLeads, null, 2)).toString('base64');

    // 3. Commit the deletion to GitHub
    await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'AgencyHub-Delete',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `chore: delete lead #${id} from pipeline [skip ci]`,
        content: updatedBase64,
        sha: fileData.sha,
      }),
    });

    return NextResponse.json({ success: true, remaining: updatedLeads.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
