import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { applyPalette, savedPalette } from './palettes.js';
import { unlockAudio } from './audio.js';

applyPalette(savedPalette());
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockAudio, { once: true }));

createRoot(document.getElementById('root')).render(<App />);
