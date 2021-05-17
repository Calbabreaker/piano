import * as Soundfont from "soundfont-player";
import { htmlToElement, mainElm } from "./dom_utils";
import { instrumentNames } from "./instrument_names";

export class ControlPanel {
    private _sustain = false;
    private _volume = 2;
    private _octaveShift = 0;
    private _instrumentName: Soundfont.InstrumentName = "acoustic_grand_piano";

    get sustain(): boolean {
        return this._sustain;
    }

    set sustain(sustain: boolean) {
        this._sustain = sustain;
        this.sustainInput.checked = sustain;
    }

    get volume(): number {
        return this._volume;
    }

    set volume(volume: number) {
        this._volume = volume;
        this.volumeDisplay.textContent = volume.toString();
    }

    get octaveShift(): number {
        return this._octaveShift;
    }

    set octaveShift(octaveShift: number) {
        this._octaveShift = octaveShift;
        this.octaveShiftSelect.value = octaveShift.toString();
    }

    get instrumentName(): Soundfont.InstrumentName {
        return this._instrumentName;
    }

    set instrumentName(name: Soundfont.InstrumentName) {
        this._instrumentName = name;
        this.instrument = null;
        this.instrumentStatus.textContent = " Loading...";
        Soundfont.instrument(this.audioContext, name).then((ins) => {
            this.instrument = ins;
            this.instrumentStatus.textContent = "";
        });
    }

    sustainInput: HTMLInputElement;
    volumeDisplay: HTMLElement;
    octaveShiftSelect: HTMLSelectElement;
    instrumentStatus: HTMLElement;
    panel: HTMLElement;

    audioContext = new AudioContext();
    instrument: Soundfont.Player | null = null;

    constructor() {
        this.panel = htmlToElement(`<div class="control-panel"/>`);
        mainElm.appendChild(this.panel);

        const sustainControl = this.createControl("Sustain (s):");
        this.sustainInput = htmlToElement(`<input type="checkbox"></input>`) as HTMLInputElement;
        this.sustainInput.onchange = () => (this._sustain = this.sustainInput.checked);
        sustainControl.appendChild(this.sustainInput);

        const octaveShiftControl = this.createControl("Octave Shift (- ctrl, + alt): ");
        this.octaveShiftSelect = document.createElement("select");
        this.octaveShiftSelect.onchange = () =>
            (this._octaveShift = parseInt(this.octaveShiftSelect.value));
        octaveShiftControl.appendChild(this.octaveShiftSelect);
        for (let i = -3; i <= 3; i++) {
            const octaveShiftOption = htmlToElement(`<option>${i}</option>`);
            this.octaveShiftSelect.appendChild(octaveShiftOption);
        }

        const volumeControl = this.createControl("Volume: ");
        const volumeInput = htmlToElement(
            `<input type="range" min="0" max="6" step="0.01" value="${this.volume}">`
        ) as HTMLInputElement;
        volumeInput.onchange = () => (this.volume = parseFloat(volumeInput.value));
        volumeControl.appendChild(volumeInput);
        this.volumeDisplay = document.createElement("span");
        volumeControl.appendChild(this.volumeDisplay);

        const instrumentControl = this.createControl("Instrument: ");
        const instrumentSelect = document.createElement("select");
        instrumentSelect.onchange = () =>
            (this.instrumentName = instrumentSelect.value as Soundfont.InstrumentName);
        instrumentControl.appendChild(instrumentSelect);
        this.instrumentStatus = document.createElement("span");
        instrumentControl.appendChild(this.instrumentStatus);

        instrumentNames.forEach((name, i) => {
            const option = htmlToElement(`<option>${name}</option>`);
            instrumentSelect.appendChild(option);
            if (name === this._instrumentName) {
                instrumentSelect.selectedIndex = i;
            }
        });

        // call the setters
        this.sustain = this._sustain;
        this.octaveShift = this._octaveShift;
        this.volume = this._volume;
        this.instrumentName = this._instrumentName;

        window.addEventListener("keydown", (event) => {
            if (event.code === "KeyS") {
                this.sustain = !this.sustain;
            }

            let newOctaveShift = this.octaveShift;
            if (event.code === "ControlLeft") newOctaveShift -= 1;
            if (event.code === "AltLeft") newOctaveShift += 1;

            if (newOctaveShift !== this.octaveShift) {
                if (newOctaveShift < -3) newOctaveShift = 3;
                if (newOctaveShift > 3) newOctaveShift = -3;
                this.octaveShift = newOctaveShift;
            }
        });
    }

    createControl(text: string): HTMLElement {
        const control = htmlToElement(`<div><span>${text}</span></div>`);
        this.panel.appendChild(control);
        return control;
    }
}
