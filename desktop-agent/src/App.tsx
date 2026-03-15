import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface Config {
  api_url: string;
  api_token: string;
  track_interval_secs: number;
  sync_interval_secs: number;
  excluded_apps: string[];
  tracking_enabled: boolean;
}

interface Status {
  tracking: boolean;
  todaySeconds: number;
  topApp: string;
  unsyncedCount: number;
}

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}u ${minutes}m`;
  return `${minutes}m`;
}

function App() {
  const [config, setConfig] = useState<Config>({
    api_url: "",
    api_token: "",
    track_interval_secs: 5,
    sync_interval_secs: 30,
    excluded_apps: [],
    tracking_enabled: false,
  });
  const [status, setStatus] = useState<Status>({
    tracking: false,
    todaySeconds: 0,
    topApp: "-",
    unsyncedCount: 0,
  });
  const [showToken, setShowToken] = useState(false);
  const [newExclude, setNewExclude] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await invoke<Status>("get_status");
      setStatus(s);
    } catch (_) {
      // ignore
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const c = await invoke<Config>("get_config");
      setConfig(c);
    } catch (_) {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchConfig, fetchStatus]);

  const handleToggle = async () => {
    try {
      const newState = await invoke<boolean>("toggle_tracking");
      setStatus((s) => ({ ...s, tracking: newState }));
      setConfig((c) => ({ ...c, tracking_enabled: newState }));
    } catch (_) {
      // ignore
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke("save_config", { config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {
      // ignore
    }
    setSaving(false);
  };

  const handleExcludeCurrent = async () => {
    try {
      const appName = await invoke<string>("exclude_current_app");
      if (appName && !config.excluded_apps.includes(appName)) {
        setConfig((c) => ({
          ...c,
          excluded_apps: [...c.excluded_apps, appName],
        }));
      }
    } catch (_) {
      // ignore
    }
  };

  const addExclude = () => {
    const app = newExclude.trim();
    if (app && !config.excluded_apps.includes(app)) {
      setConfig((c) => ({
        ...c,
        excluded_apps: [...c.excluded_apps, app],
      }));
      setNewExclude("");
    }
  };

  const removeExclude = (app: string) => {
    setConfig((c) => ({
      ...c,
      excluded_apps: c.excluded_apps.filter((a) => a !== app),
    }));
  };

  return (
    <div className="app">
      {/* Status Bar */}
      <div className="status-bar">
        <button
          className={`toggle-btn ${status.tracking ? "active" : ""}`}
          onClick={handleToggle}
        >
          {status.tracking ? "Tracking Aan" : "Tracking Uit"}
        </button>
        <div className="status-stats">
          <div className="stat">
            <span className="stat-label">Vandaag</span>
            <span className="stat-value">{formatTime(status.todaySeconds)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Top app</span>
            <span className="stat-value">{status.topApp || "-"}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Niet gesynchroniseerd</span>
            <span className="stat-value">
              {status.unsyncedCount}
              {status.unsyncedCount > 0 && <span className="sync-dot" />}
            </span>
          </div>
        </div>
      </div>

      {/* Verbinding */}
      <div className="section">
        <h3 className="section-title">Verbinding</h3>
        <div className="field">
          <label>API URL</label>
          <input
            type="text"
            value={config.api_url}
            onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
            placeholder="https://dashboard.autronis.nl/api"
          />
        </div>
        <div className="field">
          <label>API Token</label>
          <div className="token-row">
            <input
              type={showToken ? "text" : "password"}
              value={config.api_token}
              onChange={(e) =>
                setConfig({ ...config, api_token: e.target.value })
              }
              placeholder="Token invoeren..."
            />
            <button
              className="btn-small"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? "Verberg" : "Toon"}
            </button>
          </div>
        </div>
      </div>

      {/* Tracking */}
      <div className="section">
        <h3 className="section-title">Tracking</h3>
        <div className="field">
          <label>
            Track interval:{" "}
            <span className="accent">{config.track_interval_secs}s</span>
          </label>
          <input
            type="range"
            min={1}
            max={15}
            value={config.track_interval_secs}
            onChange={(e) =>
              setConfig({
                ...config,
                track_interval_secs: Number(e.target.value),
              })
            }
          />
        </div>
        <div className="field">
          <label>
            Sync interval:{" "}
            <span className="accent">{config.sync_interval_secs}s</span>
          </label>
          <input
            type="range"
            min={15}
            max={120}
            value={config.sync_interval_secs}
            onChange={(e) =>
              setConfig({
                ...config,
                sync_interval_secs: Number(e.target.value),
              })
            }
          />
        </div>
      </div>

      {/* Exclude lijst */}
      <div className="section">
        <h3 className="section-title">Exclude lijst</h3>
        <div className="exclude-list">
          {config.excluded_apps.length === 0 && (
            <span className="text-secondary">Geen apps uitgesloten</span>
          )}
          {config.excluded_apps.map((app) => (
            <div key={app} className="exclude-item">
              <span>{app}</span>
              <button className="btn-x" onClick={() => removeExclude(app)}>
                &times;
              </button>
            </div>
          ))}
        </div>
        <div className="exclude-add">
          <input
            type="text"
            value={newExclude}
            onChange={(e) => setNewExclude(e.target.value)}
            placeholder="App naam..."
            onKeyDown={(e) => e.key === "Enter" && addExclude()}
          />
          <button className="btn-small" onClick={addExclude}>
            Voeg toe
          </button>
        </div>
        <button className="btn-outline" onClick={handleExcludeCurrent}>
          Exclude huidige app
        </button>
      </div>

      {/* Save */}
      <button
        className={`btn-save ${saved ? "saved" : ""}`}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Opslaan..." : saved ? "Opgeslagen!" : "Opslaan"}
      </button>
    </div>
  );
}

export default App;
