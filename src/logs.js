import { getTheme, renderTemplate } from "./themes/index.js";

const playerName=(game,id)=>game.players?.[id]?.displayName||game.players?.[id]?.username||"Unknown";
const plain=s=>String(s||"").replaceAll("***","").replaceAll("**","").replaceAll("~~","").replaceAll("*","").replaceAll("\\.",".");

function renderBeat(game,outcome,template,index){
  const ids=outcome.actorIds||[];
  if(!template)return `${index}. [Original narration was not persisted.]`;
  if(outcome.eliminatedIds?.length){
    const victimId=outcome.eliminatedIds[0];
    if(outcome.type==="self_elimination")return `${index}. ${renderTemplate(template,{victim:playerName(game,victimId)})}`;
    const killerId=ids.find(id=>id!==victimId)||ids[0];
    return `${index}. ${renderTemplate(template,{killer:playerName(game,killerId),victim:playerName(game,victimId)})}`;
  }
  const killer=ids[0]?playerName(game,ids[0]):"Someone";
  const victim=ids[1]?playerName(game,ids[1]):killer;
  const third=ids[2]?playerName(game,ids[2]):"someone else";
  return `${index}. ${renderTemplate(template,{killer,victim,third})}`;
}

function reconstructedLog(game){
  const history=game.history||[],rounds=[];
  for(let round=1;round<=Number(game.round||0);round++){
    const entries=history.filter(x=>Number(x?.round)===round);
    const templates=entries.filter(x=>x?.type==="narration_used"&&x.narrationTemplate).map(x=>x.narrationTemplate);
    const batch=[...entries].reverse().find(x=>x?.type==="normal_round_batch");
    const brawl=[...entries].reverse().find(x=>x?.type==="mass_brawl");
    const revival=[...entries].reverse().find(x=>x?.type==="revival_pit"||x?.type==="revival_skipped");
    const crowd=[...entries].reverse().find(x=>x?.type==="crowd_pin");
    const lines=[`ROUND ${round}`];
    if(crowd){
      lines[0]+=" — CROWD PIN";
      const winner=playerName(game,crowd.survivorId),loser=playerName(game,crowd.eliminatedIds?.[0]);
      if(templates[0])lines.push(renderTemplate(templates[0],{winner,loser}));
      else lines.push("[The original Crowd Pin flavor narration was not persisted for this older match.]");
      lines.push(`ELIMINATED: ${loser}`);lines.push(`SURVIVOR: ${winner}`);
    }else if(revival){
      lines[0]+=" — REVIVAL";
      if(revival.type==="revival_skipped")lines.push("Not enough eliminated players were available for a revival.");
      else{
        const winner=playerName(game,revival.winnerId),loser=playerName(game,revival.loserId);
        lines.push(templates[0]?renderTemplate(templates[0],{winner,loser}):"[Original revival narration was not persisted.]");
        lines.push(`REVIVED: ${winner}`);lines.push(`REMAINS ELIMINATED: ${loser}`);
      }
    }else if(brawl){
      lines[0]+=" — MASS BRAWL";
      lines.push("[The exact generated Mass Brawl story was not persisted for this older match.]");
      if(brawl.eliminatedIds?.length)lines.push(`ELIMINATED: ${brawl.eliminatedIds.map(id=>playerName(game,id)).join(", ")}`);
      if(brawl.survivorIds?.length)lines.push(`SURVIVORS: ${brawl.survivorIds.map(id=>playerName(game,id)).join(", ")}`);
    }else if(batch){
      (batch.outcomes||[]).forEach((outcome,i)=>lines.push(renderBeat(game,outcome,templates[i],i+1)));
    }else lines.push("[No recoverable round narration found.]");
    rounds.push(lines.join("\n"));
  }
  return rounds.join("\n\n");
}

export function buildArenaLog(game,matchNumber=1){
  const winner=game.winnerId?playerName(game,game.winnerId):"No winner";
  const header=["FULL TILT ARENA — MATCH LOG",`Match selection: ${matchNumber} (${matchNumber===1?"latest completed":"completed matches ago: "+(matchNumber-1)})`,`Game ID: ${game.id}`,`Players: ${Object.keys(game.players||{}).length}`,`Rounds: ${game.round||0}`,`Winner: ${winner}`,""];
  const exact=Array.isArray(game.displayLog)&&game.displayLog.length;
  const body=exact?game.displayLog.map(x=>plain(x.text)).join("\n\n"):reconstructedLog(game);
  return header.join("\n")+body+`\n\nWINNER\n${winner.toUpperCase()} WINS THE ARENA.`;
}
