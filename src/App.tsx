import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Archive, BarChart3, ChevronRight, Download, History, Home, Pencil, Play, Plus, RotateCcw, Settings, ShieldCheck, Sparkles, Square, Trash2, Upload } from "lucide-react";
import { db, resetDatabase } from "./db";
import { durationBetween, formatDateLabel, formatDuration, formatShortDuration, localDateKey } from "./lib/time";
import type { Activity, ActivitySession, BackupFile } from "./types";
import { useClock } from "./hooks/useClock";
import { archiveActivity, createActivity, renameActivity, restoreActivity } from "./services/activityService";
import { buildDailyReport, aggregateDailyTotals, getSessionsOverlappingDay } from "./services/reportingService";
import { repairTimerState, startTimer, stopTimer } from "./services/timerService";
import { exportExcel } from "./services/exportService";
import { exportBackup, parseBackup, replaceFromBackup } from "./services/backupService";
import { getStorageSummary, requestPersistentStorage, type StorageSummary } from "./services/storageService";
import { subscribeToDataChanges } from "./services/syncService";

type View = "home" | "add" | "history" | "settings";

function activityNameMap(activities: Activity[]): Map<string, string> {
  return new Map(activities.map((activity) => [activity.id, activity.name]));
}

export function App() {
  const [view, setView] = useState<View>("home");
  const [message, setMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    repairTimerState().catch((error) => setMessage(error.message));
    return subscribeToDataChanges(() => setRefreshKey((value) => value + 1));
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local only</p>
          <h1>Activity Tracker</h1>
        </div>
        <StatusPill />
      </header>

      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message">
            x
          </button>
        </div>
      )}

      <main className="main">
        {view === "home" && <HomeView key={`home-${refreshKey}`} setMessage={setMessage} setView={setView} />}
        {view === "add" && <AddActivityView setMessage={setMessage} setView={setView} />}
        {view === "history" && <HistoryView key={`history-${refreshKey}`} />}
        {view === "settings" && <SettingsView key={`settings-${refreshKey}`} setMessage={setMessage} />}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <button type="button" className={view === "home" ? "active" : ""} onClick={() => setView("home")}>
          <Home size={20} />
          <span>Home</span>
        </button>
        <button type="button" className={view === "add" ? "active" : ""} onClick={() => setView("add")}>
          <Plus size={20} />
          <span>Add</span>
        </button>
        <button type="button" className={view === "history" ? "active" : ""} onClick={() => setView("history")}>
          <History size={20} />
          <span>History</span>
        </button>
        <button type="button" className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}

function StatusPill() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return <span className="status-pill">{online ? "Online ready" : "Offline ready"}</span>;
}

