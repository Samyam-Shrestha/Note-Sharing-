import nodemailer from "nodemailer";

export async function sendVerificationCode(email, code) {
  // If SMTP is not configured, just log the code for local testing.
  if (!process.env.SMTP_HOST) {
    console.log(`\n=============================================`);
    console.log(`[MOCK EMAIL] To: ${email}`);
    console.log(`[MOCK EMAIL] Subject: Your Verification Code`);
    console.log(`[MOCK EMAIL] Body: Your 6-digit code is: ${code}`);
    console.log(`=============================================\n`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Secure Notes" <${process.env.SMTP_USER || "noreply@example.com"}>`,
    to: email,
    subject: "Verify Your Secure Notes Account",
    text: `Your 6-digit verification code is: ${code}`,
    html: `<b>Your 6-digit verification code is:</b> <h1>${code}</h1>`,
  });
}
