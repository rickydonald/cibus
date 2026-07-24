import assert from "node:assert/strict";
import test from "node:test";
import {
    greetingName,
    normalizePersonName,
} from "../src/lib/utils/person-name.ts";

const examples = [
    ["RICKYDONALD", "Rickydonald"],
    ["Dr. S. Martin", "Martin"],
    ["Rev. Fr. Ricky", "Ricky"],
    ["Dr.Judith Vijaya J", "Judith"],
    ["Vijaya Lakshmi", "Vijaya"],
    ["SNEHA S", "Sneha"],
] as const;

for (const [input, expected] of examples) {
    test(`normalizes ${input} for the homepage greeting`, () => {
        assert.equal(greetingName(input), expected);
    });
}

test("handles stacked titles, spacing, and punctuation", () => {
    assert.equal(greetingName("  REV.   DR.   A.  MARIA  "), "Maria");
    assert.equal(greetingName("Ms, Anu"), "Anu");
});

test("preserves readable compound-name punctuation", () => {
    assert.equal(greetingName("ANNE-MARIE JOSE"), "Anne-Marie");
    assert.equal(greetingName("O'NEIL"), "O'Neil");
});

test("formats the complete parsed name using the requested casing", () => {
    const name = "Dr.JUDITH VIJAYA J";

    assert.equal(
        normalizePersonName(name, { casing: "uppercase" }),
        "JUDITH VIJAYA J",
    );
    assert.equal(
        normalizePersonName(name, { casing: "lowercase" }),
        "judith vijaya j",
    );
    assert.equal(
        normalizePersonName(name, { casing: "sentence" }),
        "Judith vijaya j",
    );
    assert.equal(
        normalizePersonName(name, { casing: "title" }),
        "Judith Vijaya J",
    );
});

test("can apply every casing mode to only the parsed given name", () => {
    const name = "Rev. Fr. John Doe";

    assert.equal(
        normalizePersonName(name, { casing: "uppercase", part: "given" }),
        "RICKY",
    );
    assert.equal(
        normalizePersonName(name, { casing: "lowercase", part: "given" }),
        "ricky",
    );
    assert.equal(
        normalizePersonName(name, { casing: "sentence", part: "given" }),
        "Ricky",
    );
    assert.equal(
        normalizePersonName(name, { casing: "title", part: "given" }),
        "Ricky",
    );
});

test("returns an empty greeting name when no usable name exists", () => {
    assert.equal(greetingName(undefined), "");
    assert.equal(greetingName("  "), "");
    assert.equal(greetingName("Dr."), "");
});
