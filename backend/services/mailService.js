'use strict';

const nodemailer = require('nodemailer');
const { isDev } = require('../config/env');

// Singleton transporter — reused across sends to avoid reopening TCP connections
let _transporter = null;

const getTransporter = () => {
  if (_transporter) return _transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      'Email service is not configured. ' +
      'Add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS to backend/.env — ' +
      'get free credentials at https://mailtrap.io'
    );
  }

  const port   = parseInt(SMTP_PORT) || 587;
  const secure = port === 465;

  _transporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port,
    secure,
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
    tls: {
      // Allow self-signed certs in dev (Mailtrap sandbox); enforce in production
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });

  return _transporter;
};

const send = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();
  const from = `"${process.env.SMTP_FROM_NAME || 'StyleAI'}" <${process.env.SMTP_FROM_EMAIL || 'noreply@styleai.com'}>`;
  const info = await transporter.sendMail({ from, to, subject, html, text });
  // Recipient email addresses must never reach production logs — matches the
  // fail-safe isDev pattern used elsewhere (config/env.js), rather than the
  // less-safe `NODE_ENV !== 'production'` check, which fails OPEN (logs the
  // address) if NODE_ENV is ever unset or misconfigured.
  if (isDev) {
    console.log(`Email sent: to=${to} id=${info.messageId}`);
  }
  return info;
};

const buildResetPasswordHtml = (name, resetUrl) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Reset your StyleAI password</title>
</head>
<body style="margin:0;padding:0;background:#F0FDFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#F0FDFA;padding:40px 16px;">
    <tr><td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:580px;border-radius:20px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(13,148,136,.12);">

        <tr>
          <td style="background:linear-gradient(135deg,#042F2E 0%,#0F766E 50%,#0D9488 80%,#0891B2 100%);
                     padding:36px 40px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0"
                   style="margin:0 auto 14px;">
              <tr>
                <td style="width:52px;height:52px;
                           background:rgba(255,255,255,.15);
                           border:1.5px solid rgba(255,255,255,.30);
                           border-radius:14px;text-align:center;
                           vertical-align:middle;font-size:24px;
                           font-weight:900;color:#fff;line-height:52px;">&#10022;</td>
              </tr>
            </table>
            <h1 style="margin:0 0 5px;font-size:28px;font-weight:800;
                       color:#fff;letter-spacing:-.5px;">StyleAI</h1>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.65);">
              AI-Powered Fashion &middot; Kathmandu
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#fff;padding:40px 44px 36px;">

            <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;
                       color:#042F2E;letter-spacing:-.3px;">Password Reset Request</h2>

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
              Hi <strong style="color:#042F2E;">${name}</strong>,<br><br>
              We received a request to reset the password for your StyleAI account.
              Click the button below to choose a new password.
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0"
                   width="100%" style="margin:0 0 28px;">
              <tr><td align="center">
                <a href="${resetUrl}" target="_blank"
                   style="display:inline-block;
                          background:linear-gradient(135deg,#0D9488 0%,#0891B2 100%);
                          color:#fff;font-size:16px;font-weight:700;
                          text-decoration:none;padding:15px 40px;
                          border-radius:12px;letter-spacing:.01em;
                          box-shadow:0 4px 16px rgba(13,148,136,.35);">
                  Reset My Password &rarr;
                </a>
              </td></tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;color:#6B7280;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 28px;padding:12px 16px;
                      background:#F0FDFA;border:1px solid #CCFBF1;
                      border-radius:8px;word-break:break-all;
                      font-size:12.5px;color:#0F766E;line-height:1.5;">
              ${resetUrl}
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0"
                   width="100%" style="margin-bottom:28px;">
              <tr>
                <td style="background:#FFFBEB;border:1px solid #FDE68A;
                           border-radius:10px;padding:14px 18px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:top;padding-right:10px;
                                 font-size:17px;line-height:1.2;">&#9201;</td>
                      <td style="font-size:13px;color:#92400E;line-height:1.6;">
                        <strong>This link expires in 15 minutes.</strong><br>
                        After it expires, you can request a new one from the
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/forgot-password"
                           style="color:#0D9488;text-decoration:underline;">login page</a>.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0"
                   width="100%" style="margin-bottom:20px;">
              <tr><td style="border-top:1px solid #F3F4F6;font-size:0;">&nbsp;</td></tr>
            </table>

            <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.65;">
              <strong style="color:#6B7280;">Didn't request this?</strong>
              If you didn't ask for a password reset, you can safely ignore this email.
              Your password will remain unchanged and your account stays secure.
              No action is required.
            </p>

          </td>
        </tr>

        <tr>
          <td style="background:#F0FDFA;border-top:1px solid #CCFBF1;
                     padding:20px 44px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">
              &copy; 2026 StyleAI &middot; AI-Powered Fashion for Young Women in Kathmandu
            </p>
            <p style="margin:0;font-size:11.5px;color:#B0BEC5;">
              This is an automated message &mdash; please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;

const buildResetPasswordText = (name, resetUrl) => `
Hi ${name},

We received a request to reset the password for your StyleAI account.

To reset your password, visit the link below:
${resetUrl}

IMPORTANT: This link expires in 15 minutes.

If you didn't request a password reset, you can safely ignore this email.
Your password will remain unchanged.

---
StyleAI · AI-Powered Fashion · Kathmandu
This is an automated message — please do not reply.
`.trim();

exports.sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  await send({
    to:      email,
    subject: 'Reset your StyleAI password',
    html:    buildResetPasswordHtml(name, resetUrl),
    text:    buildResetPasswordText(name, resetUrl),
  });
};

