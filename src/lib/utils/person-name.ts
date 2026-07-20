const HONORIFICS = new Set([
    "adv",
    "br",
    "bro",
    "brother",
    "dr",
    "er",
    "father",
    "fr",
    "miss",
    "mr",
    "mrs",
    "ms",
    "pastor",
    "prof",
    "rabbi",
    "rev",
    "sister",
    "sr",
]);

export type PersonNameCasing =
    | "uppercase"
    | "lowercase"
    | "sentence"
    | "title";

export type PersonNamePart = "full" | "given";

export type PersonNameFormat = {
    casing?: PersonNameCasing;
    part?: PersonNamePart;
    includeHonorifics?: boolean;
};

function stripTokenPunctuation(value: string): string {
    return value.replace(/^[^\p{L}]+|[^\p{L}.'’-]+$/gu, "");
}

function tokenKey(value: string): string {
    return stripTokenPunctuation(value)
        .replace(/\./g, "")
        .toLocaleLowerCase("en-IN");
}

function isHonorific(value: string): boolean {
    return HONORIFICS.has(tokenKey(value));
}

function isInitial(value: string): boolean {
    return /^\p{L}\.?$/u.test(stripTokenPunctuation(value));
}

function capitalizePart(value: string): string {
    const letters = [...value.toLocaleLowerCase("en-IN")];

    if (letters.length === 0) {
        return "";
    }

    return (
        letters[0].toLocaleUpperCase("en-IN") +
        letters.slice(1).join("")
    );
}

function titleCaseToken(value: string): string {
    const token = stripTokenPunctuation(value);

    if (isInitial(token)) {
        const letter = token.match(/\p{L}/u)?.[0] ?? "";

        return `${letter.toLocaleUpperCase("en-IN")}${token.endsWith(".") ? "." : ""
            }`;
    }

    return token
        .split(/(['’-])/u)
        .map((part) =>
            part === "'" || part === "’" || part === "-"
                ? part
                : capitalizePart(part),
        )
        .join("");
}

function parseNameTokens(fullName: string): string[] {
    return fullName
        .normalize("NFKC")
        .replace(/\.(?=\p{L})/gu, ". ")
        .trim()
        .split(/\s+/u)
        .map(stripTokenPunctuation)
        .filter(Boolean);
}

function removeLeadingHonorifics(tokens: string[]): string[] {
    const result = [...tokens];

    while (result.length > 0 && isHonorific(result[0])) {
        result.shift();
    }

    return result;
}

function getLeadingHonorifics(tokens: string[]): string[] {
    const honorifics: string[] = [];

    for (const token of tokens) {
        if (!isHonorific(token)) {
            break;
        }

        honorifics.push(token);
    }

    return honorifics;
}

function applyCasing(
    tokens: string[],
    casing: PersonNameCasing,
): string {
    if (casing === "title") {
        return tokens.map(titleCaseToken).join(" ");
    }

    const name = tokens.join(" ");

    if (casing === "uppercase") {
        return name.toLocaleUpperCase("en-IN");
    }

    const lowercaseName = name.toLocaleLowerCase("en-IN");

    if (casing === "lowercase") {
        return lowercaseName;
    }

    return lowercaseName.replace(/\p{L}/u, (letter) =>
        letter.toLocaleUpperCase("en-IN"),
    );
}

/**
 * Normalizes a person's name.
 */
export function normalizePersonName(
    fullName: string | null | undefined,
    {
        casing = "title",
        part = "full",
        includeHonorifics = false,
    }: PersonNameFormat = {},
): string {
    if (!fullName?.trim()) {
        return "";
    }

    const allTokens = parseNameTokens(fullName);

    if (allTokens.length === 0) {
        return "";
    }

    const honorificTokens = getLeadingHonorifics(allTokens);
    const nameTokens = removeLeadingHonorifics(allTokens);

    if (nameTokens.length === 0) {
        return includeHonorifics
            ? applyCasing(honorificTokens, casing)
            : "";
    }

    let selectedTokens: string[];

    if (part === "given") {
        const givenName =
            nameTokens.find((token) => !isInitial(token)) ??
            nameTokens[0];

        selectedTokens = [givenName];
    } else {
        selectedTokens = nameTokens;
    }

    if (includeHonorifics && honorificTokens.length > 0) {
        selectedTokens = [
            ...honorificTokens,
            ...selectedTokens,
        ];
    }

    return applyCasing(selectedTokens, casing);
}

/**
 * Returns the most useful given name for a compact greeting.
 */
export function greetingName(
    fullName: string | null | undefined,
    includeHonorifics = false,
): string {
    return normalizePersonName(fullName, {
        casing: "title",
        part: "given",
        includeHonorifics,
    });
}