function HomeView({ setMessage, setView }: { setMessage: (message: string | null) => void; setView: (view: View) => void }) {
  const now = useClock();
  const today = localDateKey(now);
  const activities = useLiveQuery(async () => {
    const rows = await db.activities.orderBy("createdAt").toArray();
    return rows.filter((activity) => !activity.archivedAt);
  }, [], []);
  const activeSession = useLiveQuery(async () => {
    const state = await db.appState.get("activeSessionId");
    return state?.value ? db.sessions.get(state.value) : undefined;
  }, [], undefined);
  const todaySessions = useLiveQuery(() => getSessionsOverlappingDay(today), [today], []);

  const todayTotals = useMemo(() => aggregateDailyTotals(todaySessions ?? [], now).filter((total) => total.date === today), [todaySessions, now, today]);
  const totalByActivity = useMemo(() => new Map(todayTotals.map((total) => [total.activityId, total.durationMs])), [todayTotals]);

  async function start(activityId: string) {
    try {
      await startTimer(activityId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start timer.");
    }
  }

  async function stop() {
    try {
      await stopTimer();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to stop timer.");
    }
  }

  const activeActivity = activities?.find((activity) => activity.id === activeSession?.activityId);
  const activeElapsed = activeSession ? durationBetween(activeSession.startTime, activeSession.endTime, now) : 0;

  return (
    <section className="view">
      {activeSession && activeActivity ? (
        <ActiveTimerCard activity={activeActivity} elapsedMs={activeElapsed} onStop={stop} />
      ) : (
        <section className="ready-panel">
          <div>
            <p className="eyebrow">Ready</p>
            <h2>No timer running</h2>
          </div>
          <button type="button" onClick={() => setView("add")}>
            <Plus size={18} />
            Add activity
          </button>
        </section>
      )}

      <div className="section-heading">
        <div>
          <p className="eyebrow">Activities</p>
          <h2>Start tracking</h2>
        </div>
        <button type="button" className="secondary-action" onClick={() => setView("add")}>
          <Plus size={18} />
          New
        </button>
      </div>

      <div className="list">
        {activities?.length === 0 && (
          <div className="empty-state">
            <h2>No activities yet.</h2>
            <p>Create your first activity to start tracking.</p>
            <button type="button" onClick={() => setView("add")}>
              <Plus size={18} />
              Add activity
            </button>
          </div>
        )}

        {activities?.map((activity) => {
          const running = activeSession?.activityId === activity.id && !activeSession.endTime;
          const todayMs = totalByActivity.get(activity.id) ?? 0;
          return (
            <article className={`activity-row ${running ? "running" : ""}`} key={activity.id}>
              <div>
                <h3>{activity.name}</h3>
                <p>Today: {formatDuration(todayMs)}</p>
              </div>
              {running ? (
                <button type="button" className="danger icon-action" onClick={stop} aria-label={`Stop ${activity.name}`}>
                  <Square size={20} />
                </button>
              ) : (
                <button type="button" className="primary icon-action" onClick={() => start(activity.id)} aria-label={`Start ${activity.name}`}>
                  <Play size={20} />
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ActiveTimerCard({ activity, elapsedMs, onStop }: { activity: Activity; elapsedMs: number; onStop: () => void }) {
  return (
    <section className="timer-popover" aria-live="polite">
      <div className="timer-orbit" aria-hidden="true">
        <Sparkles size={22} />
      </div>
      <div className="timer-popover-copy">
        <p className="eyebrow">Running now</p>
        <h2>{activity.name}</h2>
        <div className="timer-display">{formatDuration(elapsedMs)}</div>
      </div>
      <button type="button" className="danger large-action" onClick={onStop}>
        <Square size={22} />
        Stop
      </button>
    </section>
  );
}

function AddActivityView({ setMessage, setView }: { setMessage: (message: string | null) => void; setView: (view: View) => void }) {
  const [name, setName] = useState("");

  async function handleCreateActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createActivity(name);
      setName("");
      setMessage("Activity created.");
      setView("home");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create activity.");
    }
  }

  return (
    <section className="view">
      <div className="section-heading">
        <div>
          <p className="eyebrow">New activity</p>
          <h2>Create activity</h2>
        </div>
      </div>

      <form className="create-panel" onSubmit={handleCreateActivity}>
        <div className="create-accent" aria-hidden="true">
          <Plus size={28} />
        </div>
        <label>
          <span>Activity name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Coding" maxLength={80} autoFocus />
        </label>
        <div className="create-actions">
          <button type="button" className="secondary-action" onClick={() => setView("home")}>
            Home
          </button>
          <button type="submit">
            Save
            <ChevronRight size={18} />
          </button>
        </div>
      </form>
    </section>
  );
}

function HistoryView() {
  const now = useClock();
  const [date, setDate] = useState(localDateKey(new Date()));
  const report = useLiveQuery(() => buildDailyReport(date, now), [date, now], undefined);
  const activities = useLiveQuery(() => db.activities.toArray(), [], []);
  const names = useMemo(() => activityNameMap(activities ?? []), [activities]);

  return (
    <section className="view">
      <div className="section-heading">
        <div>
          <p className="eyebrow">History</p>
          <h2>{formatDateLabel(date)}</h2>
        </div>
        <label className="date-control">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      <section className="summary-band">
        <div>
          <p className="eyebrow">Daily total</p>
          <strong>{formatDuration(report?.totalMs ?? 0)}</strong>
        </div>
        <BarChart3 size={32} aria-hidden="true" />
      </section>

      <div className="totals-grid">
        {report?.totals.map((total) => (
          <div className="total-tile" key={`${total.date}-${total.activityId}`}>
            <span>{names.get(total.activityId) ?? "Unknown activity"}</span>
            <strong>{formatDuration(total.durationMs)}</strong>
          </div>
        ))}
      </div>

      <div className="list">
        {report?.sessions.length === 0 && (
          <div className="empty-state">
            <h2>No activity recorded.</h2>
            <p>This date has no tracked sessions.</p>
          </div>
        )}

        {report?.sessions.map((session) => (
          <article className="session-row" key={session.id}>
            <div>
              <h3>{session.activity?.name ?? "Unknown activity"}</h3>
              <p>
                {new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(session.startTime))} -{" "}
                {session.endTime ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(session.endTime)) : "Running"}
              </p>
            </div>
            <strong>{formatShortDuration(session.durationMs)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function SettingsView({ setMessage }: { setMessage: (message: string | null) => void }) {
  const [storage, setStorage] = useState<StorageSummary | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activities = useLiveQuery(() => db.activities.toArray(), [], []);

  const activeActivities = (activities ?? []).filter((activity) => !activity.archivedAt);
  const archivedActivities = (activities ?? []).filter((activity) => activity.archivedAt);

  useEffect(() => {
    getStorageSummary().then(setStorage).catch(() => setStorage(null));
  }, [activities]);

  async function rename(activity: Activity) {
    const nextName = window.prompt("Rename activity", activity.name);
    if (nextName === null) return;
    try {
      await renameActivity(activity.id, nextName);
      setMessage("Activity renamed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to rename activity.");
    }
  }

  async function archive(activity: Activity) {
    if (!window.confirm(`Archive ${activity.name}? Historical sessions will remain available.`)) return;
    try {
      await archiveActivity(activity.id);
      setMessage("Activity archived.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive activity.");
    }
  }

  async function restore(activity: Activity) {
    try {
      await restoreActivity(activity.id);
      setMessage("Activity restored.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to restore activity.");
    }
  }

  async function handleBackupFile(file: File | undefined) {
    if (!file) return;
    try {
      setPendingBackup(parseBackup(await file.text()));
      setMessage("Backup validated. Confirm restore to replace local data.");
    } catch (error) {
      setPendingBackup(null);
      setMessage(error instanceof Error ? error.message : "Backup could not be read.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function clearData() {
    if (!window.confirm("Clear all local activity data? Create a backup first if you need this history.")) return;
    await resetDatabase();
    setMessage("Local data cleared.");
  }

  return (
    <section className="view">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Activities and data</h2>
        </div>
      </div>

      <section className="settings-section">
        <h3>Activities</h3>
        <div className="list compact">
          {activeActivities.map((activity) => (
            <article className="manage-row" key={activity.id}>
              <span>{activity.name}</span>
              <div className="button-cluster">
                <button type="button" className="icon-action" onClick={() => rename(activity)} aria-label={`Rename ${activity.name}`}>
                  <Pencil size={18} />
                </button>
                <button type="button" className="icon-action" onClick={() => archive(activity)} aria-label={`Archive ${activity.name}`}>
                  <Archive size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Archived</h3>
        <div className="list compact">
          {archivedActivities.length === 0 && <p className="muted">No archived activities.</p>}
          {archivedActivities.map((activity) => (
            <article className="manage-row" key={activity.id}>
              <span>{activity.name}</span>
              <button type="button" className="icon-action" onClick={() => restore(activity)} aria-label={`Restore ${activity.name}`}>
                <RotateCcw size={18} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Data</h3>
        <div className="action-grid">
          <button type="button" onClick={() => exportExcel().catch((error) => setMessage(error.message))}>
            <Download size={18} />
            Excel
          </button>
          <button type="button" onClick={() => exportBackup().catch((error) => setMessage(error.message))}>
            <Download size={18} />
            Backup
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} />
            Import
          </button>
          <button type="button" className="danger" onClick={clearData}>
            <Trash2 size={18} />
            Clear
          </button>
        </div>
        <input ref={fileInputRef} className="hidden-input" type="file" accept="application/json,.json" onChange={(event) => handleBackupFile(event.target.files?.[0])} />
        {pendingBackup && (
          <div className="restore-panel">
            <p>
              Restore backup from {new Date(pendingBackup.exportedAt).toLocaleString()} with {pendingBackup.activities.length} activities and {pendingBackup.sessions.length} sessions.
            </p>
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (!window.confirm("Replace current local data with this backup?")) return;
                replaceFromBackup(pendingBackup)
                  .then(() => {
                    setPendingBackup(null);
                    setMessage("Backup restored.");
                  })
                  .catch((error) => setMessage(error.message));
              }}
            >
              Replace data
            </button>
          </div>
        )}
      </section>

      <section className="settings-section storage-strip">
        <h3>Storage</h3>
        <dl>
          <div>
            <dt>Activities</dt>
            <dd>{storage?.activityCount ?? "..."}</dd>
          </div>
          <div>
            <dt>Sessions</dt>
            <dd>{storage?.sessionCount ?? "..."}</dd>
          </div>
          <div>
            <dt>Used</dt>
            <dd>{storage?.usageText ?? "..."}</dd>
          </div>
          <div>
            <dt>Quota</dt>
            <dd>{storage?.quotaText ?? "..."}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() =>
            requestPersistentStorage()
              .then((granted) => setMessage(granted ? "Persistent storage granted." : "Persistent storage was not granted."))
              .catch(() => setMessage("Persistent storage is not available."))
          }
        >
          <ShieldCheck size={18} />
          Persist
        </button>
      </section>
    </section>
  );
}
