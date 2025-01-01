import { Soundfont } from "smplr";
import type { InstrumentName } from "src/instrument_names";
import type { ClientData } from "src/server_bindings";

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
if (!AudioContext) {
    alert("Your browser does not seem to support the Web Audio API!");
}

const INSTRUMENT_CACHE: { [key: string]: Soundfont } = {};

// SocketClient represents a connected client and contains there own instrument and audio node map
// to allow for multiple clients to play the same note at the same time
export class SocketClient {
    stopAudioMap = new Map<string, () => void>();
    instrument?: Soundfont;
    instrumentName!: InstrumentName;
    colorHue: number;
    socketID: number;

    constructor(clientData: ClientData) {
        this.colorHue = clientData.color_hue;
        this.socketID = clientData.id;
        this.setInstrument(clientData.instrument_name as InstrumentName);
    }

    async setInstrument(instrumentName: InstrumentName) {
        this.instrumentName = instrumentName;
        this.instrument =
            INSTRUMENT_CACHE[instrumentName] ??
            new Soundfont(audioContext, { instrument: instrumentName });
    }

    stopAudio(note: string) {
        const func = this.stopAudioMap.get(note);
        if (func) {
            func();
            this.stopAudioMap.delete(note);
        }
    }

    playAudio(note: string, volume: number) {
        if (this.instrument) {
            this.stopAudio(note);
            this.stopAudioMap.set(
                note,
                this.instrument.start({
                    note,
                    velocity: Math.min(volume * 20, 127),
                }),
            );
        }
    }
}
