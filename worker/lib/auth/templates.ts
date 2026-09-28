// Plain, inline-styled transactional email templates (HTML + text).

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

interface TemplateInput {
  heading: string;
  intro: string;
  button: string;
  link: string;
  expiry: string;
  footer: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

function greeting(name?: unknown): string {
  return typeof name === "string" && name.trim() ? `Hi ${name.trim().slice(0, 80)},` : "Hi,";
}

function render(subject: string, name: unknown, t: TemplateInput): EmailContent {
  const hi = greeting(name);
  const link = escapeHtml(t.link);
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td style="font-size:13px;font-weight:800;letter-spacing:0.12em;color:#18181b">FORGE</td></tr>
<tr><td style="padding-top:24px;font-size:22px;font-weight:700;line-height:1.3">${escapeHtml(t.heading)}</td></tr>
<tr><td style="padding-top:16px;font-size:15px;line-height:1.6;color:#3f3f46">${escapeHtml(hi)}<br><br>${escapeHtml(t.intro)}</td></tr>
<tr><td style="padding-top:24px"><a href="${link}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:10px">${escapeHtml(t.button)}</a></td></tr>
<tr><td style="padding-top:24px;font-size:13px;line-height:1.6;color:#71717a">${escapeHtml(t.expiry)}<br>If the button doesn't work, paste this link into your browser:<br><a href="${link}" style="color:#3f3f46;word-break:break-all">${link}</a></td></tr>
<tr><td style="padding-top:24px;border-top:1px solid #e4e4e7;margin-top:24px;font-size:12px;line-height:1.6;color:#a1a1aa">${escapeHtml(t.footer)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${hi}\n\n${t.intro}\n\n${t.button}: ${t.link}\n\n${t.expiry}\n\n${t.footer}\n\n- Forge`;
  return { subject, html, text };
}

const IGNORE = "If you didn't ask for this, you can safely ignore this email.";

export function verifyTemplate(link: string, name?: unknown): EmailContent {
  return render("Confirm your Forge email", name, {
    heading: "Confirm your email",
    intro: "Thanks for creating your Forge account. Confirm your email address to finish setting it up.",
    button: "Confirm email",
    link,
    expiry: "This link expires in 24 hours and can only be used once.",
    footer: IGNORE,
  });
}

export function recoveryTemplate(link: string, name?: unknown): EmailContent {
  return render("Reset your Forge password", name, {
    heading: "Reset your password",
    intro: "We received a request to reset the password for your Forge account. Choose a new one using the button below.",
    button: "Set a new password",
    link,
    expiry: "This link expires in 1 hour and can only be used once.",
    footer: IGNORE,
  });
}

export function emailChangeTemplate(link: string, newEmail: string, name?: unknown): EmailContent {
  return render("Confirm your new Forge email", name, {
    heading: "Confirm your new email",
    intro: `Confirm that you want to use ${newEmail} to sign in to Forge. Your email won't change until you do.`,
    button: "Confirm new email",
    link,
    expiry: "This link expires in 24 hours and can only be used once.",
    footer: IGNORE,
  });
}

export function setupTemplate(link: string, expiry: string, name?: unknown): EmailContent {
  return render("Forge has moved: set your password", name, {
    heading: "Forge has moved. Set your password",
    intro:
      "Forge now runs on a new, faster home. Your coach, programs and history all came with you, but for security we couldn't bring your old password. Set a new one to sign back in.",
    button: "Set my password",
    link,
    expiry,
    footer: "Questions? Reply to your coach. If you don't use Forge, you can ignore this email.",
  });
}
