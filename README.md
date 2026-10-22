# LeadScout HQ — Agency Hub & Client Radar

An AI-assisted lead discovery and outreach pipeline for independent
developers and boutique engineering studios.

## Live Production Assets

- **Dashboard:** https://agency-hub-ruddy-chi.vercel.app/
- **Solana AI Copilot:** https://solana-ai-copilot-66ks.vercel.app/
- **Telegram Bot:** https://t.me/solana_ai_copilot_terminal_bot

## Core Features

- GitHub-based discovery of relevant, active repositories.
- DNS MX checks and filtering of automated email addresses.
- AI-assisted lead qualification and contextual proposal generation.
- Controlled email dispatch with configurable sending limits.
- Follow-up workflow, subject to reply detection and opt-out checks.
- Dashboard for searching, reviewing and managing leads.

## Architecture

1. **Discovery:** Collect potentially relevant developer and project leads.
2. **Verification:** Check domain mail records and filter unsuitable addresses.
3. **Qualification:** Evaluate technical relevance and generate evidence-based
   summaries using the configured AI provider.
4. **Review:** Verify the lead, contact source and message before outreach.
5. **Dispatch:** Send only to appropriate recipients under configured limits.
6. **Monitoring:** Track delivery, replies, errors and opt-out requests.

## Technology

- Next.js and TypeScript
- Tailwind CSS
- Google Gemini API, if configured
- Nodemailer and configured SMTP
- GitHub API for data synchronization
- Vercel deployment and scheduled jobs

Verify the exact versions and integrations against the current source code
and package.json before relying on this documentation.

## Safety and Limitations

- A technically relevant lead is not proof of buying intent or available budget.
- DNS MX records do not prove that a specific mailbox exists or accepts email.
- AI-generated scores and proposals require human review.
- Sending limits depend on the configured email provider and its policies.
- Follow-ups must stop when a recipient replies, opts out, or is otherwise
  ineligible for further contact.
- Comply with applicable privacy, anti-spam and email-provider requirements.

## Author

**Md Selim Reza**

AI Integrator and Independent Developer

Portfolio: https://solana-ai-copilot-66ks.vercel.app/

