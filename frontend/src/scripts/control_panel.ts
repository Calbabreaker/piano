import * as Soundfont from "soundfont-player";
import { htmlToElement, InstrumentCache, mainElm } from "./utils";
import { instrumentNames } from "./instrument_names";
import { MidiPlayer } from "./midi_player";
import { getNoteName, getOctave } from "./notes";
import { SocketPlayer } from "./socket_player";

export class ControlPanel {
    sustain = false;
    volume = 25;
    octaveShift = 0;
    instrumentName: Soundfont.InstrumentName = "acoustic_grand_piano";

    sustainInput: HTMLInputElement;
    volumeDisplay: HTMLElement;
    octaveShiftSelect: HTMLSelectElement;
    instrumentStatus: HTMLElement;
    playStopButton: HTMLButtonElement;
    midiFileInput: HTMLInputElement;
    panel: HTMLElement;

    audioContext = new AudioContext();
    instrument?: Soundfont.Player;
    instrumentCache = new InstrumentCache();
    midiPlayer: MidiPlayer;
    socketPlayer: SocketPlayer;
    stopAllNotesFunc: () => void;

    constructor(
        midiPlayer: MidiPlayer,
        socketPlayer: SocketPlayer,
        stopAllNotesFunc: ControlPanel["stopAllNotesFunc"]
    ) {
        this.midiPlayer = midiPlayer;
        this.stopAllNotesFunc = stopAllNotesFunc;
        this.socketPlayer = socketPlayer;
        this.panel = htmlToElement(`<div class="control-panel"/>`);
        mainElm.appendChild(this.panel);

        // sustain control
        const sustainControl = htmlToElement(`<div><span>Sustain (s): </span></div>`);
        this.panel.appendChild(sustainControl);

        this.sustainInput = htmlToElement(`<input type="checkbox"></input>`) as HTMLInputElement;
        this.sustainInput.onchange = () => (this.sustain = this.sustainInput.checked);
        sustainControl.appendChild(this.sustainInput);

        // octave shift control
        const octaveShiftControl = htmlToElement(
            `<div><span>Octave Shift (- ctrl, + alt): </span></div>`
        );
        this.panel.appendChild(octaveShiftControl);

        this.octaveShiftSelect = document.createElement("select");
        this.octaveShiftSelect.onchange = () =>
            (this.octaveShift = parseInt(this.octaveShiftSelect.value));
        octaveShiftControl.appendChild(this.octaveShiftSelect);

        for (let i = -3; i <= 3; i++) {
            const octaveShiftOption = htmlToElement(`<option>${i}</option>`);
            this.octaveShiftSelect.appendChild(octaveShiftOption);
        }

        // volume control
        const volumeControl = htmlToElement(`<div><span>Volume: </span></div>`);
        this.panel.appendChild(volumeControl);

        const volumeInput = htmlToElement(
            `<input type="range" min="0" max="50" value="${this.volume}">`
        ) as HTMLInputElement;
        volumeInput.onchange = () => this.setVolume(parseFloat(volumeInput.value));
        volumeControl.appendChild(volumeInput);

        this.volumeDisplay = document.createElement("span");
        volumeControl.appendChild(this.volumeDisplay);

        // instrument control
        const instrumentControl = htmlToElement(`<div><span>Instrument: </span></div>`);
        this.panel.appendChild(instrumentControl);

        const instrumentSelect = document.createElement("select");
        instrumentSelect.onchange = () =>
            this.setInstrumentName(instrumentSelect.value as Soundfont.InstrumentName);
        instrumentControl.appendChild(instrumentSelect);

        this.instrumentStatus = document.createElement("span");
        instrumentControl.appendChild(this.instrumentStatus);

        instrumentNames.forEach((name, i) => {
            const option = htmlToElement(`<option>${name}</option>`);
            instrumentSelect.appendChild(option);
            if (name === this.instrumentName) {
                instrumentSelect.selectedIndex = i;
            }
        });

        // midi control
        const midiControl = htmlToElement(`<div><p>Play a midi file: </p></div>`);
        this.panel.appendChild(midiControl);

        this.midiFileInput = htmlToElement(`<input type="file"/>`) as HTMLInputElement;
        this.midiFileInput.onchange = () =>
            this.midiPlayer.setMidiFile(this.midiFileInput.files?.[0]);
        midiControl.appendChild(this.midiFileInput);
        midiControl.appendChild(document.createElement("br"));

        this.playStopButton = htmlToElement(`<button>Play</button>`) as HTMLButtonElement;
        this.playStopButton.onclick = () => this.playMidi();
        midiControl.appendChild(this.playStopButton);

        const resetButton = htmlToElement(`<button>Reset</button>`);
        resetButton.onclick = () => {
            this.stopMidi();
            this.midiPlayer.reset();
        };
        midiControl.appendChild(resetButton);

        // socket multiplayer stuff
        const socketControl = htmlToElement(`<div><p>Join a room: </p></div>`);
        this.panel.appendChild(socketControl);

        const joinButton = htmlToElement(`<button>Join</button>`);
        socketControl.appendChild(joinButton);

        // call the setters
        this.setSustain(this.sustain);
        this.setOctaveShift(this.octaveShift);
        this.setVolume(this.volume);
        this.setInstrumentName(this.instrumentName);

        window.addEventListener("keydown", (event) => {
            if (event.code === "KeyS") {
                this.setSustain(!this.sustain);
            }

            let newOctaveShift = this.octaveShift;
            if (event.code === "ControlLeft") newOctaveShift -= 1;
            if (event.code === "AltLeft") newOctaveShift += 1;

            if (newOctaveShift !== this.octaveShift) {
                if (newOctaveShift < -3) newOctaveShift = 3;
                if (newOctaveShift > 3) newOctaveShift = -3;
                this.stopAllNotesFunc();
                this.setOctaveShift(newOctaveShift);
            }
        });
    }

    setSustain(sustain: boolean) {
        this.sustain = sustain;
        this.sustainInput.checked = sustain;
    }

    setVolume(volume: number) {
        this.volume = volume;
        this.volumeDisplay.textContent = volume.toString();
    }

    setOctaveShift(octaveShift: number) {
        this.octaveShift = octaveShift;
        this.octaveShiftSelect.value = octaveShift.toString();
    }

    setInstrumentName(name: Soundfont.InstrumentName) {
        this.instrumentName = name;
        this.instrument = this.instrumentCache.get(
            name,
            () => (this.instrumentStatus.textContent = " Loading..."),
            (ins) => {
                this.instrument = ins;
                this.instrumentStatus.textContent = "";
            }
        );
    }

    getShiftedNote(note: string): string {
        const octave = getOctave(note) + this.octaveShift;
        const noteReal = getNoteName(note) + octave;
        return noteReal;
    }

    playMidi() {
        this.playStopButton.textContent = "Stop";
        this.playStopButton.onclick = () => this.stopMidi();
        this.midiPlayer.resume();
    }

    stopMidi() {
        this.playStopButton.textContent = "Play";
        this.playStopButton.onclick = () => this.playMidi();
        this.midiPlayer.pause();
    }
}
