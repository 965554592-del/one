/**
 * Cloud Function: scanTaskReminders
 *
 * Runs every hour via Cloud Scheduler. Scans the `tasks` collection for
 * pending tasks whose dueDate is today or overdue and reminderSent === false.
 * Sends an email reminder to the admin notify emails, then marks
 * reminderSent = true so it won't fire again.
 *
 * SMTP & notification settings are read from Firestore `settings/global`.
 *
 * ── Deployment ──────────────────────────────────────────────
 *   cd functions
 *   npm install
 *   firebase deploy --only functions
 *
 * Requires Firebase Blaze (pay-as-you-go) plan for scheduled functions
 * and outbound SMTP connections.
 *
 * ── Alternative (no Blaze) ──────────────────────────────────
 * Use the Render backend endpoint  POST /api/tasks/scan
 * with an external cron service like https://cron-job.org
 * (see server.ts for implementation).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

initializeApp();

// Use named database – must match the frontend config
const FIRESTORE_DB_ID = 'ai-studio-3112dc56-9c5d-41d4-8544-f79c07c29140';

export const scanTaskReminders = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'Asia/Shanghai',
    region: 'asia-east1',
  },
  async () => {
    const db = getFirestore(FIRESTORE_DB_ID);

    // 1. Load SMTP + notification settings
    const settingsSnap = await db.doc('settings/global').get();
    const settings = settingsSnap.data() || {};

    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, notifyEmails, emailNotifyEnabled } = settings;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.log('[TaskScan] SMTP not configured – skipping.');
      return;
    }
    if (!emailNotifyEnabled || !notifyEmails) {
      console.log('[TaskScan] Email notifications disabled or no notify emails – skipping.');
      return;
    }

    // 2. Query pending tasks that haven't been reminded yet
    const today = new Date().toISOString().slice(0, 10);
    const tasksSnap = await db
      .collection('tasks')
      .where('status', '==', 'pending')
      .where('reminderSent', '==', false)
      .where('dueDate', '<=', today)
      .get();

    if (tasksSnap.empty) {
      console.log('[TaskScan] No due tasks found.');
      return;
    }

    // 3. Build transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort) || 587,
      secure: smtpSecure ?? false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const recipients = notifyEmails
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter(Boolean)
      .join(', ');

    // 4. Send one summary email for all due tasks
    const taskRows = tasksSnap.docs
      .map((d) => {
        const t = d.data();
        const overdue = t.dueDate < today;
        return `<tr style="background:${overdue ? '#fff5f5' : '#fff'};">
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${t.title}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${t.customerName || '-'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${overdue ? '#e53e3e' : '#333'};font-weight:${overdue ? 'bold' : 'normal'};">${t.dueDate}${overdue ? ' ⚠️ OVERDUE' : ''}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${t.priority}</td>
        </tr>`;
      })
      .join('');

    const html = `
<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:8px;">
  <h2 style="color:#FFB300;margin-top:0;">📋 Task Reminder — ${tasksSnap.size} task(s) due</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead>
      <tr style="background:#0A192F;color:#FFB300;">
        <th style="padding:10px 12px;text-align:left;">Task</th>
        <th style="padding:10px 12px;text-align:left;">Customer</th>
        <th style="padding:10px 12px;text-align:left;">Due Date</th>
        <th style="padding:10px 12px;text-align:left;">Priority</th>
      </tr>
    </thead>
    <tbody>${taskRows}</tbody>
  </table>
  <p style="margin-top:16px;font-size:13px;color:#666;">
    Log in to the <a href="https://autoparts.fit/admin" style="color:#FFB300;">Admin Dashboard</a> to manage these tasks.
  </p>
  <p style="font-size:11px;color:#999;margin-top:20px;">Sent by Vida Auto Cloud Scheduler</p>
</div>`;

    try {
      await transporter.sendMail({
        from: `"Vida Auto" <${smtpUser}>`,
        to: recipients,
        subject: `[Vida Auto] ${tasksSnap.size} follow-up task(s) due today`,
        html,
      });
      console.log(`[TaskScan] Reminder sent to ${recipients} for ${tasksSnap.size} tasks.`);
    } catch (err) {
      console.error('[TaskScan] Failed to send email:', err);
      return; // Don't mark as sent if email failed
    }

    // 5. Mark all reminded tasks
    const batch = db.batch();
    tasksSnap.docs.forEach((d) => {
      batch.update(d.ref, { reminderSent: true, lastRemindedAt: new Date().toISOString() });
    });
    await batch.commit();
    console.log(`[TaskScan] Marked ${tasksSnap.size} tasks as reminded.`);
  }
);
