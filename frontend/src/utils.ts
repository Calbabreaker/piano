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

// Thanks https://stackoverflow.com/questions/22697936/binary-search-in-javascript
export function binarySearch<T>(array: T[], compareFunc: (elm: T) => number): number {
    let left = 0;
    let right = array.length - 1;
    while (left != right) {
        const middle = Math.ceil((left + right) / 2);
        let result = compareFunc(array[middle]);
        if (result > 0) {
            right = middle - 1;
        } else {
            left = middle;
        }
    }

    return right;
}

export function swapRemove<T>(array: T[], i: number) {
    array[i] = array[array.length - 1];
    array.pop();
}

// Converts "snake_case" to "Title Case"
export function snakeToTitleCase(str: string): string {
    const words = str.split("_");
    const titleCasedWords = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1));
    return titleCasedWords.join(" ");
}
