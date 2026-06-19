import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "WorkDesk <noreply@studios.talken.in>";
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3001";

// ─────────────────────────────────────────────────────────────────────────────
// Shared HTML shell
// ─────────────────────────────────────────────────────────────────────────────

function html(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<style>
  body { margin:0; padding:0; background:#0d1117; font-family:'Inter',Arial,sans-serif; color:#e6edf3; }
  .wrap { max-width:480px; margin:40px auto; background:#161b22; border:1px solid #30363d; border-radius:12px; overflow:hidden; }
  .top  { height:4px; background:linear-gradient(90deg,#58a6ff,#3fb950); }
  .body { padding:32px; }
  h1   { font-size:20px; font-weight:700; margin:0 0 8px; color:#e6edf3; }
  p    { font-size:14px; line-height:1.6; color:#8b949e; margin:0 0 20px; }
  .code { font-size:32px; font-weight:700; letter-spacing:10px; color:#58a6ff;
          background:#1f6feb18; border:1px solid #1f6feb44; border-radius:8px;
          padding:16px 24px; text-align:center; margin:20px 0; font-family:monospace; }
  .btn  { display:inline-block; padding:12px 24px; background:#1f6feb; color:#fff !important;
          border-radius:8px; font-size:14px; font-weight:600; text-decoration:none; }
  .footer { font-size:11px; color:#484f58; margin-top:24px; border-top:1px solid #21262d; padding-top:16px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="top"></div>
  <div class="body">
    <h1>WorkDesk · Flex Studios</h1>
    ${body}
    <div class="footer">This email was sent by WorkDesk. If you didn't request this, you can safely ignore it.</div>
  </div>
</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Send helpers
// ─────────────────────────────────────────────────────────────────────────────

async function send(to: string, subject: string, htmlBody: string) {
  await resend.emails.send({ from: FROM, to, subject, html: htmlBody });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Email verification OTP (signup)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendEmailVerificationOtp(to: string, otp: string) {
  await send(
    to,
    "Verify your WorkDesk account",
    html("Verify your email", `
      <p>Thanks for signing up! Enter this code to verify your email address. It expires in <strong>10 minutes</strong>.</p>
      <div class="code">${otp}</div>
      <p>If you didn't create a WorkDesk account, ignore this email.</p>
    `)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Password-change OTP (settings)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPasswordChangeOtp(to: string, otp: string) {
  await send(
    to,
    "Your WorkDesk password-change code",
    html("Password change request", `
      <p>We received a request to change your WorkDesk password. Use this code to confirm. It expires in <strong>10 minutes</strong>.</p>
      <div class="code">${otp}</div>
      <p>If you didn't request this, your account is safe — no changes have been made.</p>
    `)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Forgot-password reset link
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${BASE}/reset-password?token=${encodeURIComponent(token)}`;
  await send(
    to,
    "Reset your WorkDesk password",
    html("Reset your password", `
      <p>Click the button below to reset your WorkDesk password. This link expires in <strong>1 hour</strong>.</p>
      <p style="text-align:center"><a class="btn" href="${link}">Reset password</a></p>
      <p>Or copy this link into your browser:<br/><span style="color:#58a6ff;font-size:12px;word-break:break-all">${link}</span></p>
      <p>If you didn't request a password reset, ignore this email.</p>
    `)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Password-changed confirmation
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPasswordChangedConfirmation(to: string) {
  await send(
    to,
    "Your WorkDesk password was changed",
    html("Password changed", `
      <p>Your WorkDesk password was successfully changed.</p>
      <p>If you did not make this change, <strong>reset your password immediately</strong> using the link below.</p>
      <p style="text-align:center"><a class="btn" href="${BASE}/forgot-password">Reset my password</a></p>
    `)
  );
}
