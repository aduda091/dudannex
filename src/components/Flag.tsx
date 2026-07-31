import { COUNTRY_BY_ID } from '../game/engine';

/**
 * A country's flag, drawn from `public/flags/`. Two countries on the map are
 * de-facto states with no ISO code and no flag image; they render nothing
 * rather than a placeholder that could be mistaken for a real flag.
 *
 * `BASE_URL` matters: the site is served from a sub-path on GitHub Pages, so a
 * hardcoded `/flags/...` would 404 everywhere except a local dev server.
 */
export function Flag({
  countryId,
  height = 14,
  title,
}: {
  countryId: string;
  /** Rendered height in pixels. Width follows the flag's own proportions. */
  height?: number;
  title?: string;
}) {
  const country = COUNTRY_BY_ID.get(countryId);
  if (!country?.iso2) return null;

  return (
    <img
      className="flag"
      src={`${import.meta.env.BASE_URL}flags/${country.iso2}.png`}
      alt=""
      title={title ?? country.name}
      // Height is fixed and width follows the source, because flags are not a
      // common shape: Croatia is 2:1, Brazil 10:7, Switzerland square. Forcing
      // them all into one box either crops or stretches them, which is exactly
      // the wrong thing to teach.
      style={{ height, width: 'auto' }}
      // Deliberately not lazy: these are 1-3kB, and lazy loading skips images
      // that are inside a closed drawer or below the fold in a list, which is
      // most of where flags appear here.
      decoding="async"
    />
  );
}
