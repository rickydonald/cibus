import { browser } from "$app/environment";

const PROFILE_STORAGE_KEY = "kairos:eatright:profile";

export type CachedEatRightProfile = {
  name: string;
  deptNo: string;
};

export function parseEatRightProfile(user: string | undefined): CachedEatRightProfile | null {
  if (!user) return null;

  const match = user.match(/^(.*?)\((.*?)\)$/);
  if (!match) {
    const name = user.trim();
    return name ? { name, deptNo: "" } : null;
  }

  return {
    name: match[1].trim(),
    deptNo: match[2].trim(),
  };
}

export function getCachedEatRightProfile(): CachedEatRightProfile | null {
  if (!browser) return null;

  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;

    const profile = JSON.parse(raw) as Partial<CachedEatRightProfile>;
    if (!profile.name) return null;

    return {
      name: profile.name,
      deptNo: profile.deptNo ?? "",
    };
  } catch {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    return null;
  }
}

export function cacheEatRightProfileFromUser(
  user: string | undefined,
): CachedEatRightProfile | null {
  const profile = parseEatRightProfile(user);
  if (!browser || !profile) return profile;

  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

export function clearCachedEatRightProfile() {
  if (!browser) return;
  localStorage.removeItem(PROFILE_STORAGE_KEY);
}
