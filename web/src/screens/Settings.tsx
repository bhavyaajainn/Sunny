import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Seg } from '../components/bits';
import { NAME_MAX, type Theme } from '../../../shared/types';
import { useStore } from '../data/store';

const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Auto' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsScreen({
  onSendTest,
  onShowInstall,
}: {
  onSendTest: () => void;
  onShowInstall: () => void;
}) {
  const { settings, notif, updateSettings, enableNotifications } = useStore();
  const [name, setName] = useState(settings.name);

  const saveName = () => {
    const v = name.trim();
    if (v !== settings.name) void updateSettings({ name: v });
  };

  return (
    <section className="screen" aria-labelledby="set-title">
      <h2 id="set-title">
        Settings
        <Icon name="flower" className="h" />
      </h2>

      <div className="set">
        <label className="line">
          <span>Your name</span>
          <input
            type="text"
            value={name}
            maxLength={NAME_MAX}
            placeholder="Add your name"
            autoComplete="given-name"
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </label>
        <div className="line">
          <span>Notifications</span>
          {notif === 'granted' ? (
            <span className="ok">Allowed</span>
          ) : notif === 'default' ? (
            <button type="button" className="btn small" onClick={() => void enableNotifications()}>
              Turn on
            </button>
          ) : (
            <span className="off-state">Off</span>
          )}
        </div>
        {notif === 'denied' && (
          <p className="hint">
            To get reminders, open iPhone Settings → Notifications → Sunny and turn on Allow
            Notifications.
          </p>
        )}
        {notif === 'unsupported' && (
          <p className="hint">
            To get notifications, add Sunny to your Home Screen (Install guide below) and open it
            from the icon. Needs iOS 16.4 or newer.
          </p>
        )}
        <div className="line">
          <span>Test notification</span>
          <button type="button" className="btn small" onClick={onSendTest}>
            Send
          </button>
        </div>
      </div>

      <div className="set">
        <div className="line">
          <span>Theme</span>
          <Seg
            label="Theme"
            options={THEME_OPTIONS}
            value={settings.theme}
            onChange={(theme) => void updateSettings({ theme })}
          />
        </div>
      </div>

      <div className="set">
        <div className="line">
          <span>Install guide</span>
          <button type="button" className="btn small ghost" onClick={onShowInstall}>
            Show
          </button>
        </div>
      </div>
    </section>
  );
}
