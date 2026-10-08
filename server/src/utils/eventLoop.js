import { monitorEventLoopDelay } from "node:perf_hooks";
import { logger } from "./logger.js";

// Retraso del bucle de eventos: cuánto espera una petición o un socket a que el hilo de Node quede
// libre. Es la señal de saturación de este servidor (todo, incluido SQLite, corre en un hilo).
const histogram = monitorEventLoopDelay({ resolution: 10 });
const ms = (nanoseconds) => Math.round((nanoseconds / 1e6) * 10) / 10;
const WARN_P99_MS = 200;

let last = { p50: 0, p99: 0, max: 0 };

export function startEventLoopMonitor({ intervalMs = 60 * 1000 } = {}) {
  histogram.enable();
  const timer = setInterval(() => {
    last = {
      p50: ms(histogram.percentile(50)),
      p99: ms(histogram.percentile(99)),
      max: ms(histogram.max),
    };
    histogram.reset();
    if (last.p99 >= WARN_P99_MS) {
      logger.warn(
        `Bucle de eventos saturado: p99 ${last.p99} ms, máximo ${last.max} ms en el último minuto`,
      );
    }
  }, intervalMs);
  timer.unref();
  return () => {
    clearInterval(timer);
    histogram.disable();
  };
}

// Último minuto completo y lo que va del actual.
export function eventLoopDelay() {
  return {
    lastMinute: last,
    current: {
      p50: ms(histogram.percentile(50)),
      p99: ms(histogram.percentile(99)),
      max: ms(histogram.max),
    },
  };
}
