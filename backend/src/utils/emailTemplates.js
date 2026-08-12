const APP_NAME = process.env.APP_NAME || "ACADEXA by ASAD";

// Emails are rendered by mail clients, not by the web app, so image `src`
// and CTA links must be absolute URLs — a relative "/assets/..." path (as
// this used to be) simply fails to load in Gmail/Outlook/etc.
const SITE_URL = (process.env.FRONTEND_URL || "https://institute-portal-psi.vercel.app").replace(/\/$/, "");
const LOGO_URL = process.env.APP_LOGO_URL || `${SITE_URL}/assets/acadexa-crest.png`;

// Brand palette — deep violet + gold, matching the ACADEXA crest.
const INK = "#0b0716";
const VIOLET = "#4c1d95";
const VIOLET_LT = "#7c3aed";
const GOLD = "#d4af37";
const GOLD_LT = "#f3d78a";

function baseWrapper({ title, preheader, bodyHtml, ctaLabel, ctaUrl }) {
  const cta = ctaLabel && ctaUrl ? `
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:22px auto 4px;">
                <tr>
                  <td align="center" bgcolor="${VIOLET_LT}" style="border-radius:9px;">
                    <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:9px;">${ctaLabel} &rarr;</a>
                  </td>
                </tr>
              </table>` : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#eef0f6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#eef0f6;">${preheader || ""}</div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#eef0f6;">
      <tr><td style="height:32px;line-height:32px;font-size:1px;">&nbsp;</td></tr>
      <tr>
        <td align="center">
          <table width="580" cellpadding="0" cellspacing="0" role="presentation" style="width:580px;max-width:92%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(20,10,45,0.12);">

            <!-- Header -->
            <tr>
              <td style="background:${INK};background-image:linear-gradient(135deg,${INK},${VIOLET});padding:30px 28px 26px;text-align:center;">
                <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
                  <tr>
                    <td style="width:52px;height:52px;border-radius:12px;background:${INK};border:1px solid rgba(212,175,55,0.4);" align="center" valign="middle">
                      <img src="${LOGO_URL}" alt="${APP_NAME}" width="52" height="52" style="display:block;border-radius:12px;" />
                    </td>
                  </tr>
                </table>
                <div style="margin-top:14px;font-size:19px;font-weight:800;letter-spacing:0.5px;color:#ffffff;">ACADEXA</div>
                <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;color:${GOLD_LT};text-transform:uppercase;margin-top:2px;">by ASAD</div>
              </td>
            </tr>
            <tr><td style="height:3px;line-height:3px;font-size:1px;background:${GOLD};background-image:linear-gradient(90deg,${VIOLET},${GOLD},${VIOLET_LT});">&nbsp;</td></tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px 30px 8px;">
                ${preheader ? `<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${VIOLET_LT};margin-bottom:10px;">${preheader}</div>` : ""}
                ${bodyHtml}
                ${cta}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:22px 30px 26px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #eee;padding-top:16px;">
                  <tr>
                    <td style="font-size:11.5px;color:#8a8a99;line-height:1.6;">
                      © ${new Date().getFullYear()} ${APP_NAME} — All rights reserved.<br/>
                      This is an automated message from the ACADEXA academic management platform.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="height:32px;line-height:32px;font-size:1px;">&nbsp;</td></tr>
    </table>
  </body>
</html>`;
}

function infoBox(rows) {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#faf9fd;border-left:3px solid ${GOLD};border-radius:8px;margin:14px 0;">
    <tr><td style="padding:14px 16px;">
      ${rows.map(([k, v]) => `<div style="font-size:13px;color:#333;line-height:1.9;"><span style="color:#8a8a99;">${k}:</span> <strong style="color:#111;">${v}</strong></div>`).join("")}
    </td></tr>
  </table>`;
}

function heading(text) {
  return `<div style="font-size:18px;font-weight:800;color:#160b2e;margin-bottom:10px;">${text}</div>`;
}

function paragraph(text) {
  return `<div style="font-size:14px;color:#454554;line-height:1.7;margin-bottom:8px;">${text}</div>`;
}

