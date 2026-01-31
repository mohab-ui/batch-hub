import { Suspense } from "react";
import McqHistoryClient from "./McqHistoryClient";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>جاري التحميل...</div>}>
      <McqHistoryClient />
    </Suspense>
  );
}
