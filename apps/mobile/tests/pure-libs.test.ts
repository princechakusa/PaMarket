// Unit tests for the app's pure logic. Run: npm test (from apps/mobile).
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatZwPhone, normalizeZwPhone } from "../lib/phone-format";
import { approxOtherCurrency, filterListings, formatMoney, formatPrice, type Listing } from "../lib/listings";
import { detectScamSignal } from "../lib/scam-signals";
import { confidentMatch, rankMatches } from "../lib/support-bot-kb";

test("normalizeZwPhone accepts every common way people type a Zimbabwe mobile", () => {
  for (const input of ["0771234567", "077 123 4567", "771234567", "+263 77 123 4567", "263771234567", "00263771234567"]) {
    assert.equal(normalizeZwPhone(input), "+263771234567", input);
  }
  assert.equal(normalizeZwPhone("0712345678"), "+263712345678"); // NetOne
  assert.equal(normalizeZwPhone("0732345678"), "+263732345678"); // Telecel
});

test("normalizeZwPhone rejects landlines, short numbers and other countries", () => {
  for (const input of ["0242123456", "07712345", "+27821234567", "", "hello"]) {
    assert.equal(normalizeZwPhone(input), null, input);
  }
});

test("formatZwPhone groups digits for display", () => {
  assert.equal(formatZwPhone("+263771234567"), "+263 77 123 4567");
});

test("formatMoney / formatPrice show $ and ZiG, never the raw code", () => {
  assert.equal(formatMoney(1200, "USD"), "$1,200");
  assert.equal(formatMoney(45.5, "USD"), "$45.5");
  assert.equal(formatMoney(32000, "ZiG"), "ZiG 32,000");
  assert.equal(formatPrice({ price: 1200, currency: "USD" }), "$1,200");
  assert.equal(formatPrice({ price: null, currency: "USD" }), "Free");
});

test("approxOtherCurrency converts both ways and skips when there's no rate", () => {
  assert.equal(approxOtherCurrency({ price: 100, currency: "USD" }, 26.63), "≈ ZiG 2,663");
  assert.equal(approxOtherCurrency({ price: 2663, currency: "ZiG" }, 26.63), "≈ $100");
  assert.equal(approxOtherCurrency({ price: 100, currency: "USD" }, null), null);
  assert.equal(approxOtherCurrency({ price: 0, currency: "USD" }, 26.63), null);
});

function listing(id: string, title: string, extra: Partial<Listing> = {}): Listing {
  return { id, title, description: "", price: 10, currency: "USD", category: "vehicles", city: "Harare", created_at: new Date().toISOString(), ...extra } as Listing;
}

test("search tolerates typos but ranks exact matches first", () => {
  const list = [listing("1", "Toyota Aqua 2015"), listing("2", "Honda Fit"), listing("3", "Toyota Hilux double cab")];
  const typo = filterListings(list, { query: "toyta" }).map((l) => l.id);
  assert.deepEqual(new Set(typo), new Set(["1", "3"]));
  const exact = filterListings(list, { query: "aqua" }).map((l) => l.id);
  assert.deepEqual(exact, ["1"]);
  assert.deepEqual(filterListings(list, { query: "bicycle" }), []);
});

test("scam signals catch the common Zimbabwe marketplace scams", () => {
  assert.equal(detectScamSignal("Please send a deposit first then I bring it"), "upfront_payment");
  assert.equal(detectScamSignal("ecocash me $20 booking fee"), "upfront_payment");
  assert.equal(detectScamSignal("send me the code you just received"), "code_request");
  assert.equal(detectScamSignal("you must pay the customs clearance fee"), "courier_fee");
  assert.equal(detectScamSignal("let's talk on telegram t.me/deal"), "off_platform");
  assert.equal(detectScamSignal("Is it still available? Can I view it on Saturday?"), null);
});

test("help bot understands Shona/Ndebele keywords and typos", () => {
  const shona = confidentMatch(rankMatches("ndakakanganwa pasiwedhi yangu"));
  assert.ok(shona?.tags.includes("forgot password"), "Shona forgot-password");
  const typo = rankMatches("how do i pst an add")[0];
  assert.ok(typo, "typo still ranks something");
  assert.equal(confidentMatch(rankMatches("zzzz qqqq")), null);
});
