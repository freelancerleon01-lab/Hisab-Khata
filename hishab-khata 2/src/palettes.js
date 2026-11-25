export const PALETTES = [
  { id: 'ocean', label: 'সাগর', swatch: '#0f7b74' },
  { id: 'blue', label: 'আকাশি', swatch: '#2f5fd0' },
  { id: 'green', label: 'সবুজ', swatch: '#2e7d4f' },
  { id: 'violet', label: 'বেগুনি', swatch: '#6a4fc2' },
  { id: 'sunset', label: 'সূর্যাস্ত', swatch: 'linear-gradient(135deg,#f5a03c,#d6402f)' },
  { id: 'rose', label: 'গোলাপি', swatch: 'linear-gradient(135deg,#d6568a,#a83a74)' }
];

export function applyPalette(id) {
  const el = document.documentElement;
  if (!id || id === 'ocean') el.removeAttribute('data-p');
  else el.setAttribute('data-p', id);
  try { localStorage.setItem('hk_palette', id || 'ocean'); } catch { /* ignore */ }
}

export const savedPalette = () => {
  try { return localStorage.getItem('hk_palette'); } catch { return null; }
};
