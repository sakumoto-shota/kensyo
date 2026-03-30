/**
 * Cloud Logging 構造化ログヘルパー
 * stdout に JSON を出力するだけで Cloud Run が自動取り込みする
 * https://cloud.google.com/run/docs/logging#writing_structured_logs
 */

type Severity = "INFO" | "WARNING" | "ERROR" | "DEBUG";

interface LogEntry {
  severity: Severity;
  message: string;
  [key: string]: unknown;
}

function log(severity: Severity, message: string, extra?: Record<string, unknown>) {
  const entry: LogEntry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    ...extra,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (message: string, extra?: Record<string, unknown>) => log("INFO", message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => log("WARNING", message, extra),
  error: (message: string, extra?: Record<string, unknown>) => log("ERROR", message, extra),
  debug: (message: string, extra?: Record<string, unknown>) => log("DEBUG", message, extra),
};