// ── Email verification ────────────────────────────────────────────────────────

const buildVerificationHtml = (name, verifyUrl) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Verify your StyleAI email</title>
</head>
<body style="margin:0;padding:0;background:#F5F3FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#F5F3FF;padding:40px 16px;">
    <tr><td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:580px;border-radius:20px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(124,58,237,.12);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4C1D95 0%,#7C3AED 50%,#0D9488 100%);
                     padding:36px 40px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
              <tr>
                <td style="width:52px;height:52px;background:rgba(255,255,255,.15);
                           border:1.5px solid rgba(255,255,255,.30);border-radius:14px;
                           text-align:center;vertical-align:middle;font-size:24px;
                           font-weight:900;color:#fff;line-height:52px;">&#10022;</td>
              </tr>
            </table>
            <h1 style="margin:0 0 5px;font-size:28px;font-weight:800;color:#fff;letter-spacing:-.5px;">StyleAI</h1>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.65);">
              AI-Powered Fashion &middot; Kathmandu
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:40px 44px 36px;">
            <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#4C1D95;letter-spacing:-.3px;">
              Welcome to StyleAI! ✨
            </h2>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
              Hi <strong style="color:#4C1D95;">${name}</strong>,<br><br>
              Thank you for joining StyleAI — your personal AI-powered style companion.
              Please verify your email address to activate your account and start discovering
              outfits curated just for you.
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
              <tr><td align="center">
                <a href="${verifyUrl}" target="_blank"
                   style="display:inline-block;
                          background:linear-gradient(135deg,#7C3AED 0%,#0D9488 100%);
                          color:#fff;font-size:16px;font-weight:700;
                          text-decoration:none;padding:15px 40px;
                          border-radius:12px;letter-spacing:.01em;
                          box-shadow:0 4px 16px rgba(124,58,237,.35);">
                  Verify My Email &rarr;
                </a>
              </td></tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;color:#6B7280;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 28px;padding:12px 16px;background:#F5F3FF;
                      border:1px solid #DDD6FE;border-radius:8px;word-break:break-all;
                      font-size:12.5px;color:#7C3AED;line-height:1.5;">${verifyUrl}</p>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
              <tr>
                <td style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 18px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:top;padding-right:10px;font-size:17px;line-height:1.2;">&#9201;</td>
                      <td style="font-size:13px;color:#92400E;line-height:1.6;">
                        <strong>This link expires in 24 hours.</strong><br>
                        After it expires, you can request a new one from the
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/resend"
                           style="color:#7C3AED;text-decoration:underline;">resend page</a>.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
              <tr><td style="border-top:1px solid #F3F4F6;font-size:0;">&nbsp;</td></tr>
            </table>

            <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.65;">
              <strong style="color:#6B7280;">Didn't create a StyleAI account?</strong>
              You can safely ignore this email — no account will be activated without verification.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F5F3FF;border-top:1px solid #DDD6FE;padding:20px 44px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">
              &copy; 2026 StyleAI &middot; AI-Powered Fashion for Young Women in Kathmandu
            </p>
            <p style="margin:0;font-size:11.5px;color:#B0BEC5;">
              This is an automated message &mdash; please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

const buildVerificationText = (name, verifyUrl) => `
Welcome to StyleAI, ${name}!

Please verify your email address by visiting:
${verifyUrl}

IMPORTANT: This link expires in 24 hours.

If you didn't create a StyleAI account, you can safely ignore this email.

---
StyleAI · AI-Powered Fashion · Kathmandu
This is an automated message — please do not reply.
`.trim();

exports.sendVerificationEmail = async ({ email, name, verifyUrl }) => {
  await send({
    to:      email,
    subject: 'Verify your StyleAI email address',
    html:    buildVerificationHtml(name, verifyUrl),
    text:    buildVerificationText(name, verifyUrl),
  });
};
