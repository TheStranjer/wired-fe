/**
 * Entry point: load the theme and mount <App /> into #root. Nothing else
 * belongs here.
 */
import '../theme/tokens.css';
import '../theme/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('index.html has no #root element');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
