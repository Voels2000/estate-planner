export function buildIntakeRequestEmail(opts: {
  attorneyName: string
  clientName: string
  personalMessage: string | null
  acceptUrl: string
  expiresInDays: number
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif">
      <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <div style="background:#0F1B3C;padding:28px 40px">
          <p style="margin:0;color:#C9A84C;font-size:13px;letter-spacing:0.1em;text-transform:uppercase">My Wealth Maps</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:400;line-height:1.3">
            ${opts.attorneyName} has invited you to complete your estate planning profile
          </h1>
        </div>
        <div style="padding:36px 40px">
          <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.7">
            Hi ${opts.clientName},
          </p>
          ${
            opts.personalMessage
              ? `
          <div style="background:#f9fafb;border-left:3px solid #C9A84C;padding:16px 20px;margin-bottom:20px;border-radius:0 4px 4px 0">
            <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;font-style:italic">"${opts.personalMessage}"</p>
            <p style="margin:8px 0 0;color:#6b7280;font-size:13px">— ${opts.attorneyName}</p>
          </div>
          `
              : ''
          }
          <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7">
            Before your upcoming meeting, ${opts.attorneyName} has asked you to complete a short profile on
            My Wealth Maps — a secure estate planning platform. This typically takes 15–20 minutes and replaces
            the paper intake form.
          </p>
          <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7">
            When you're done, ${opts.attorneyName} will have everything they need to make your meeting
            as productive as possible.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${opts.acceptUrl}"
               style="display:inline-block;background:#C9A84C;color:#0F1B3C;padding:16px 40px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:0.02em">
              Complete my profile →
            </a>
          </div>
          <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0">
            This invitation expires in ${opts.expiresInDays} days.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
          <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0">
            My Wealth Maps is a secure estate planning platform. Your data is encrypted and only
            accessible to you and the professionals you explicitly authorize.
            Questions? Reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}
