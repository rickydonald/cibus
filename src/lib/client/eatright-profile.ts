import { browser } from "$app/environment";

const PROFILE_STORAGE_KEY = "kairos:eatright:profile";

export type CachedEatRightProfile = {
  name: string;
  userid: string;
};

export function getCachedEatRightProfile(): CachedEatRightProfile | null {
  if (!browser) return null;

  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;

    const profile = JSON.parse(raw) as Partial<CachedEatRightProfile>;
    if (!profile.name) return null;

    return {
      name: profile.name,
      userid: profile.userid ?? "",
    };
  } catch {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    return null;
  }
}

export function cacheEatRightProfile(
  name: string | undefined,
  userid: string | undefined,
): CachedEatRightProfile | null {
  const trimmedName = name?.trim();
  if (!trimmedName) return null;

  const profile: CachedEatRightProfile = {
    name: trimmedName,
    userid: userid?.trim() ?? "",
  };

  if (browser) {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }
  return profile;
}

export function clearCachedEatRightProfile() {
  if (!browser) return;
  localStorage.removeItem(PROFILE_STORAGE_KEY);
}
