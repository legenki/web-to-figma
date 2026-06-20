const FALLBACK: FontName = { family: "Inter", style: "Regular" };

export async function loadFontWithFallback(
  requested: FontName,
  missingFamilies: Set<string>
): Promise<FontName> {
  try {
    await figma.loadFontAsync(requested);
    return requested;
  } catch {
    missingFamilies.add(requested.family);
    await figma.loadFontAsync(FALLBACK);
    return FALLBACK;
  }
}
