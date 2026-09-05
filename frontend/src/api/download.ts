import api from './client';

/** Fetches a file via the authenticated api client and triggers a browser
 * download. Needed because a plain <a href> can't carry the Authorization
 * header these export endpoints require. */
export async function downloadFile(url: string, fallbackFilename: string) {
  const res = await api.get(url, { responseType: 'blob' });

  const disposition: string | undefined = res.headers['content-disposition'];
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || fallbackFilename;

  const blobUrl = window.URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
