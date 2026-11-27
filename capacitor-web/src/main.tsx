import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppTabs } from './shell/AppTabs';
import './styles.css';
import { TranslationSetup } from './lib/TranslationSetup';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppTabs /><TranslationSetup />
  </StrictMode>,
);
