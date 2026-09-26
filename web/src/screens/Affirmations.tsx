import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Switch, TRASH_SVG } from '../components/bits';
import { useToast } from '../components/Toast';
import { ICON_NAMES, type IconName } from '../../../shared/icons';
import { AFFIRMATION_MAX, type Affirmation } from '../../../shared/types';
import { useStore } from '../data/store';

const QUICK_EMOJI = ['☀️', '💪', '✨', '🌻', '🔥', '🧘'];

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
          {affirmations.length} saved, {inRotation} in rotation. Tap one to edit.
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
                  aria-label={`Edit: ${a.text}`}
                >
                  {a.text}
                </button>
                <div className="side">
                  <Switch
                    checked={a.active}
                    label="Include in rotation"
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
  const { addAffirmation, updateAffirmation } = useStore();
  const toast = useToast();
  const [text, setText] = useState(aff?.text ?? '');
  const [icon, setIcon] = useState<IconName>(aff?.icon ?? defaultIcon);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => ta.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const save = async () => {
    const v = text.trim();
    if (!v) {
      ta.current?.focus();
      toast('Write a few words first, then tap Save.');
      return;
    }
    onClose();
    const ok = aff
      ? await updateAffirmation(aff.id, { text: v, icon })
      : await addAffirmation({ text: v, icon });
    if (ok) toast(aff ? 'Affirmation saved' : 'Affirmation added 🌱');
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
