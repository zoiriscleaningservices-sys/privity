import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './design/light-theme.generated.css';
import './design/liquid-glass.css';
import { initAppearance } from './design/appearance';

// Apply the saved appearance (Light Liquid Glass by default) before the first paint.
initAppearance();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
