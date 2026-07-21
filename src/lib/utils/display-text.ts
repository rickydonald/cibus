const MINOR_WORDS = new Set([
    "a",
    "an",
    "and",
    "at",
    "by",
    "for",
    "from",
    "in",
    "of",
    "on",
    "or",
    "the",
    "to",
]);

const ACRONYMS = new Map([
    ["bbq", "BBQ"],
    ["lfc", "LFC"],
    ["ncc", "NCC"],
    ["nri", "NRI"],
    ["vip", "VIP"],
]);

const ROMAN_NUMERAL = /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)$/i;
const DISPLAY_WORD = /\p{L}+(?:'\p{L}+)*(?:-\p{L}+(?:'\p{L}+)*)*/gu;

function capitalize(value: string): string {
    const lower = value.toLocaleLowerCase("en-IN");
    return lower.replace(/^\p{L}/u, (letter) =>
        letter.toLocaleUpperCase("en-IN"),
    );
}

function formatWordPart(value: string): string {
    const lower = value.toLocaleLowerCase("en-IN");
    const acronym = ACRONYMS.get(lower);
    if (acronym) return acronym;
    if (ROMAN_NUMERAL.test(lower)) return lower.toLocaleUpperCase("en-IN");

    const mcName = lower.match(/^mc(\p{L})(.*)$/u);
    if (mcName) {
        return `Mc${mcName[1].toLocaleUpperCase("en-IN")}${mcName[2]}`;
    }

    return capitalize(lower);
}

function formatCompoundWord(value: string): string {
    return value
        .split("-")
        .map((hyphenPart) => {
            const apostropheParts = hyphenPart.split("'");
            return apostropheParts
                .map((part, index) => {
                    if (index > 0 && part.toLocaleLowerCase("en-IN") === "s") {
                        return "s";
                    }
                    return formatWordPart(part);
                })
                .join("'");
        })
        .join("-");
}

function normalizeSpacing(value: string): string {
    return value
        .normalize("NFKC")
        .replace(/[‘’`´]/g, "'")
        .replace(/[‐‑‒–—]/g, "-")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/([,;:!?])(?=\p{L})/gu, "$1 ")
        .replace(/\s*&\s*/g, " & ")
        .replace(/\s*\/\s*/g, "/")
        .replace(/\s*-\s*/g, (separator) =>
            /\s/.test(separator) ? " - " : "-",
        )
        .replace(/\s+/g, " ")
        .trim();
}

/** Formats store names and other short labels without changing their meaning. */
export function normalizeDisplayText(value: string | null | undefined): string {
    if (!value?.trim()) return "";

    const normalized = normalizeSpacing(value);
    const words = normalized.match(DISPLAY_WORD) ?? [];
    let wordIndex = 0;

    return normalized.replace(DISPLAY_WORD, (word) => {
        const index = wordIndex++;
        const lower = word.toLocaleLowerCase("en-IN");
        if (
            MINOR_WORDS.has(lower) &&
            index > 0 &&
            index < words.length - 1
        ) {
            return lower;
        }
        return formatCompoundWord(word);
    });
}

export function normalizeStoreName(value: string | null | undefined): string {
    return normalizeDisplayText(value);
}

function singularizeSourceToken(value: string): string {
    if (value.length <= 3) return value;
    if (value.endsWith("ies") && value.length > 4) {
        return `${value.slice(0, -3)}y`;
    }
    if (/(?:ches|shes|xes|zes)$/u.test(value)) return value.slice(0, -2);
    if (value.endsWith("s") && !value.endsWith("ss")) return value.slice(0, -1);
    return value;
}

function sourceFingerprint(value: string): string {
    return normalizeDisplayText(value)
        .toLocaleLowerCase("en-IN")
        .replace(/'s\b/gu, "")
        .match(/[\p{L}\p{N}]+/gu)
        ?.filter((token) => token !== "and" && token !== "the")
        .map(singularizeSourceToken)
        .join(" ") ?? "";
}

function removeMatchingSourceSuffix(value: string, aliases: string[]): string {
    const fingerprints = new Set(aliases.map(sourceFingerprint).filter(Boolean));
    if (fingerprints.has(sourceFingerprint(value))) return "";

    for (const delimiter of value.matchAll(/\s*(?:-|\/|:|\|)\s*/gu)) {
        const delimiterIndex = delimiter.index ?? 0;
        const suffix = value.slice(delimiterIndex + delimiter[0].length).trim();
        if (fingerprints.has(sourceFingerprint(suffix))) {
            return value.slice(0, delimiterIndex).trim();
        }
    }

    return value;
}

function categorySourceAliases(outletName?: string | null): string[] {
    const aliases = new Set<string>(["Yamuna's Kitchen", "Give Life"]);
    const normalizedOutlet = normalizeStoreName(outletName);
    if (normalizedOutlet) aliases.add(normalizedOutlet);

    for (const alias of [...aliases]) {
        for (const part of alias.split(/\s*(?:-|\/|:|\|)\s*/u)) {
            if (part) aliases.add(part);
        }
    }

    return [...aliases]
        .map(normalizeStoreName)
        .filter(Boolean)
        .sort((left, right) => right.length - left.length);
}

/** Removes an outlet name appended to a category by the source system. */
export function normalizeMenuCategory(
    value: string | null | undefined,
    outletName?: string | null,
): string {
    if (!value?.trim()) return "";

    let category = normalizeDisplayText(value).replace(/\bIdly\b/g, "Idli");

    category = removeMatchingSourceSuffix(
        category,
        categorySourceAliases(outletName),
    );

    return category || "Menu";
}

export function normalizeMenuLabel(value: string | null | undefined): string {
    return normalizeMenuCategory(value);
}

export function normalizeMenuItemName(value: string | null | undefined): string {
    if (!value) return "";
    return normalizeMenuLabel(value.split(/\s+-\s+/u)[0]);
}
