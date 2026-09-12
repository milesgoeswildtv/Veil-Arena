export const SPONSOR_AWARDS = [
  { id: "winner", label: "Winner" },
  { id: "runner_up", label: "Runner-Up" },
  { id: "most_kills", label: "Most Eliminations" },
  { id: "most_revivals", label: "Most Revivals" },
  { id: "most_showdowns", label: "Most Community Showdowns Survived" },
  { id: "most_mass_brawls", label: "Most Mass Brawls Survived" }
];

const AWARD_IDS = new Set(SPONSOR_AWARDS.map(x => x.id));

export function money(cents) {
  return `$${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
}

export function dollarsToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(1_000_000_00, Math.round(amount * 100));
}

export function normalizeSponsorAwards(raw = {}) {
  const out = {};
  for (const [id, value] of Object.entries(raw || {})) {
    if (!AWARD_IDS.has(id)) continue;
    const cents = Number.isInteger(value) ? Math.max(0, value) : dollarsToCents(value);
    if (cents > 0) out[id] = cents;
  }
  return out;
}

export function upsertSponsorship(game, sponsor, rawAwards) {
  if (game.status !== "registration") throw new Error("Sponsorships lock when the Arena starts.");
  const awards = normalizeSponsorAwards(rawAwards);
  if (!Object.keys(awards).length) throw new Error("Enter at least one sponsorship amount above $0.");
  if (!Array.isArray(game.sponsorships)) game.sponsorships = [];
  const existing = game.sponsorships.find(x => String(x.sponsorId) === String(sponsor.id));
  const record = {
    sponsorId: String(sponsor.id),
    sponsorName: sponsor.displayName || sponsor.username || "Sponsor",
    awards,
    updatedAt: new Date().toISOString()
  };
  if (existing) Object.assign(existing, record);
  else game.sponsorships.push(record);
  return record;
}

export function sponsorshipSummary(game) {
  const sponsorships = Array.isArray(game?.sponsorships) ? game.sponsorships : [];
  if (!sponsorships.length) return "";
  const labels = Object.fromEntries(SPONSOR_AWARDS.map(x => [x.id, x.label]));
  return sponsorships.map(s => {
    const lines = Object.entries(s.awards || {}).map(([id, cents]) => `• ${labels[id] || id}: **${money(cents)}**`);
    return `💸 **${s.sponsorName} sponsors this Arena**\n${lines.join("\n")}`;
  }).join("\n\n");
}

function statWinners(game, getter) {
  const players = Object.values(game.players || {});
  const scored = players.map(p => ({ id: p.id, value: Number(getter(p)) || 0 }));
  const max = Math.max(0, ...scored.map(x => x.value));
  if (max <= 0) return [];
  return scored.filter(x => x.value === max).map(x => x.id);
}

function runnerUp(game) {
  const winnerId = game.winnerId;
  const eliminated = [...(game.history || [])].reverse().find(x => x?.type === "elimination" && x.playerId !== winnerId && !game.players?.[x.playerId]?.alive);
  return eliminated?.playerId ? [eliminated.playerId] : [];
}

function massBrawlWinners(game) {
  const counts = new Map();
  for (const event of game.history || []) {
    if (event?.type !== "mass_brawl") continue;
    for (const id of event.survivorIds || []) counts.set(id, (counts.get(id) || 0) + 1);
  }
  const max = Math.max(0, ...counts.values());
  if (!max) return [];
  return [...counts.entries()].filter(([, value]) => value === max).map(([id]) => id);
}

export function awardRecipients(game, awardId) {
  if (awardId === "winner") return game.winnerId ? [game.winnerId] : [];
  if (awardId === "runner_up") return runnerUp(game);
  if (awardId === "most_kills") return statWinners(game, p => p.eliminations);
  if (awardId === "most_revivals") return statWinners(game, p => p.revivals);
  if (awardId === "most_showdowns") return statWinners(game, p => p.crowdPinsSurvived);
  if (awardId === "most_mass_brawls") return massBrawlWinners(game);
  return [];
}

export function calculatePayouts(game) {
  const sponsorships = Array.isArray(game?.sponsorships) ? game.sponsorships : [];
  const labels = Object.fromEntries(SPONSOR_AWARDS.map(x => [x.id, x.label]));
  const awards = [];
  const totals = new Map();
  for (const sponsor of sponsorships) {
    for (const [awardId, cents] of Object.entries(sponsor.awards || {})) {
      const recipientIds = awardRecipients(game, awardId);
      if (!recipientIds.length) {
        awards.push({ sponsorId: sponsor.sponsorId, sponsorName: sponsor.sponsorName, awardId, label: labels[awardId] || awardId, cents, recipientIds: [], shares: [] });
        continue;
      }
      const base = Math.floor(cents / recipientIds.length);
      let remainder = cents - base * recipientIds.length;
      const shares = recipientIds.map(id => {
        const share = base + (remainder-- > 0 ? 1 : 0);
        totals.set(id, (totals.get(id) || 0) + share);
        return { playerId: id, cents: share };
      });
      awards.push({ sponsorId: sponsor.sponsorId, sponsorName: sponsor.sponsorName, awardId, label: labels[awardId] || awardId, cents, recipientIds, shares });
    }
  }
  return { awards, totals: Object.fromEntries(totals) };
}

export function payoutReportText(game) {
  const result = calculatePayouts(game);
  if (!result.awards.length) return "";
  const lines = ["# 💸 SPONSORED ARENA — PAYOUT REPORT"];
  for (const award of result.awards) {
    if (!award.shares.length) {
      lines.push(`**${award.sponsorName} — ${award.label}: ${money(award.cents)}**\nNo qualifying player — no payout owed.`);
      continue;
    }
    const recipients = award.shares.map(share => {
      const p = game.players?.[share.playerId];
      return `**${p?.displayName || "Unknown"}** — ${money(share.cents)}`;
    }).join(", ");
    lines.push(`**${award.sponsorName} — ${award.label}: ${money(award.cents)}**\n${recipients}`);
  }
  return lines.join("\n\n");
}
