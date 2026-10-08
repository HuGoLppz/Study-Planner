import { useQuery } from "@tanstack/react-query";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { useMemo } from "react";
import { dashboardApi } from "../services/api.js";
import { dayKey, timeZone } from "../utils/dates.js";
import { qk } from "./queryKeys.js";

export const HORIZON_DAYS = 14;

// El rango del horizonte se calcula en la zona horaria del navegador.
export function useDashboard() {
  const params = useMemo(() => {
    const today = new Date();
    return {
      from: startOfDay(today).toISOString(),
      to: endOfDay(addDays(today, HORIZON_DAYS - 1)).toISOString(),
      day: dayKey(today),
      tz: timeZone(),
    };
  }, []);

  return useQuery({
    queryKey: qk.dashboard(params),
    queryFn: () => dashboardApi.get(params),
  });
}
