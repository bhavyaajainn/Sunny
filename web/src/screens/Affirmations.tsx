import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { NotifCard, Seg, Switch, TRASH_SVG } from '../components/bits';
import { useToast } from '../components/Toast';
import { ICON_NAMES, timeIcon, type IconName } from '../../../shared/icons';
import { buildPayload } from '../../../shared/payload';
import { AFFIRMATION_MAX, DAY_LETTERS, DAY_NAMES, type Affirmation } from '../../../shared/types';
import { VIBES, VIBE_NAMES, type Vibe } from '../../../shared/vibes';
import { useStore } from '../data/store';
import { formatDays, formatTime } from '../lib/time';

const QUICK_EMOJI = ['☀️', '💪', '✨', '🌻', '🔥', '🧘'];
const VIBE_OPTIONS = VIBE_NAMES.map((v) => ({ value: v, label: VIBES[v].label }));
const VIBE_EMOJI: Record<Vibe, string> = { hype: '🔥', sunny: '☀️', calm: '🌙' };
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function AffirmationsScreen() {
  const { affirmations, updateAffirmation, deleteAffirmation, restoreAffirmation } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState<Affirmation | 'new' | null>(null);

  const inRotation = affirmations.filter((a) => a.active).length;

  const remove = async (a: Affirmation) => {
    if (!(await deleteAffirmation(a.id))) return;
    toast('Affirmation deleted', {
      label: 'Undo',
      run: async () => {
        if (await restoreAffirmation(a.id)) toast('Affirmation restored');
      },
    });
  };

  return (
    <>
      <section className="screen" aria-labelledby="affs-title">
        <h2 id="affs-title">
          Affirmations
          <Icon name="sprout" className="h" />
        </h2>
        <p className="sub">
          {affirmations.length} saved, {inRotation} on. Each one arrives at its own time. Tap one to
          edit.
        </p>
        {affirmations.length ? (
          <div className="list aff-list">
            {affirmations.map((a) => (
              <div key={a.id} className={a.active ? 'item' : 'item off'}>
                <span className="badge" aria-hidden="true">
                  <Icon name={a.icon} />
                </span>
                <button
                  type="button"
                  className="txt"
                  onClick={() => setEditing(a)}
                  aria-label={`Edit: ${a.text}. ${
                    a.time
                      ? `Reminder ${formatTime(a.time)}, ${formatDays(a.days)}, ${a.vibe} vibe`
                      : 'No reminder time yet'
                  }`}
                >
                  {a.text}
                  {a.time ? (
                    <span className="meta">
                      <Icon name={timeIcon(a.time)} />
                      <span>
                        <span className="nw">{formatTime(a.time)}</span> ·{' '}
                        <span className="nw">{formatDays(a.days)}</span> · {VIBE_EMOJI[a.vibe]}
                      </span>
                    </span>
                  ) : (
                    <span className="meta unset">⏰ Set a time</span>
                  )}
                </button>
                <div className="side">
                  <Switch
                    checked={a.active}
                    label="Affirmation on"
                    onChange={(active) => void updateAffirmation(a.id, { active })}
                  />
                  <button
                    type="button"
                    className="del"
                    aria-label="Delete affirmation"
                    onClick={() => void remove(a)}
                  >
                    {TRASH_SVG}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Icon name="sprout" />
            <br />
            No affirmations yet. Tap "Add affirmation" to plant your first one.
          </div>
        )}
      </section>

      <button type="button" className="btn flame fab" onClick={() => setEditing('new')}>
        ＋ Add affirmation
      </button>

      {editing && (
        <AffirmationSheet
          aff={editing === 'new' ? null : editing}
          defaultIcon={ICON_NAMES[affirmations.length % ICON_NAMES.length] ?? 'sun'}
          onClose={() => setEditing(null)}
          onDelete={(a) => {
            setEditing(null);
            void remove(a);
          }}
        />
      )}
    </>
  );
}

function AffirmationSheet({
  aff,
  defaultIcon,
  onClose,
  onDelete,
}: {
  aff: Affirmation | null;
  defaultIcon: IconName;
  onClose: () => void;
  onDelete: (a: Affirmation) => void;
}) {
  const { settings, addAffirmation, updateAffirmation } = useStore();
  const toast = useToast();
  const [text, setText] = useState(aff?.text ?? '');
  const [icon, setIcon] = useState<IconName>(aff?.icon ?? defaultIcon);
  // New ones start at 9:00 AM; older ones made before times existed start empty.
  const [time, setTime] = useState(aff ? (aff.time ?? '') : '09:00');
  const [days, setDays] = useState(aff?.days ?? '1111111');
  const [vibe, setVibe] = useState<Vibe>(aff?.vibe ?? 'sunny');
  const ta = useRef<HTMLTextAreaElement>(null);
  const timeIn = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aff) return; // editing: don't pop the keyboard over the time and vibe
    const t = setTimeout(() => ta.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [aff]);

  const toggleDay = (i: number) =>
    setDays((d) => d.slice(0, i) + (d[i] === '1' ? '0' : '1') + d.slice(i + 1));

  const preview = buildPayload(
    {
      vibe,
      name: settings.name,
      affirmation: { id: 0, text: text.trim() || 'Your affirmation', time: time || null },
    },
    () => 0,
  );

  const save = async () => {
    const v = text.trim();
    if (!v) {
      ta.current?.focus();
      toast('Write a few words first, then tap Save.');
      return;
    }
    if (!TIME_RE.test(time)) {
      timeIn.current?.focus();
      toast('Pick a time for this affirmation, then tap Save.');
      return;
    }
    if (!days.includes('1')) {
      toast('Pick at least one day, then tap Save.');
      return;
    }
    const input = { text: v, icon, time, days, vibe };
    onClose();
    const ok = aff ? await updateAffirmation(aff.id, input) : await addAffirmation(input);
    if (ok) toast(aff ? 'Affirmation saved' : `Added 🌱 See you at ${formatTime(time)}`);
  };

  return (
    <Sheet title={aff ? 'Edit affirmation' : 'New affirmation'} onClose={onClose}>
      <textarea
        ref={ta}
        className="field"
        value={text}
        maxLength={AFFIRMATION_MAX}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write it the way you'd say it to yourself"
        aria-label="Affirmation text"
      />
      <div className="iconpick" role="group" aria-label="Pick an icon">
        {ICON_NAMES.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === icon}
            aria-label={k}
            onClick={() => setIcon(k)}
          >
            <Icon name={k} />
          </button>
        ))}
      </div>
      <div className="emojis">
        {QUICK_EMOJI.map((x) => (
          <button
            key={x}
            type="button"
            aria-label={`Add ${x}`}
            onClick={() => {
              setText((t) => `${t.trim()} ${x}`.trim().slice(0, AFFIRMATION_MAX));
              ta.current?.focus();
            }}
          >
            {x}
          </button>
        ))}
      </div>

      <label className="lbl" htmlFor="aff-time">
        Remind me at
      </label>
      <input
        ref={timeIn}
        id="aff-time"
        className="field"
        type="time"
        required
        value={time}
        onChange={(e) => setTime(e.target.value)}
      />
      <div className="daypick" role="group" aria-label="Days">
        {DAY_LETTERS.map((d, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={days[i] === '1'}
            aria-label={DAY_NAMES[i]}
            onClick={() => toggleDay(i)}
          >
            {d}
          </button>
        ))}
      </div>

      <span className="lbl" id="aff-vibe">
        Vibe
      </span>
      <Seg
        className="vibe-seg"
        label="Vibe"
        options={VIBE_OPTIONS}
        value={vibe}
        onChange={setVibe}
      />
      <div className="sheet-preview" aria-label="Notification preview">
        <NotifCard title={preview.title} body={preview.body} />
      </div>

      <div className="row">
        {aff ? (
          <button type="button" className="btn ghost" onClick={() => onDelete(aff)}>
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
