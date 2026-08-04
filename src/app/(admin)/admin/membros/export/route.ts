import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "full_name, email, role, city, state, crefito, created_at, last_seen_at, access_valid_until, subscriptions(status, plan, current_period_end)"
    )
    .order("created_at");

  const header =
    "nome,email,papel,cidade,uf,crefito,entrou_em,ultimo_acesso,acesso_valido_ate,status_assinatura,plano,fim_do_periodo";
  const escape = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = (profiles ?? []).map((p) =>
    [
      p.full_name,
      p.email,
      p.role,
      p.city,
      p.state,
      p.crefito,
      p.created_at,
      p.last_seen_at,
      p.access_valid_until,
      p.subscriptions?.status,
      p.subscriptions?.plan,
      p.subscriptions?.current_period_end,
    ]
      .map(escape)
      .join(",")
  );

  const csv = "﻿" + [header, ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="membros-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
