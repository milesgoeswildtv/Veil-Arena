const NORMAL_ROOMS = [
  "In Vibe Queen's Lair hallway,","Under the dead arcade lights,","Beside the basement door,","Inside the security office,","Near the motel-style ice machine,","At the abandoned nursery entrance,","Inside the fogged parking garage,","By the old service elevator,","Under the flickering EXIT sign,","Inside the boarded-up kitchen"
];
const NORMAL_OMENS = [
  "the lights flicker twice as","a disconnected phone starts ringing while","a mannequin turns its head when","the security monitors lag ten seconds behind as","something knocks from inside the wall while","the elevator dings from a floor that doesn't exist as","wet footprints appear between them while","a child's laugh comes through the ceiling as","the mirror fogs from the inside while","the PA whispers one of their names as","an unplugged slot cabinet powers on as","a shadow crosses the ceiling without a source while","the EXIT sign points the wrong direction as","a door slowly closes by itself while","the room temperature drops hard as"
];
const NORMAL_ACTIONS = [
  "{killer} rushes {victim}, but both stay in the Arena","{killer} shoves {victim} toward the darkness and {victim} barely hangs on","{killer} swings at {victim} while both pretend they did not hear that shit","{killer} corners {victim} beside the wrong door, but nobody gets eliminated","{killer} drives {victim} backward until the hallway stretches again","{killer} attacks {victim} as the lights cut out for half a second","{killer} tries to use the haunted-room chaos against {victim}, but the plan falls apart","{killer} sends {victim} stumbling into a mirror and both survive","{killer} nearly forces {victim} through the basement door before it slams shut","{killer} catches {victim} looking at the security feed and almost gets the elimination"
];
const NORMAL_ENDINGS = [
  "Both survive. The house seems annoyed.","No elimination. Something in the walls sounds disappointed.","Everybody stays in. The hallway gets longer anyway.","No kill. The Lair keeps watching.","Both remain alive in the match, unfortunately for their nerves.","The Arena continues. The disconnected phone does not stop ringing.","Nobody leaves. The mirror now shows one extra person.","No elimination. The house quietly locks another door.","Both stay in action. The security footage loses several seconds.","Nothing settles. The lights flicker again."
];

const RARE_SETUPS = [
  "Every security monitor suddenly shows tomorrow's round and","A slot cabinet with no power displays a contestant's exact username while","The elevator opens onto a room that is definitely not part of the building and","Every mirror in the Lair shows the same unknown person standing behind them while","The casino PA calmly announces a contestant as ALREADY ELIMINATED and","A child's handprint appears on the ceiling and","The EXIT sign changes to STAY and","The guest book opens itself to a page dated tomorrow and","The lights go fully black except for one red bulb over","Every locked door in the hallway clicks open at once as"
];
const RARE_ACTIONS = [
  "{killer} and {victim} both stop fighting because what the fuck","{victim} points at it and {killer} immediately decides this is not worth investigating","{killer} tries to use the distraction against {victim} and almost gets grabbed by something else","{killer} shoves {victim}, then both freeze when a third set of footsteps starts running toward them","{victim} backs away from the omen while {killer} refuses to turn around","{killer} and {victim} sprint in opposite directions without discussing it","{killer} swings at {victim} and accidentally hits something neither of them can see","{victim} ducks and {killer} watches their own reflection keep moving","{killer} tries to finish {victim} before the lights return and fails","{killer} and {victim} both hear their own voices coming from the next room"
];
const RARE_ENDINGS = [
  "Nobody is eliminated. This is somehow worse.","Both survive. The Lair refuses to explain itself.","No kill. Premium haunted bullshit achieved.","Action resumes after several deeply uncomfortable seconds.","Nobody leaves the Arena, but something else definitely entered it."
];

function combine3(a,b,c){const out=[];for(const x of a)for(const y of b)for(const z of c)out.push(`${x} ${y} ${z}.`);return out}
export const VQS_NORMAL_RARE = {
  normalEvents: combine3(NORMAL_ROOMS,NORMAL_OMENS,NORMAL_ACTIONS).map((x,i)=>`${x} ${NORMAL_ENDINGS[i%NORMAL_ENDINGS.length]}`), // 1,500
  rareEvents: combine3(RARE_SETUPS,RARE_ACTIONS,RARE_ENDINGS) // 500
};
export const VQS_NORMAL_RARE_COUNT = VQS_NORMAL_RARE.normalEvents.length + VQS_NORMAL_RARE.rareEvents.length;
