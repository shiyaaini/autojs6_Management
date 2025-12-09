export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  `${window.location.protocol}//${window.location.hostname}:4000`

