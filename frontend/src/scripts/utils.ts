import * as Soundfont from "soundfont-player";
import { InstrumentName } from "~/../backend/src/instrument_names";

export const mainElm = document.querySelector("main") as HTMLElement;

export function htmlToElement(html: string): HTMLElement {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstChild as HTMLElement;
}

export interface IArrayIndexUpTo<T> extends Array<T> {
    indexUpTo?: number;
}

export class InstrumentCache {
    instruments: { [key: string]: Promise<Soundfont.Player> | Soundfont.Player | undefined } = {};
    audioContext = new AudioContext();

    get(
        name: InstrumentName,
        loadStart?: () => void,
        loadEnd?: (instrument: Soundfont.Player) => void
    ): Soundfont.Player | undefined {
        const instrument = this.instruments[name];
        if (instrument !== undefined) {
            if (instrument instanceof Promise) return;
            return instrument;
        }

        const newInstrumentPromise = Soundfont.instrument(this.audioContext, name);
        this.instruments[name] = newInstrumentPromise;
        if (loadStart) loadStart();
        newInstrumentPromise
            .then((newInstrument) => {
                this.instruments[name] = newInstrument;
                if (loadEnd) loadEnd(newInstrument);
            })
            .catch(console.error);
        return;
    }
}
