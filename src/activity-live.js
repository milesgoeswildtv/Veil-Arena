export function liveActivityHtml(clientId = "") {
  const safeClientId = String(clientId || "").replace(/[^0-9]/g, "");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>Veil Arena</title>
<style>
:root{color-scheme:dark;--bg:#08070d;--panel:#15101d;--panel2:#20172b;--line:#382a46;--text:#f7f4ff;--muted:#aaa1b7;--purple:#9864ff;--purple2:#d3c0ff;--danger:#ff5379;--good:#62e7aa;--amber:#ffc766}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:radial-gradient(circle at 50% -10%,#25143b 0,#0d0915 45%,#08070d 78%);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));overflow-x:hidden}.app{max-width:1100px;margin:0 auto}.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin-bottom:12px}.eyebrow{font:950 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;color:var(--purple2)}.title{font-size:clamp(29px,5vw,50px);font-weight:1000;line-height:.92;margin-top:6px}.badge{border:1px solid #59427c;background:#1b1328;color:#d8c7ff;border-radius:99px;padding:8px 11px;font:900 10px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}.grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px}.stage,.side{border:1px solid var(--line);border-radius:22px;background:linear-gradient(180deg,#171020,#0f0b16);box-shadow:0 25px 70px rgba(0,0,0,.34)}.stage{min-height:600px;overflow:hidden;position:relative}.stage.lockdown{animation:shake .16s 4;box-shadow:inset 0 0 0 2px rgba(255,83,121,.25),0 25px 70px rgba(0,0,0,.34)}.stage.finalfive{box-shadow:inset 0 0 0 2px #8156a5,0 25px 70px rgba(0,0,0,.34)}.stageHeader{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line);background:rgba(10,7,14,.82)}.location{font-size:10px;letter-spacing:.15em;color:var(--purple2);font-weight:950}.status{font:850 10px ui-monospace,SFMono-Regular,Menlo,monospace;color:#91869e}.content{padding:18px}.hero{border:1px solid #422f57;background:linear-gradient(180deg,#21162f,#15101e);border-radius:20px;padding:18px;margin-bottom:12px}.round{font-size:10px;letter-spacing:.14em;color:var(--purple2);font-weight:950}.headline{font-size:clamp(25px,4vw,42px);font-weight:1000;line-height:.96;margin:7px 0 10px}.event{white-space:pre-wrap;line-height:1.48;color:#ddd6e6;font-size:13px;min-height:70px}.rosterTitle,.panelTitle{font-size:10px;letter-spacing:.15em;color:#bfa9dc;font-weight:950;margin:15px 0 8px}.roster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.fighter{padding:10px;border:1px solid #382a46;border-radius:11px;background:#110d17;display:flex;justify-content:space-between;gap:7px;font-size:11px;font-weight:850}.fighter.me{border-color:#8d61da;box-shadow:0 0 20px rgba(152,100,255,.13)}.fighter.out{opacity:.48;text-decoration:line-through}.fighter.bot:before{content:"BOT";font:800 8px ui-monospace,SFMono-Regular,Menlo,monospace;color:#b899ee;margin-right:5px}.side{padding:14px;align-self:start;position:sticky;top:10px}.who{border:1px solid #332642;background:#0d0a12;border-radius:12px;padding:10px;margin-bottom:10px}.who b{display:block;font-size:13px}.who span{font-size:10px;color:var(--muted)}.actions{display:grid;gap:7px}.actions.two{grid-template-columns:1fr 1fr}.btn{appearance:none;border:1px solid #443257;background:#251936;color:#fff;border-radius:11px;padding:11px 10px;font-weight:900;font-size:11px;cursor:pointer}.btn.primary{background:linear-gradient(135deg,#7645dc,#a55fff);border-color:#ad83ff}.btn.good{background:#133324;border-color:#2f7656}.btn.danger{background:#37131f;border-color:#7c2b45}.btn:disabled{opacity:.45}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}.stat{background:#0d0a12;border:1px solid #30243d;border-radius:10px;padding:8px}.stat b{display:block;font-size:16px}.stat span{font-size:9px;color:var(--muted)}.notice{font-size:11px;color:#c9bfd2;line-height:1.42;border:1px solid #362846;background:#100c16;border-radius:11px;padding:9px;margin:10px 0}.error{color:#ff9db4}.vote{display:grid;gap:6px;max-height:250px;overflow:auto}.vote button{display:flex;justify-content:space-between;align-items:center}.overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(5,3,8,.88);backdrop-filter:blur(8px);z-index:20}.overlay.show{display:flex}.fx{text-align:center;max-width:680px}.fxKicker{font:950 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.2em;color:var(--purple2)}.fxTitle{font-size:clamp(38px,8vw,78px);font-weight:1000;line-height:.86;margin:11px 0}.fxSub{white-space:pre-wrap;color:#cbc3d3;line-height:1.45}.spinner{width:24px;height:24px;border:3px solid #392a49;border-top-color:#a675ff;border-radius:50%;animation:spin .8s linear infinite;margin:18px auto}.hidden{display:none!important}@keyframes spin{to{transform:rotate(360deg)}}@keyframes shake{25%{transform:translate(6px,-2px)}50%{transform:translate(-5px,3px)}75%{transform:translate(4px,1px)}}
@media(max-width:780px){.grid{grid-template-columns:1fr}.side{position:relative;top:0;order:-1}.stage{min-height:540px}.roster{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:430px){.top{align-items:flex-start;flex-direction:column}.roster{grid-template-columns:1fr}.content{padding:12px}}
</style>
</head>
<body data-discord-client-id="${safeClientId}">
<div class="app">
  <div class="top"><div><div class="eyebrow" id="brand">VEIL // DISCORD ACTIVITY</div><div class="title" id="title">ARENA</div></div><div class="badge" id="connection">CONNECTING TO DISCORD</div></div>
  <div class="grid">
    <section class="stage" id="stage">
      <div class="stageHeader"><div class="location" id="location">VOICE CHANNEL // CONNECTING</div><div class="status" id="system">AUTHENTICATING</div></div>
      <div class="content">
        <div class="hero"><div class="round" id="round">ARENA OFFLINE</div><div class="headline" id="headline">CONNECTING...</div><div class="event" id="event"><div class="spinner"></div></div></div>
        <div class="rosterTitle">LIVE ROSTER</div><div class="roster" id="roster"></div>
      </div>
      <div class="overlay" id="overlay"><div class="fx"><div class="fxKicker" id="fxKicker"></div><div class="fxTitle" id="fxTitle"></div><div class="fxSub" id="fxSub"></div></div></div>
    </section>
    <aside class="side">
      <div class="who"><b id="viewerName">Connecting…</b><span id="viewerStatus">Discord authorization</span></div>
      <div class="meta"><div class="stat"><b id="playerCount">0</b><span>PLAYERS</span></div><div class="stat"><b id="aliveCount">0</b><span>ALIVE</span></div></div>
      <div class="notice" id="notice">The Activity is connecting to the Arena engine.</div>
      <div class="actions" id="actions"></div>
      <div id="votePanel" class="hidden"><div class="panelTitle">COMMUNITY SHOWDOWN // VOTE</div><div class="vote" id="vote"></div></div>
    </aside>
  </div>
</div>
<script type="module" src="/activity/live.js"></script>
</body>
</html>`;
}
