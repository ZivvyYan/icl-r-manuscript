'use strict';

const form = document.getElementById('unlock-form');
const status = document.getElementById('status');
const input = document.getElementById('access-key');
let currentObjectUrl;
let busy = false;

async function unlock(value) {
  if (busy) return;
  busy = true;
  const button = form.querySelector('button');
  button.disabled = true;
  status.textContent = 'Opening manuscript…';
  try {
    if (!window.isSecureContext || !crypto.subtle) {
      throw new Error('unsupported-context');
    }
    const encoded = value.trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) throw new Error('invalid-key');
    const rawKey = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
    const response = await fetch('./paper.enc', {credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer'});
    if (!response.ok) throw new Error('download-failed');
    const payload = new Uint8Array(await response.arrayBuffer());
    const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: payload.slice(0, 12)}, key, payload.slice(12));
    const header = new TextDecoder().decode(new Uint8Array(plaintext, 0, 5));
    if (header !== '%PDF-') throw new Error('not-pdf');
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(new Blob([plaintext], {type: 'application/pdf'}));
    document.getElementById('open-pdf').href = currentObjectUrl;
    document.getElementById('download-pdf').href = currentObjectUrl;
    document.getElementById('actions').hidden = false;
    const preview = document.getElementById('preview');
    preview.src = currentObjectUrl;
    preview.hidden = false;
    form.hidden = true;
    input.value = '';
    status.textContent = 'Manuscript ready. If the preview does not load, use the links below.';
  } catch (error) {
    status.textContent = error.message === 'unsupported-context'
      ? 'Please open the HTTPS sharing link in a current browser.'
      : 'Unable to open the manuscript. Please check that you have the complete private link or access key.';
    form.hidden = false;
  } finally {
    busy = false;
    button.disabled = false;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  void unlock(input.value);
});

const initialKey = new URLSearchParams(location.hash.slice(1)).get('key');
if (initialKey) {
  history.replaceState(null, '', location.pathname + location.search);
  void unlock(initialKey);
}
