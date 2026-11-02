import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  Clock3,
  Loader2,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { NOMINATIM_DEBOUNCE_MS } from "@/config/constants";
import { useMapContext } from "@/map/MapContext";
import { searchPlaces, type PlaceResult } from "@/services/geocoding";
import { useSettingsStore } from "@/store/settingsStore";
import type { SavedPlace } from "@/types/settings";
import { cx } from "@/utils/cx";
import { getErrorMessage, isAbortError } from "@/utils/errors";
import { ExternalLink } from "@/components/ui";

function zoomForPlace(place: PlaceResult): number {
  if (place.category === "boundary") return 8;
  if (place.type === "city" || place.type === "town") return 10;
  if (place.type === "house" || place.type === "building") return 15;
  if (place.type === "country") return 4;
  return 12;
}

function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
) {
  useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [ref, onOutside]);
}

export function SearchBox() {
  const { flyTo, showMarker } = useMapContext();
  const recentPlaces = useSettingsStore((state) => state.recentPlaces);
  const addRecentPlace = useSettingsStore((state) => state.addRecentPlace);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useOutsideClick(rootRef, () => setOpen(false));

  useEffect(() => {
    const focusSearch = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("openradar:focus-search", focusSearch);
    return () => window.removeEventListener("openradar:focus-search", focusSearch);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      searchPlaces(trimmed, controller.signal)
        .then((places) => {
          if (controller.signal.aborted) return;
          setResults(places);
          setActiveIndex(0);
          setOpen(true);
        })
        .catch((searchError: unknown) => {
          if (controller.signal.aborted || isAbortError(searchError)) return;
          setResults([]);
          setError(getErrorMessage(searchError, "Place search is unavailable."));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, NOMINATIM_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choosePlace = (place: PlaceResult) => {
    flyTo(place.longitude, place.latitude, zoomForPlace(place));
    showMarker(place.longitude, place.latitude, place.displayName);
    addRecentPlace({
      id: place.id,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setQuery(place.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  const chooseRecent = (place: SavedPlace) => {
    flyTo(place.longitude, place.latitude, 10);
    showMarker(place.longitude, place.latitude, place.name);
    setQuery(place.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      if (results.length > 0) {
        setActiveIndex((index) => (index + 1) % results.length);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (results.length > 0) {
        setActiveIndex(
          (index) => (index - 1 + results.length) % results.length,
        );
      }
      return;
    }
    if (event.key === "Enter") {
      const place = results[activeIndex] ?? results[0];
      if (place) {
        event.preventDefault();
        choosePlace(place);
      }
    }
  };

  const showRecent = open && query.trim().length < 2 && recentPlaces.length > 0;
  const showResults = open && query.trim().length >= 2;
  const showHint = open && query.trim().length === 0 && recentPlaces.length === 0;

  return (
    <div
      ref={rootRef}
      className={cx("search", open && (showResults || showRecent || showHint) && "is-open")}
    >
      <Search size={16} className="search__icon" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        className="search__input"
        value={query}
        placeholder="Search a city or place…"
        aria-label="Search for a place"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open && (showResults || showRecent)}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {loading && <Loader2 size={15} className="search__spinner spin" />}
      {!loading && query.length > 0 && (
        <button
          type="button"
          className="search__clear"
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            setResults([]);
            setError(null);
            inputRef.current?.focus();
          }}
        >
          <X size={14} />
        </button>
      )}
      {!loading && query.length === 0 && (
        <kbd className="search__kbd" aria-hidden="true">
          /
        </kbd>
      )}

      {(showResults || showRecent || showHint) && (
        <div className="search__dropdown">
          {showHint && (
            <p className="search__empty">
              Type at least 2 characters to search for a place.
            </p>
          )}

          {showRecent && !showResults && (
            <div className="search__group" id={listId} role="listbox" aria-label="Recent places">
              <p className="search__group-label">Recent places</p>
              {recentPlaces.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  className="search__result"
                  role="option"
                  aria-selected={false}
                  onClick={() => chooseRecent(place)}
                >
                  <Clock3 size={15} className="search__result-icon" />
                  <span className="search__result-text">
                    <span className="search__result-name">{place.name}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {showResults && (
            <div id={listId} role="listbox" aria-label="Search results">
              {error && <p className="search__error">{error}</p>}
              {!error && !loading && results.length === 0 && (
                <p className="search__empty">No places found.</p>
              )}
              {results.map((place, index) => (
                <button
                  key={place.id}
                  type="button"
                  id={`${listId}-${index}`}
                  className={cx(
                    "search__result",
                    index === activeIndex && "is-active",
                  )}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choosePlace(place)}
                >
                  <MapPin size={15} className="search__result-icon" />
                  <span className="search__result-text">
                    <span className="search__result-name">{place.name}</span>
                    <span className="search__result-detail">
                      {place.displayName}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="search__footer">
            Search by{" "}
            <ExternalLink href="https://nominatim.openstreetmap.org/">
              Nominatim
            </ExternalLink>{" "}
            ·{" "}
            <ExternalLink href="https://www.openstreetmap.org/copyright">
              © OpenStreetMap contributors
            </ExternalLink>
          </div>
        </div>
      )}
    </div>
  );
}
