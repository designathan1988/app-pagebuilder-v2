// The unit tests run in English, whatever language the machine speaks: the editor opens in the browser's language
// (jornada03 J26), and Node reports the system's as navigator.languages. A test that wants another language asks for it.
Object.defineProperty(globalThis.navigator, 'languages', { value: ['en-US'], configurable: true });
Object.defineProperty(globalThis.navigator, 'language', { value: 'en-US', configurable: true });
