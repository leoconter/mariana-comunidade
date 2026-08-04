import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Direct HTML email (announcements). Logs to email_log; skips without key. */
export async function sendRawEmail(input: {
  to: string;
  userId?: string | null;
  subject: string;
  html: string;
  related?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  let resendId: string | null = null;
  let status = "skipped";

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: input.to,
          subject: input.subject,
          html: input.html,
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { id?: string };
        resendId = data.id ?? null;
        status = "sent";
      } else {
        status = `error:${response.status}`;
      }
    } catch {
      status = "error:network";
    }
  }

  await supabase.from("email_log").insert({
    user_id: input.userId ?? null,
    to_email: input.to,
    template_key: "announcement",
    subject: input.subject,
    resend_id: resendId,
    status,
    related: (input.related ?? {}) as never,
  });
}

/**
 * Sends a transactional email via Resend using an editable template from
 * `email_templates`, and records the attempt in `email_log`.
 * Degrades gracefully (logs status "skipped") when RESEND_API_KEY is not set.
 */
export async function sendTemplateEmail(input: {
  templateKey: string;
  to: string;
  userId?: string | null;
  variables: Record<string, string>;
  related?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body_html")
    .eq("key", input.templateKey)
    .single();
  if (!template) return;

  const render = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => input.variables[key] ?? "");

  const subject = render(template.subject);
  const html = render(template.body_html);

  let resendId: string | null = null;
  let status = "skipped";

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: input.to,
          subject,
          html,
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { id?: string };
        resendId = data.id ?? null;
        status = "sent";
      } else {
        status = `error:${response.status}`;
      }
    } catch {
      status = "error:network";
    }
  }

  await supabase.from("email_log").insert({
    user_id: input.userId ?? null,
    to_email: input.to,
    template_key: input.templateKey,
    subject,
    resend_id: resendId,
    status,
    related: (input.related ?? {}) as never,
  });
}
