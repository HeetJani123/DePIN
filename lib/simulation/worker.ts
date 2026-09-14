import {simulate} from './engine';
import type {Config} from './types';
self.onmessage=(event:MessageEvent<{config:Config;removedId?:number}>)=>{try{const {config,removedId}=event.data;for(let i=0;i<config.trials;i++){const trial=simulate({...config,seed:(config.seed+i)>>>0},removedId);self.postMessage({type:'trial',trial});}self.postMessage({type:'done'});}catch(error){self.postMessage({type:'error',message:error instanceof Error?error.message:String(error)})}};
