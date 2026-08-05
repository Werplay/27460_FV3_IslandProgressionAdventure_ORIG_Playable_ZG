/// <reference types="@smoud/playable-sdk/defines" />
/// <reference types="@smoud/playable-scripts/defines" />

// The build inlines these (its asset rule covers wav/ogg/m4a) but the SDK's own defines only
// declare mp3, so importing a .wav type-checks as a missing module while building perfectly.
declare module '*.wav';
declare module '*.ogg';
declare module '*.m4a';
