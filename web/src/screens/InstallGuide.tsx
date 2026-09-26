import { Sun } from '../components/bits';

/** Install steps, from Settings → Install guide. */
export function InstallScreen({ onDone }: { onDone: () => void }) {
  return (
    <section className="screen onb" aria-labelledby="install-title">
      <Sun kind="bigsun" />
      <h1 className="wordmark" id="install-title">
        Sunny
      </h1>
      <p className="sub center">Your own words, sent to you through the day.</p>
      <ol className="steps">
        <li>Open this page in Safari</li>
        <li>Tap the Share button at the bottom</li>
        <li>Choose "Add to Home Screen", then open Sunny from its icon</li>
      </ol>
      <div className="spacer" />
      <button type="button" className="btn block" onClick={onDone}>
        Back to settings
      </button>
    </section>
  );
}
