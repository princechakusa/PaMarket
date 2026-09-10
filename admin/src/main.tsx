import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
const root = document.getElementById('root');
if (!root) throw new Error('Admin root element is missing.');
createRoot(root).render(<StrictMode><App /></StrictMode>);
