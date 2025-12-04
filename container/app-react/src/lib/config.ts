// API URL - defaults to http://localhost:8000 for development
// In production, use /api (relative path that nginx will proxy)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Router basename - /react for local dual-app setup, / for production
export const ROUTER_BASENAME = import.meta.env.VITE_ROUTER_BASENAME || '/react';

export const config = {
  apiUrl: API_URL,
  routerBasename: ROUTER_BASENAME,
  appVersion: '2.0.0-beta',
  appName: 'PowerNOVA',
} as const;
