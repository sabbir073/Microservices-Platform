"use client";

import { useEffect, useState } from "react";
import {
  AnalyticsPanel,
  type AnalyticsResp,
} from "@/components/user/profile/analytics-panel";

export function AdminUserAnalyticsTab({ userId }: { userId: string }) {
  const [data, setData] = useState<AnalyticsResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/admin/users/${userId}/analytics`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancel) setData(d as AnalyticsResp);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [userId]);

  return <AnalyticsPanel data={data} loading={loading} />;
}
