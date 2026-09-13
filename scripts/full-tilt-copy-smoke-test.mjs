import assert from "node:assert/strict";
import { FULL_TILT_PASS_2, FULL_TILT_PASS_2_COUNT } from "../src/themes/full_tilt/full-tilt-pass-2.js";
import { getTheme, renderTemplate, themeNarrationCount } from "../src/themes/index.js";
import { arenaCommands } from "../src/discord.js";
import { SPONSOR_AWARDS, sponsorshipSummary, payoutReportText } from "../src/sponsorships.js";
import { SPONSOR_PANEL_CLIENT } from "../src/sponsor-panel-client.js";

const expectedPass = {
  playerKills: 5000,
  selfKills: 2400,
  pinDuels: 1500,
  multiPins: 1200,
  revivalDuels: 1200,
  normalEvents: 1000,
  rareEvents: 700
};

assert.equal(FULL_TILT_PASS_2_COUNT, 13000);
for (const [poolName, count] of Object.entries(expectedPass)) {
  const pool = FULL_TILT_PASS_2[poolName];
  assert.equal(pool.length, count, `${poolName} count changed`);
  assert.equal(new Set(pool).size, pool.length, `${poolName} contains duplicate generated lines`);

  for (const line of pool) {
    assert.equal(typeof line, "string");
    assert(line.trim().length > 0, `${poolName} contains a blank line`);
    assert(line.length <= 600, `${poolName} contains an overlong line (${line.length} chars)`);
    assert(!/\b(?:undefined|null|NaN)\b/i.test(line), `${poolName} contains a broken value: ${line}`);
    assert(!/ {2,}/.test(line), `${poolName} contains repeated spaces: ${line}`);
    assert(!/,,|\.\.|;;/.test(line), `${poolName} contains broken punctuation: ${line}`);
    assert(!/\b(?:as|when|while|and|before|for),\s/i.test(line), `${poolName} contains a broken connective comma: ${line}`);

    const placeholders = [...line.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
    for (const key of placeholders) {
      assert(["killer", "victim", "winner", "loser", "third"].includes(key), `${poolName} has unknown placeholder {${key}}`);
    }

    const rendered = renderTemplate(line, {
      killer: "Sam",
      victim: "Crek",
      winner: "Peach",
      loser: "Ruby",
      third: "Zero"
    });
    assert(!/\{[^}]+\}/.test(rendered), `${poolName} leaves an unreplaced placeholder: ${rendered}`);
  }
}

const fullTilt = getTheme("full_tilt");
assert.equal(themeNarrationCount(fullTilt), 26680);
assert.equal(fullTilt.playerKills.length, 12375);
assert.equal(fullTilt.selfKills.length, 4400);
assert.equal(fullTilt.pinDuels.length, 2600);
assert.equal(fullTilt.multiPins.length, 1805);
assert.equal(fullTilt.revivalDuels.length, 2300);
assert.equal(fullTilt.normalEvents.length, 2000);
assert.equal(fullTilt.rareEvents.length, 1200);
assert.equal(fullTilt.labels.arena, "FULL TILT: ALL IN");
assert.equal(fullTilt.labels.revival, "DOUBLE OR NOTHING");
assert.equal(fullTilt.labels.crowdVote, "THE DEGENS CHOOSE");
assert.equal(fullTilt.labels.crowdPin, "THE FINAL BET");

const sponsorLabels = Object.fromEntries(SPONSOR_AWARDS.map(x => [x.id, x.label]));
assert.equal(sponsorLabels.most_kills, "Most Eliminations");
assert.equal(sponsorLabels.most_showdowns, "Most Community Showdowns Survived");
assert.equal(sponsorLabels.most_mass_brawls, "Most Mass Brawls Survived");

const commands = arenaCommands();
const arena = commands.find(command => command.name === "arena");
const sponsor = arena?.options?.find(option => option.name === "sponsor");
assert(sponsor, "Discord /arena sponsor command is missing");
assert(sponsor.description.toLowerCase().includes("cash prizes"));
for (const option of sponsor.options || []) {
  assert(option.description.length <= 100, `Discord sponsor description is too long: ${option.name}`);
  if (option.name === "most_kills") assert(option.description.toLowerCase().includes("eliminations"));
}

new Function(SPONSOR_PANEL_CLIENT);
assert(SPONSOR_PANEL_CLIENT.includes("SAVE SPONSORSHIP"));
assert(SPONSOR_PANEL_CLIENT.includes("SAVING SPONSORSHIP"));
assert(SPONSOR_PANEL_CLIENT.includes("EDITABLE UNTIL THE ARENA STARTS"));

const sampleGame = {
  status: "registration",
  sponsorships: [{ sponsorId: "sam", sponsorName: "Sam", awards: { winner: 500, most_kills: 200 } }],
  players: { sam: { id: "sam", displayName: "Sam", eliminations: 2, revivals: 0, crowdPinsSurvived: 0 } },
  history: [],
  winnerId: "sam"
};
const summary = sponsorshipSummary(sampleGame);
assert(summary.includes("Sam sponsors this Arena"));
assert(summary.includes("Most Eliminations"));
sampleGame.status = "finished";
const payout = payoutReportText(sampleGame);
assert(payout.includes("SPONSORED ARENA — PAYOUT REPORT"));
assert(!payout.includes("undefined"));

console.log(`Full Tilt copy audit passed. New pass: ${FULL_TILT_PASS_2_COUNT}. Full Tilt total: ${themeNarrationCount(fullTilt)}.`);
