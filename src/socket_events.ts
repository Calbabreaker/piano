import { InstrumentName } from "./instrument_names";

export interface IClientData {
    colorHue: string;
    socketID: string;
    instrumentName?: InstrumentName;
}

export interface IPlayNoteEvent {
    note: string;
    volume: number;
    socketID?: string;
}

export interface IStopNoteEvent {
    note: string;
    sustain: boolean;
    socketID?: string;
}

export interface IInstrumentChangeEvent {
    instrumentName: InstrumentName;
    socketID?: string;
}
