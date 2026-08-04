"use client";

import { useEffect } from "react";
import { recordBaseConsents } from "@/app/(member)/actions";

/** Records ToS + privacy consent once per account (LGPD consent trail). */
export function ConsentRecorder() {
  useEffect(() => {
    recordBaseConsents().catch(() => {});
  }, []);
  return null;
}
