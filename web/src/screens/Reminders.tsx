import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { NotifCard, Seg, Switch } from '../components/bits';
import { useToast } from '../components/Toast';
import { timeIcon } from '../../../shared/icons';
import { DAY_LETTERS, LABEL_MAX, type PushData, type Reminder } from '../../../shared/types';
import { VIBES, VIBE_NAMES, type Vibe } from '../../../shared/vibes';
import { useStore } from '../data/store';
import { makeSample } from '../lib/sample';
import { formatTime } from '../lib/time';

const VIBE_OPTIONS = VIBE_NAMES.map((v) => ({ value: v, label: VIBES[v].label }));

export function RemindersScreen({
  onSendTest,
  onShowBanner,
}: {
  onSendTest: () => void;
  onShowBanner: () => void;
}) {
  const store = useStore();
  const { settings, affirmations, reminders, updateReminder, updateSettings } = store;
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null);
  const [preview, setPreview] = useState<PushData>(() =>
    makeSample(settings, affirmations, reminders),
  );

  const sorted = [...reminders].sort((a, b) => a.time.localeCompare(b.time));

  const setVibe = (vibe: Vibe) => {
    void updateSettings({ vibe });
    setPreview(makeSample({ ...settings, vibe }, affirmations, reminders));
  };

  return (
    <>
      <section className="screen" aria-labelledby="rem-title">
        <h2 id="rem-title">
          Reminders
          <Icon name="sun" className="h" />
        </h2>
        <p className="sub">Sunny picks a random affirmation for each one.</p>
        <div className="list">
          {sorted.map((r) => (
            <div key={r.id} className={r.active ? 'item' : 'item off'}>
              <span className="badge" aria-hidden="true" style={{ opacity: r.active ? 1 : 0.5 }}>
                <Icon name={timeIcon(r.time)} />
              </span>
              <button
                type="button"
                className="time"
                style={{ opacity: r.active ? 1 : 0.5 }}
                onClick={() => setEditing(r)}
                aria-label={`Edit ${r.label} reminder at ${formatTime(r.time)}`}
              >
                <div className="big">{formatTime(r.time)}</div>
                <div className="lab">{r.label}</div>
                <div className="days">
                  {DAY_LETTERS.map((d, i) => (
                    <i key={i} className={r.days[i] === '1' ? 'on' : ''}>
                      {d}
                    </i>
                  ))}
                </div>
              </button>
              <Switch
                checked={r.active}
                label={`${r.label} reminder on`}
                onChange={(active) => void updateReminder(r.id, { active })}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn ghost block"
          style={{ marginTop: 12 }}
          onClick={() => setEditing('new')}
        >
          Add reminder
        </button>

        <div className="preview">
          <h3>Notification vibe</h3>
          <Seg
            className="vibe-seg"
            label="Notification vibe"
            options={VIBE_OPTIONS}
            value={settings.vibe}
            onChange={setVibe}
          />
          <NotifCard title={preview.title} body={preview.body} />
          <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn small" onClick={onSendTest}>
              Send to lock screen
            </button>
            <button type="button" className="btn small ghost" onClick={onShowBanner}>
              Show in-app banner
            </button>
          </div>
        </div>
      </section>

      {editing && (
        <ReminderSheet
          reminder={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function ReminderSheet({ reminder, onClose }: { reminder: Reminder | null; onClose: () => void }) {
  const { addReminder, updateReminder, deleteReminder } = useStore();
  const toast = useToast();
  const [time, setTime] = useState(reminder?.time ?? '18:00');
  const [label, setLabel] = useState(reminder?.label ?? '');
  const [days, setDays] = useState(reminder?.days ?? '1111111');

  const toggleDay = (i: number) =>
    setDays((d) => d.slice(0, i) + (d[i] === '1' ? '0' : '1') + d.slice(i + 1));

  const save = async () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      toast('Pick a time for this reminder, then tap Save.');
      return;
    }
    if (!days.includes('1')) {
      toast('Pick at least one day, then tap Save.');
      return;
    }
    const input = { time, label: label.trim() || 'Reminder', days };
    onClose();
    const ok = reminder ? await updateReminder(reminder.id, input) : await addReminder(input);
    if (ok) toast('Reminder saved');
  };

  return (
    <Sheet title={reminder ? 'Edit reminder' : 'New reminder'} onClose={onClose}>
      <input
        className="field"
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        aria-label="Time"
      />
      <input
        className="field"
        type="text"
        value={label}
        maxLength={LABEL_MAX}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Name, like Evening lift"
        aria-label="Name"
      />
      <div className="daypick" role="group" aria-label="Days">
        {DAY_LETTERS.map((d, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={days[i] === '1'}
            aria-label={
              ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]
            }
            onClick={() => toggleDay(i)}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="row">
        {reminder ? (
          <button
            type="button"
            className="btn ghost"
            onClick={async () => {
              onClose();
              if (await deleteReminder(reminder.id)) toast('Reminder deleted');
            }}
          >
            Delete
          </button>
        ) : (
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        )}
        <button type="button" className="btn flame" onClick={() => void save()}>
          Save
        </button>
      </div>
    </Sheet>
  );
}
