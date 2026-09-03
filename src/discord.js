const DISCORD_API="https://discord.com/api/v10";
export const InteractionType={PING:1,APPLICATION_COMMAND:2,MESSAGE_COMPONENT:3};export const InteractionResponseType={PONG:1,CHANNEL_MESSAGE_WITH_SOURCE:4,DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE:5,DEFERRED_UPDATE_MESSAGE:6,UPDATE_MESSAGE:7};
function hexToBytes(hex){const out=new Uint8Array(hex.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(hex.slice(i*2,i*2+2),16);return out;}
export async function verifyDiscordRequest(request,keyHex,raw){if(!keyHex)return false;const sig=request.headers.get("x-signature-ed25519"),ts=request.headers.get("x-signature-timestamp");if(!sig||!ts)return false;try{const key=await crypto.subtle.importKey("raw",hexToBytes(keyHex),{name:"Ed25519"},false,["verify"]);return await crypto.subtle.verify("Ed25519",key,hexToBytes(sig),new TextEncoder().encode(ts+raw));}catch{return false;}}
export function jsonResponse(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8"}});}
export function interactionMessage(content,components=[],ephemeral=false,embeds=[]){return jsonResponse({type:4,data:{content,components,embeds,flags:ephemeral?64:0,allowed_mentions:{parse:[]}}});}
export function interactionUpdate(content,components=[],embeds=[]){return jsonResponse({type:7,data:{content,components,embeds,allowed_mentions:{parse:[]}}});}
export function button(customId,label,style=2,disabled=false,emoji=null){const c={type:2,custom_id:customId,label,style,disabled};if(emoji)c.emoji={name:emoji};return c;}export function actionRow(...components){return{type:1,components};}
export function userFromInteraction(i){const m=i.member,u=m?.user||i.user;if(!u)return null;return{id:u.id,username:u.username,displayName:m?.nick||u.global_name||u.username,avatarUrl:u.avatar?`https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`:null};}
export async function discordRequest(path,token,init={}){if(!token)throw new Error("DISCORD_BOT_TOKEN is not configured.");const r=await fetch(`${DISCORD_API}${path}`,{...init,headers:{authorization:`Bot ${token}`,"content-type":"application/json",...(init.headers||{})}});if(!r.ok){const t=await r.text();throw new Error(`Discord API ${r.status}: ${t}`);}return r.status===204?null:r.json();}
export async function createChannelMessage(channelId,token,payload){return discordRequest(`/channels/${channelId}/messages`,token,{method:"POST",body:JSON.stringify({...payload,allowed_mentions:{parse:[]}})});}
export async function deleteChannelMessage(channelId,messageId,token){if(!messageId)return;try{await discordRequest(`/channels/${channelId}/messages/${messageId}`,token,{method:"DELETE"});}catch(error){console.warn("Arena cleanup could not delete message",messageId,error?.message||error);}}
export function arenaCommands(){return[
  {name:"arena",description:"Enter the Arena.",type:1,options:[
    {name:"start",description:"Open Arena registration.",type:1},
    {name:"rules",description:"Show the Arena rules for 30 seconds.",type:1}
  ]},
  {name:"arenastats",description:"View your lifetime Arena stats in this server.",type:1},
  {name:"arenaleaderboard",description:"View the Arena leaderboard for this server.",type:1}
];}
export async function registerGuildCommands(appId,guildId,token){return discordRequest(`/applications/${appId}/guilds/${guildId}/commands`,token,{method:"PUT",body:JSON.stringify(arenaCommands())});}
