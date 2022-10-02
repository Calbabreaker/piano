export interface IClientData {
    colorHue: string;
    socketID: string;
    instrumentName: string;
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
    instrumentName: string;
    socketID?: string;
}
