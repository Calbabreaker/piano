import { InstrumentName } from "./instrument_names";

export interface IClientData {
    colorHue: number;
    socketID: string;
}

export interface IPlayNoteEvent {
    note: string;
    volume: number;
    instrumentName: InstrumentName;
    socketID?: string;
}

export interface IStopNoteEvent {
    note: string;
    sustain: boolean;
    instrumentName: InstrumentName;
    socketID?: string;
}
