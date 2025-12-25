import { CONFIG } from '../constants/config';

export type AuthHeaders = { [key: string]: string };

export async function patchSpace(
  spaceId: number,
  payload: Record<string, any>,
  headers?: AuthHeaders
): Promise<Response> {
  const url = `${CONFIG.API_BASE_URL}/venues/spaces/${spaceId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: JSON.stringify(payload),
  });
  return res;
}

/**
 * Remove a feature by id without resending the full features list.
 * Backend supports `features_remove_ids` for efficient deletes.
 */
export async function removeFeatureById(
  spaceId: number,
  featureId: string,
  headers?: AuthHeaders
): Promise<{ ok: boolean; status: number; data?: any; errorText?: string }> {
  const res = await patchSpace(spaceId, { features_remove_ids: [String(featureId)] }, headers);
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, errorText: text };
  }
  const data = await res.json();
  return { ok: true, status: res.status, data };
}

/**
 * Mark a feature as deleted using the payload flag.
 * Useful if your UI already sends the features array or dict.
 */
export async function markFeatureDeleted(
  spaceId: number,
  feature: any,
  headers?: AuthHeaders
): Promise<{ ok: boolean; status: number; data?: any; errorText?: string }> {
  const flagged = Array.isArray(feature)
    ? feature.map(f => ({ ...f, deleted: true }))
    : { ...(feature || {}), deleted: true };
  const payload = { features: flagged };
  const res = await patchSpace(spaceId, payload, headers);
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, errorText: text };
  }
  const data = await res.json();
  return { ok: true, status: res.status, data };
}
