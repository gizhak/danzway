export const TOUR_STEPS = [
  { id: 'welcome',   route: null,         target: null,                              tabTarget: null },
  { id: 'home',      route: '/',          target: '[data-tour="style-filter"]',      tabTarget: '[data-tour="tab-clubs"]' },
  { id: 'addVenue',  route: '/',          target: '[data-tour="add-venue-btn"]',     tabTarget: '[data-tour="tab-clubs"]' },
  { id: 'parties',   route: '/parties',   target: '[data-tour="style-filter"]',      tabTarget: '[data-tour="tab-parties"]' },
  { id: 'attend',    route: '/parties',   target: '[data-tour="attend-btn"]',        tabTarget: '[data-tour="tab-parties"]' },
  { id: 'festivals', route: '/festivals', target: '[data-tour="submit-event-btn"]',  tabTarget: '[data-tour="tab-festivals"]' },
  { id: 'saved',     route: '/saved',     target: null,                              tabTarget: '[data-tour="tab-saved"]' },
  { id: 'map',       route: '/map',       target: null,                              tabTarget: '[data-tour="tab-map"]' },
  { id: 'done',      route: null,         target: null,                              tabTarget: null },
]
