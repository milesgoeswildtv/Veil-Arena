export function officialActivityHtml(clientId, build, clientPath) {
  const safeId = String(clientId || "").replace(/[^0-9]/g, "");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>Veil Arena</title>
<style>
:root{color-scheme:dark;--bg:#08070d;--panel:#15101d;--panel2:#21152e;--line:#3a2949;--text:#f7f4ff;--muted:#aaa1b7;--purple:#a46cff;--purple2:#d6c3ff;--danger:#ff5d7f;--good:#63e2aa}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:radial-gradient(circle at 50% -10%,#28163e 0,#0d0915 46%,#08070d 78%);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));overflow-x:hidden}.app{max-width:1050px;margin:0 auto}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.eyebrow{font:950 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;color:var(--purple2)}.title{font-size:clamp(34px,8vw,58px);font-weight:1000;line-height:.9;margin-top:6px}.status{border:1px solid #624889;background:#1b1328;color:#e0d1ff;border-radius:999px;padding:9px 12px;font:900 10px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}.connect{border:1px solid var(--line);background:linear-gradient(180deg,#171020,#100b17);border-radius:18px;padding:14px;margin-bottom:12px}.connect b{display:block;color:var(--purple2);font:950 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em}.connect strong{display:block;font-size:20px;margin:6px 0 4px}.connect p{margin:0;color:#d0c8d8;font-size:12px;line-height:1.45}.grid{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:12px}.stage,.side{border:1px solid var(--line);border-radius:22px;background:linear-gradient(180deg,#171020,#0f0b16);box-shadow:0 25px 70px rgba(0,0,0,.32)}.stage{min-height:560px;overflow:hidden;position:relative}.stageHeader{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:13px 15px;border-bottom:1px solid var(--line);background:rgba(9,6,13,.8)}.location{font-size:10px;letter-spacing:.13em;color:var(--purple2);font-weight:950}.build{font:850 9px ui-monospace,SFMono-Regular,Menlo,monospace;color:#8f849d}.content{padding:16px}.hero{border:1px solid #423057;background:linear-gradient(180deg,#21162f,#15101e);border-radius:18px;padding:16px;margin-bottom:12px}.round{font-size:10px;letter-spacing:.14em;color:var(--purple2);font-weight:950}.headline{font-size:clamp(27px,5vw,44px);font-weight:1000;line-height:.94;margin:7px 0 10px}.event{white-space:pre-wrap;line-height:1.48;color:#ddd6e6;font-size:13px;min-height:56px}.rosterTitle,.panelTitle{font-size:10px;letter-spacing:.14em;color:#bfa9dc;font-weight:950;margin:14px 0 8px}.roster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.fighter{padding:10px;border:1px solid #382a46;border-radius:11px;background:#110d17;display:flex;justify-content:space-between;gap:7px;font-size:11px;font-weight:850}.fighter.me{border-color:#8d61da}.fighter.out{opacity:.48;text-decoration:line-through}.fighter.bot:before{content:"BOT";font:800 8px ui-monospace,SFMono-Regular,Menlo,monospace;color:#b899ee;margin-right:5px}.side{padding:14px;align-self:start}.who{border:1px solid #332642;background:#0d0a12;border-radius:12px;padding:10px;margin-bottom:10px}.who b{display:block;font-size:13px}.who span{font-size:10px;color:var(--muted)}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}.stat{background:#0d0a12;border:1px solid #30243d;border-radius:10px;padding:8px}.stat b{display:block;font-size:17px}.stat span{font-size:9px;color:var(--muted)}.notice{font-size:11px;color:#c9bfd2;line-height:1.42;border:1px solid #362846;background:#100c16;border-radius:11px;padding:9px;margin:10px 0}.actions{display:grid;gap:7px}.btn{appearance:none;border:1px solid #443257;background:#251936;color:#fff;border-radius:11px;padding:11px 10px;font-weight:900;font-size:11px}.btn.primary{background:linear-gradient(135deg,#7645dc,#a55fff);border-color:#ad83ff}.btn.good{background:#133324;border-color:#2f7656}.btn.danger{background:#37131f;border-color:#7c2b45}.btn:disabled{opacity:.45}.vote{display:grid;gap:6px}.vote .btn{display:flex;justify-content:space-between}.hidden{display:none!important}.overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(5,3,8,.9);backdrop-filter:blur(8px);z-index:20}.overlay.show{display:flex}.fx{text-align:center;max-width:650px}.fxTitle{font-size:clamp(38px,8vw,74px);font-weight:1000;line-height:.88;margin-bottom:12px}.fxText{white-space:pre-wrap;color:#d4ccd9;line-height:1.45}@media(max-width:780px){.grid{grid-template-columns:1fr}.side{order:-1}.stage{min-height:500px}.roster{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:430px){.top{flex-direction:column}.roster{grid-template-columns:1fr}.content{padding:12px}}
</style>
</head>
<body data-discord-client-id="${safeId}" data-activity-build="${build}">
<div class="app">
  <div class="top"><div><div class="eyebrow" id="brand">VEIL // DISCORD ACTIVITY</div><div class="title">ARENA</div></div><div class="status" id="status">BOOTING</div></div>
  <div class="connect"><b id="step">DISCORD SDK STARTING</b><strong id="channel">VOICE CHANNEL // CONNECTING</strong><p id="detail">Starting Discord's official Activity flow.</p></div>
  <div class="grid">
    <section class="stage">
      <div class="stageHeader"><div class="location">ARENA // LIVE</div><div class="build">BUILD ${build}</div></div>
      <div class="content">
        <div class="hero"><div class="round" id="round">ARENA READY</div><div class="headline" id="headline">CONNECTING…</div><div class="event" id="event">Waiting for Discord authorization.</div></div>
        <div class="rosterTitle">LIVE ROSTER</div><div class="roster" id="roster"><div class="fighter"><span>Connecting…</span><b>—</b></div></div>
      </div>
      <div class="overlay" id="overlay"><div class="fx"><div class="fxTitle" id="fxTitle"></div><div class="fxText" id="fxText"></div></div></div>
    </section>
    <aside class="side">
      <div class="who"><b id="viewer">Connecting…</b><span>Discord Activity user</span></div>
      <div class="meta"><div class="stat"><b id="players">0</b><span>PLAYERS</span></div><div class="stat"><b id="alive">0</b><span>ALIVE</span></div></div>
      <div class="notice" id="notice">Veil is establishing the Activity session.</div>
      <div class="actions" id="actions"></div>
      <div id="voteWrap" class="hidden"><div class="panelTitle">COMMUNITY SHOWDOWN // VOTE</div><div class="vote" id="vote"></div></div>
    </aside>
  </div>
</div>
<script src="${clientPath}"></script>
</body>
</html>`;
}
