import {generate,evaluate} from './network';
import {applyTopologyAttack,applyClaims} from './attacks';
import {reward} from './rewards';
import {mechanisms,type Config,type Trial} from './types';
export function simulate(config:Config,removedId?:number):Trial{const c={...config,weights:[...config.weights]},network=generate(c);applyTopologyAttack(network,c);if(removedId!==undefined)network.providers=network.providers.filter(p=>p.id!==removedId);evaluate(network,c);applyClaims(network,c);return{seed:c.seed,config:c,network,results:mechanisms.map(m=>reward(network,c,m))}}
export function statistics(values:(number|null)[]){const a=values.filter((v):v is number=>v!==null&&Number.isFinite(v));const n=a.length;if(!n)return{n,mean:null,sd:null,low:null,high:null};const mean=a.reduce((s,v)=>s+v,0)/n;if(n<2)return{n,mean,sd:null,low:null,high:null};const sd=Math.sqrt(a.reduce((s,v)=>s+(v-mean)**2,0)/(n-1));const t=[0,12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.201,2.179,2.16,2.145,2.131,2.12,2.11,2.101,2.093,2.086,2.08,2.074,2.069,2.064,2.06,2.056,2.052,2.048,2.045,2.042][Math.min(30,n-1)];const margin=t*sd/Math.sqrt(n);return{n,mean,sd,low:mean-margin,high:mean+margin}}
