import * as Soundfont from "soundfont-player";
import type { InstrumentName } from "./instrument_names";

// instrument cache
const AudioContext = window.AudioContext || window.webkitAudioContext;
if (!AudioContext) alert("Your browser does not seem to support the Web Audio API!");
const audioContext = new AudioContext();
const instrumentCache: { [key: string]: Promise<Soundfont.Player> } = {};

export function getInstrument(name: InstrumentName): Promise<Soundfont.Player> {
    if (!instrumentCache[name]) {
        instrumentCache[name] = Soundfont.instrument(audioContext, name);
    }

    return instrumentCache[name];
}
