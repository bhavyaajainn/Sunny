// A notification built from current data, for previews and the in-app banner.
import { buildPayload, pickAffirmation } from '../../../shared/payload';
import type { Affirmation, PushData, Settings } from '../../../shared/types';

export function makeSample(settings: Settings, affirmations: readonly Affirmation[]): PushData {
  const aff = pickAffirmation(
    affirmations.filter((a) => a.active),
    null,
  );
  if (!aff) {
    return {
      affirmationId: null,
      title: '☀️ Your reminder is here',
      body: 'Add an affirmation to get started.',
      vibe: 'sunny',
      url: '/',
    };
  }
  return buildPayload({ vibe: aff.vibe, name: settings.name, affirmation: aff });
}
