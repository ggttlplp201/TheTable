import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initializeDisplaySettings } from './display-settings';
import './styles.css';
import './desktop-fidelity.css';
import './audit-fixes.css';
import './ui-polish.css';

initializeDisplaySettings();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
