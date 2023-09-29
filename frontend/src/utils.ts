import * as Soundfont from "soundfont-player";
import type { InstrumentName } from "../../backend/src/instrument_names";

const AudioContext = window.AudioContext || window.webkitAudioContext;
if (!AudioContext) alert("Your browser does not seem to support the Web Audio API!");
const audioContext = new AudioContext();
const instrumentCache: { [key: string]: Promise<Soundfont.Player> } = {};

// Fetches the instrument from the instrument name while caching it
// It always returns a promise since the instrument could not be loaded yet
export function getInstrument(name: InstrumentName): Promise<Soundfont.Player> {
    if (!instrumentCache[name]) {
        instrumentCache[name] = Soundfont.instrument(audioContext, name);
    }

    return instrumentCache[name];
}
