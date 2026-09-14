import vinext from 'vinext';
import {defineConfig} from 'vite';
// Pure static research application: no Worker runtime or database bindings.
export default defineConfig({plugins:[vinext()]});
