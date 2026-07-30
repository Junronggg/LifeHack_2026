import ReactGA from "react-ga4";

export function initializeAnalytics() {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

  // Keep local development and builds without a configured GA4 property clean.
  if (!import.meta.env.PROD || !measurementId) return;

  ReactGA.initialize(measurementId);
  ReactGA.send({
    hitType: "pageview",
    page: `${window.location.pathname}${window.location.search}`,
    title: document.title,
  });
}
