// A notification built from current data, for the vibe preview and the in-app banner.
import { buildPayload, pickAffirmation } from '../../../shared/payload';
import { fillTitle, VIBES } from '../../../shared/vibes';
import type { Affirmation, PushData, Reminder, Settings } from '../../../shared/types';
import { nextReminder } from './time';

export function makeSample(
  settings: Settings,
  affirmations: readonly Affirmation[],
  reminders: readonly Reminder[],
): PushData {
  const label = nextReminder(reminders, new Date()).reminder?.label ?? 'reminder';
  const aff = pickAffirmation(
    affirmations.filter((a) => a.active),
    null,
  );
  if (!aff) {
    return {
      affirmationId: null,
      title: fillTitle(VIBES[settings.vibe].titles[0] ?? '', settings.name, label),
      body: 'Add an affirmation to get started.',
      url: '/',
    };
  }
  return buildPayload({ vibe: settings.vibe, name: settings.name, label, affirmation: aff });
}
