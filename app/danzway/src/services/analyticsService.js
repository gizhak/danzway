import { logEvent } from 'firebase/analytics';
import { analytics } from './firebase';

function track(eventName, params = {}) {
  if (!analytics) return;
  try {
    logEvent(analytics, eventName, params);
  } catch (e) {
    console.warn('[Analytics]', eventName, e);
  }
}

// ── Map ───────────────────────────────────────────────────────────────────────

export const trackVenueClick = (venueName, placeId) =>
  track('venue_click', { venue_name: venueName, place_id: placeId });

// ── Scans ─────────────────────────────────────────────────────────────────────

export const trackVenueScan   = (venueCount) =>
  track('venue_scan_triggered',    { venue_count: venueCount });

export const trackFacebookScan = () =>
  track('facebook_scan_triggered', { group: 'bachataisrael' });

// ── Navigation / tabs ─────────────────────────────────────────────────────────

export const trackPageView = (path, title = '') =>
  track('page_view', { page_path: path, page_title: title });
