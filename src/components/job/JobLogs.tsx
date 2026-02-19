interface JobLogsProps {
  logs: string[];
}

export default function JobLogs({ logs }: JobLogsProps) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-5 py-3">
        <span className="text-sm font-medium">Loglar</span>
      </div>
      <div className="max-h-72 overflow-auto p-4">
        <div className="mono space-y-0.5 text-xs text-muted-foreground">
          {logs.length === 0 ? (
            <div>Ulanmoqda...</div>
          ) : (
            logs.map((log, idx) => (
              <div key={`${log}-${idx}`} className="leading-relaxed">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
