import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createTdbApiClient } from './TdbApiClient.ts';
import App from './App.tsx';

/**
 * The service, on this page's own origin.
 *
 * The dev server proxies it to wherever the launcher started the backend, and in production
 * whatever serves these files does the same. Either way the app crosses no origin and names no
 * port — so there is nothing here to configure per environment.
 */
const apiUrl = '/api';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <MantineProvider>
      <App apiClient={createTdbApiClient(apiUrl)} />
    </MantineProvider>
  </StrictMode>,
);
