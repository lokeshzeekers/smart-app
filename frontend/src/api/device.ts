const KEY = 'smart_selected_device_id';

export function getSelectedDeviceId(): string | null {
  return localStorage.getItem(KEY);
}

export function setSelectedDeviceId(id: string | null) {
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
}
