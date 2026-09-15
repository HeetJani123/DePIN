import {applyClaims,applyTopologyAttack} from './attacks';
import {participationMetrics,prepareRound,settleRound} from './behavior';
import {generate,evaluate,geometry,type DistanceLink} from './network';
import {reward} from './rewards';
import {mechanisms,type Config,type Mechanism,type Result,type RoundRecord,type Trial} from './types';

const mean=(values:(number|null)[])=>{const valid=values.filter((v):v is number=>v!==null&&Number.isFinite(v));return valid.length?valid.reduce((s,v)=>s+v,0)/valid.length:null};

function simulateMechanism(c:Config,mechanism:Mechanism,removedId:number|undefined,exactSnapshot:boolean,onRound?:(fraction:number)=>void):Result{
  const network=generate(c);applyTopologyAttack(network,c);if(removedId!==undefined)network.providers=network.providers.filter(p=>p.id!==removedId);
  const history:RoundRecord[]=[];let last:Result|null=null,spatial:DistanceLink[][]|undefined;
  for(let round=0;round<c.rounds;round++){
    const roundConfig={...c,seed:(c.seed^Math.imul(round+1,0x85ebca6b))>>>0};
    prepareRound(network,c,mechanism,round);if(round%3===0||!spatial)spatial=geometry(network.providers,network.users);evaluate(network,roundConfig,false,spatial);applyClaims(network,roundConfig);
    last=reward(network,roundConfig,mechanism);const behavior=participationMetrics(network);last.metrics={...last.metrics,...behavior};history.push({round:round+1,metrics:{...last.metrics}});settleRound(network,c,last);onRound?.((round+1)/c.rounds);
  }
  // Keep exact leave-one-out marginal utility in the final inspectable snapshot.
  const finalConfig={...c,seed:(c.seed^Math.imul(c.rounds,0x85ebca6b))>>>0},snapshot=exactSnapshot?(evaluate(network,finalConfig,true,spatial),applyClaims(network,finalConfig),reward(network,finalConfig,mechanism)):last!;
  const keys=new Set(history.flatMap(h=>Object.keys(h.metrics)));const metrics=Object.fromEntries([...keys].map(key=>[key,mean(history.map(h=>h.metrics[key]??null))]));
  return{...snapshot,metrics,history,network};
}

export function simulate(config:Config,removedId?:number,onProgress?:(fraction:number)=>void,exactSnapshot=true):Trial{
  const c={...config,rounds:Math.max(1,Math.min(200,Math.round(config.rounds??50))),weights:[...config.weights]};
  const results=mechanisms.map((mechanism,index)=>simulateMechanism(c,mechanism,removedId,exactSnapshot,f=>onProgress?.((index+f)/mechanisms.length)));
  return{seed:c.seed,config:c,network:results.find(r=>r.mechanism==='Proposed')!.network,results};
}

export function statistics(values:(number|null)[]){const a=values.filter((v):v is number=>v!==null&&Number.isFinite(v));const n=a.length;if(!n)return{n,mean:null,sd:null,low:null,high:null};const mean=a.reduce((s,v)=>s+v,0)/n;if(n<2)return{n,mean,sd:null,low:null,high:null};const sd=Math.sqrt(a.reduce((s,v)=>s+(v-mean)**2,0)/(n-1));const t=[0,12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.201,2.179,2.16,2.145,2.131,2.12,2.11,2.101,2.093,2.086,2.08,2.074,2.069,2.064,2.06,2.056,2.052,2.048,2.045,2.042][Math.min(30,n-1)];const margin=t*sd/Math.sqrt(n);return{n,mean,sd,low:mean-margin,high:mean+margin}}
