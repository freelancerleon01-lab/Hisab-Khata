import nodemailer from 'nodemailer';

const g = globalThis;
const transporter = () =>
  g.__hkMail ??
  (g.__hkMail = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
  }));

export function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return 'http://localhost:3000';
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function sendResetMail(user, link) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    // লোকাল ডেভেলপমেন্টে মেইল কনফিগার না থাকলে লিংক টার্মিনালে দেখানো হয়
    if (!process.env.VERCEL) return console.log('[মেইল কনফিগার নেই] রিসেট লিংক:', link);
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD সেট করা নেই');
  }
  await transporter().sendMail({
    from: `"হিসাব খাতা" <${process.env.GMAIL_USER}>`,
    to: user.email,
    subject: 'হিসাব খাতা: পাসওয়ার্ড রিসেট',
    text: `${user.name}, আপনার পাসওয়ার্ড বদলাতে নিচের লিংকে যান (এক ঘণ্টা পর্যন্ত চালু থাকবে):\n\n${link}\n\nআপনি অনুরোধ না করে থাকলে এই মেইল উপেক্ষা করুন, আপনার পাসওয়ার্ড বদলাবে না।`,
    html: `<p>${esc(user.name)}, আপনার পাসওয়ার্ড বদলাতে নিচের বোতামে চাপুন। লিংকটি এক ঘণ্টা পর্যন্ত চালু থাকবে।</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#0f7b74;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">নতুন পাসওয়ার্ড দিন</a></p>
<p style="color:#667">আপনি অনুরোধ না করে থাকলে এই মেইল উপেক্ষা করুন, আপনার পাসওয়ার্ড বদলাবে না।</p>`
  });
}

export async function sendOtpMail(to, username, code) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    if (!process.env.VERCEL) return console.log('[মেইল কনফিগার নেই] ওটিপি:', code);
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD সেট করা নেই');
  }
  await transporter().sendMail({
    from: `"হিসাব খাতা" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'হিসাব খাতা অ্যাডমিন: ওটিপি কোড',
    text: `${username}, আপনার ওটিপি কোড: ${code}\n\nকোডটি ১০ মিনিট পর্যন্ত চলবে। কাউকে এটি জানাবেন না। আপনি অনুরোধ না করে থাকলে এই মেইল উপেক্ষা করুন।`,
    html: `<p>${esc(username)}, আপনার ওটিপি কোড:</p>
<p style="font-size:30px;font-weight:700;letter-spacing:6px;color:#0f7b74">${esc(code)}</p>
<p style="color:#667">কোডটি ১০ মিনিট পর্যন্ত চলবে। কাউকে এটি জানাবেন না। আপনি অনুরোধ না করে থাকলে এই মেইল উপেক্ষা করুন।</p>`
  });
}
