import assert from "node:assert/strict";
import test from "node:test";
import {
    normalizeDisplayText,
    normalizeMenuCategory,
    normalizeMenuLabel,
    normalizeStoreName,
} from "../src/lib/utils/display-text.ts";

test("normalizes possessives without capitalizing the s", () => {
    assert.equal(normalizeStoreName("Yamuna'S kitchen"), "Yamuna's Kitchen");
    assert.equal(normalizeStoreName("MOMO’S KITCHEN"), "Momo's Kitchen");
});

test("distinguishes possessives from apostrophes inside names", () => {
    assert.equal(normalizeStoreName("D'SOUZA'S CAFE"), "D'Souza's Cafe");
    assert.equal(normalizeStoreName("O'NEIL FOOD CORNER"), "O'Neil Food Corner");
    assert.equal(normalizeStoreName("MCDONALD'S"), "McDonald's");
});

test("handles hyphens, acronyms, Roman numerals, and connector words", () => {
    assert.equal(
        normalizeStoreName("NRI BBQ - TASTE OF INDIA II"),
        "NRI BBQ - Taste of India II",
    );
    assert.equal(normalizeStoreName("FARM-FRESH AND MORE"), "Farm-Fresh and More");
});

test("normalizes inconsistent whitespace and punctuation", () => {
    assert.equal(
        normalizeDisplayText("  fresh   juice & snacks,counter  "),
        "Fresh Juice & Snacks, Counter",
    );
});

test("removes appended source branding from menu labels", () => {
    assert.equal(normalizeMenuLabel("MILKSHAKE-GIVE LIFE"), "Milkshake");
    assert.equal(normalizeMenuLabel("IDLY - YAMUNA'S KITCHEN"), "Idli");
});

test("removes the current shop name from menu categories", () => {
    assert.equal(
        normalizeMenuCategory("Morning-Hot Chips", "HOT CHIPS"),
        "Morning",
    );
    assert.equal(
        normalizeMenuCategory("LUNCH - HOT CHIPS", "Hot Chips"),
        "Lunch",
    );
    assert.equal(
        normalizeMenuCategory("Snacks/Yamuna'S Kitchen", "YAMUNA'S KITCHEN"),
        "Snacks",
    );
});

test("removes counter aliases from compound restaurant names", () => {
    assert.equal(
        normalizeMenuCategory("Milkshake-Juice King", "Juice King-Give Life"),
        "Milkshake",
    );
    assert.equal(
        normalizeMenuCategory("Lime Spl-Juice King", "JUICE KING - GIVE LIFE"),
        "Lime Spl",
    );
    assert.equal(
        normalizeMenuCategory("Dinner/Hot Chips", "Hot Chips-Yamuna's Kitchen"),
        "Dinner",
    );
});

test("matches restaurant suffixes despite possessive and plural differences", () => {
    const cases = [
        ["MILKSHAKE-JUICE KING", "Juice Kings", "Milkshake"],
        ["FOOD-DELTA ORGANICS", "Delta's Organics", "Food"],
        ["MOMOS-YAMUNA KITCHEN", "Yamuna's Kitchen", "Momos"],
        ["BURGERS-CHENNAI SEA FOOD", "Chennai Sea Food", "Burgers"],
        ["WAFFLE-LOADED FRIES", "Loaded Fries", "Waffle"],
        ["BEVERAGES&SNACKS-GIVE LIFE", "Give Life", "Beverages & Snacks"],
    ] as const;

    for (const [category, outlet, expected] of cases) {
        assert.equal(normalizeMenuCategory(category, outlet), expected);
    }
});

test("does not remove an outlet word without a category delimiter", () => {
    assert.equal(
        normalizeMenuCategory("Fresh Juice King", "Juice King-Give Life"),
        "Fresh Juice King",
    );
});

test("uses a neutral category when the source sends only the shop name", () => {
    assert.equal(normalizeMenuCategory("HOT CHIPS", "Hot Chips"), "Menu");
});