function welcomeStudentTemplate(student, password) {
  const firstName = (student.name || "").split(" ")[0] || student.name;
  const displayUrl = SITE_URL.replace(/^https?:\/\//, "");

  const credentialsCard = `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${INK};border-radius:12px;margin:18px 0;">
      <tr>
        <td style="padding:20px 22px;">
          <div style="font-size:10.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${GOLD_LT};margin-bottom:14px;">👇 your login deets</div>
          <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
            <tr>
              <td style="padding:7px 0;font-size:12.5px;color:rgba(255,255,255,0.55);width:105px;">Roll Number</td>
              <td style="padding:7px 0;font-size:16px;font-weight:800;color:#ffffff;font-family:Consolas,Menlo,monospace;letter-spacing:0.5px;">${student.rollNo}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;font-size:12.5px;color:rgba(255,255,255,0.55);">Password</td>
              <td style="padding:7px 0;font-size:16px;font-weight:800;color:${GOLD_LT};font-family:Consolas,Menlo,monospace;letter-spacing:0.5px;">${password || "(set by your admin)"}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  const ctaBlock = `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px auto 6px;">
      <tr>
        <td align="center" bgcolor="${VIOLET_LT}" style="border-radius:10px;box-shadow:0 6px 18px rgba(124,58,237,0.35);">
          <a href="${SITE_URL}" target="_blank" style="display:inline-block;padding:15px 36px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:10px;">Take Me to ACADEXA 🚀</a>
        </td>
      </tr>
    </table>
    <div style="text-align:center;font-size:12px;color:#9a9aa8;margin-bottom:4px;">or paste this into your browser:</div>
    <div style="text-align:center;font-size:13px;margin-bottom:4px;"><a href="${SITE_URL}" target="_blank" style="color:${VIOLET_LT};font-weight:700;text-decoration:underline;">${displayUrl}</a></div>`;

  const body = `
    ${heading(`Hey ${firstName}, you're in! 🎉`)}
    ${paragraph(`Your ACADEXA account is all set up and ready to roll. No boring setup steps left — just log in and you're good to go.`)}
    ${credentialsCard}
    ${paragraph(`Seriously, don't just leave this sitting in your inbox 👀 — tap the button below and go check it out. It only takes a sec:`)}
    ${ctaBlock}
    ${paragraph(`Once you're in you'll see your attendance, grades, fees, and any announcements — all in one place.`)}
    <div style="font-size:12.5px;color:#9a9aa8;margin-top:14px;">🤫 Psst — keep that password between us, don't go sharing it around. And if you weren't expecting this email, just ping your admin.</div>
  `;
  return baseWrapper({
    title: `Welcome to ${APP_NAME}`,
    preheader: `${firstName}, your ACADEXA login is ready — roll no. ${student.rollNo}`,
    bodyHtml: body,
  });
}

function feedbackTemplate({ name, email, message }) {
  const body = `
    ${heading("New Feedback Received")}
    ${infoBox([
      ["From", name],
      ["Email", email],
    ])}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#faf9fd;border-radius:8px;margin-top:6px;">
      <tr><td style="padding:14px 16px;font-size:13.5px;color:#333;line-height:1.7;">${message.replace(/\n/g, "<br/>")}</td></tr>
    </table>
  `;
  return baseWrapper({ title: `Feedback from ${name}`, preheader: "New feedback received", bodyHtml: body });
}

function parentMessageTemplate(msg) {
  const body = `
    ${heading(msg.title)}
    ${paragraph(`Dear ${msg.parentName || "Parent"},`)}
    ${paragraph(msg.message.replace(/\n/g, "<br/>"))}
    ${infoBox([
      ["Student", msg.studentId?.name || msg.studentName || "—"],
      ["Roll Number", msg.studentId?.rollNo || msg.rollNo || "—"],
    ])}
  `;
  return baseWrapper({ title: `${APP_NAME} - ${msg.title}`, preheader: msg.title, bodyHtml: body });
}

function classNoticeTemplate(cls) {
  const body = `
    ${heading(`New Class Added: ${cls.className}`)}
    ${paragraph(`A new class has been created and is now visible in the timetable.`)}
    ${infoBox([
      ["Code", cls.classCode],
      ["Teacher", cls.teacher],
      ["Schedule", `${cls.scheduleDay} · ${cls.scheduleTime}`],
      ["Room", cls.room],
    ])}
  `;
  return baseWrapper({ title: `New class: ${cls.className}`, preheader: "New class added", bodyHtml: body, ctaLabel: "View Timetable", ctaUrl: SITE_URL });
}

function noticeTemplate({ title, message }) {
  const body = `
    ${heading(title)}
    ${paragraph(message.replace(/\n/g, "<br/>"))}
  `;
  return baseWrapper({ title, preheader: title, bodyHtml: body });
}

export { welcomeStudentTemplate, feedbackTemplate, parentMessageTemplate, classNoticeTemplate, noticeTemplate, APP_NAME };
