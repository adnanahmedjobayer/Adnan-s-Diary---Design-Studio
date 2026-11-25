const DRIVE_URL_KEY = 'adnans_drive_script_url_v11';

export function getSavedDriveUrl() {
  try {
    return localStorage.getItem(DRIVE_URL_KEY) || '';
  } catch {
    return '';
  }
}

export function saveDriveUrl(url) {
  try {
    localStorage.setItem(DRIVE_URL_KEY, String(url || '').trim());
  } catch {}
}

export async function loadOwnerDbFromDrive(scriptUrl, pin) {
  const url = String(scriptUrl || '').trim();
  if (!url) throw new Error('প্রথমে Google Apps Script URL দিন');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'load', pin: String(pin || '').trim() })
  });
  const json = await res.json();
  if (!json?.ok) {
    throw new Error(json?.error || 'Drive থেকে লোড করা যায়নি');
  }
  return json.data;
}

export async function saveOwnerDbToDrive(scriptUrl, pin, payload) {
  const url = String(scriptUrl || '').trim();
  if (!url) throw new Error('প্রথমে Google Apps Script URL দিন');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'save',
      pin: String(pin || '').trim(),
      payload
    })
  });
  const json = await res.json();
  if (!json?.ok) {
    throw new Error(json?.error || 'Drive আপডেট করা যায়নি');
  }
  return json;
}
