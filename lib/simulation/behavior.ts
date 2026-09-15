import {clamp,random} from './random';
import type {Config,Mechanism,NetworkState,Result} from './types';

const mechanismVulnerability:Record<Mechanism,number>={Contribution:.82,'Quality-adjusted':.62,'Marginal utility':.28,Proposed:.14};
const effortBonus:Record<Mechanism,number>={Contribution:-.08,'Quality-adjusted':.12,'Marginal utility':.08,Proposed:.14};

export function prepareRound(net:NetworkState,c:Config,mechanism:Mechanism,round:number){
  const r=random((c.seed^Math.imul(round+1,0x9e3779b1))>>>0),demandGrid=Array(400).fill(0),coverGrid=Array(400).fill(0),cellMassGrid=Array(400).fill(1);
  for(const u of net.users){u.demand=(u.baseDemand??u.demand)*(.85+.3*r());const x=Math.min(19,Math.floor(u.x)),y=Math.min(19,Math.floor(u.y));demandGrid[y*20+x]+=u.demand}
  for(const p of net.providers.filter(p=>!p.sybil&&(p.participating??true))){const reach=Math.max(1,Math.ceil(p.radius));for(let y=Math.max(0,Math.floor(p.y)-reach);y<=Math.min(19,Math.floor(p.y)+reach);y++)for(let x=Math.max(0,Math.floor(p.x)-reach);x<=Math.min(19,Math.floor(p.x)+reach);x++)if(Math.hypot(x+.5-p.x,y+.5-p.y)<=p.radius)coverGrid[y*20+x]++}
  const local=(grid:number[],x:number,y:number)=>{let total=0;const reach=Math.max(1,Math.ceil(c.radius));for(let yy=Math.max(0,Math.floor(y)-reach);yy<=Math.min(19,Math.floor(y)+reach);yy++)for(let xx=Math.max(0,Math.floor(x)-reach);xx<=Math.min(19,Math.floor(x)+reach);xx++){const distance=Math.hypot(xx+.5-x,yy+.5-y);if(distance<=c.radius)total+=grid[yy*20+xx]*(1-.35*distance/Math.max(.1,c.radius))}return total};
  const bases=net.providers.filter(p=>!p.sybil);
  for(const p of bases){
    const expected=p.expectedReward??c.pool/Math.max(1,c.providers),oldEffort=p.effort??1,operating=c.cost*(.55+.45*oldEffort),honestPayoff=expected-operating;
    const auditProbability=clamp(c.budget/100*c.sensitivity*(c.strategy==='risk'?1.25:.8),0,1),fraudUpside=expected*Math.max(0,c.inflation-1)*mechanismVulnerability[mechanism];
    const attackPayoff=expected+fraudUpside*(1-auditProbability)-operating-c.attackCost-auditProbability*Math.min(p.stake,c.attackCost*2);
    p.attacking=Boolean(p.malicious&&c.attack!=='none'&&attackPayoff>honestPayoff&&attackPayoff>0);
    const bestPayoff=p.attacking?attackPayoff:honestPayoff;
    p.participating=round===0||bestPayoff>=-.1*c.cost||r()<.025;
    const rewardSignal=expected/(expected+c.cost+1e-9),target=p.participating?clamp(.58+.36*rewardSignal+effortBonus[mechanism]-(p.attacking?.24:0),.35,1.2):.25;
    p.effort=.72*oldEffort+.28*target;p.infrastructureCost=Math.abs(p.effort-oldEffort)*c.cost*.8;
    p.quality=clamp((p.baseQuality??p.quality)*(.7+.3*p.effort),.05,1);p.capacity=c.capacity*(.55+.45*p.effort);
    if(p.participating&&round%3===0){let bx=p.x,by=p.y,best=-Infinity;const candidates=[[p.x,p.y],[r()*20,r()*20],[r()*20,r()*20],[r()*20,r()*20]];for(const [x,y] of candidates){const d=local(demandGrid,x,y),overlap=local(coverGrid,x,y)/Math.max(1,local(cellMassGrid,x,y));let score=mechanism==='Contribution'?d*(1+.12*overlap):mechanism==='Quality-adjusted'?d*p.quality/(1+.18*overlap):mechanism==='Marginal utility'?d/(1+overlap)**1.6:d*p.reputation*(1-.45*p.risk)/(1+overlap)**2;score-=Math.hypot(x-p.x,y-p.y)*c.cost*.08;if(score>best){best=score;bx=x;by=y}}const distance=Math.hypot(bx-p.x,by-p.y);p.x=clamp(p.x+(bx-p.x)*.18,0,20);p.y=clamp(p.y+(by-p.y)*.18,0,20);p.infrastructureCost+=distance*.03*c.cost}
    p.active=Boolean(p.participating&&r()<clamp(p.reliability*(.8+.2*p.effort),0,1));
  }
  for(const p of net.providers.filter(p=>p.sybil)){const owner=bases.find(v=>v.actor===p.actor||v.id===p.actor);p.attacking=Boolean(owner?.attacking);p.participating=Boolean(owner?.participating&&owner.attacking&&c.attack==='sybil');p.active=false;p.effort=.1;p.infrastructureCost=0}
}

export function settleRound(net:NetworkState,c:Config,result:Result){
  const bases=net.providers.filter(p=>!p.sybil),detectedActors=new Set(result.detected.map(i=>net.providers[i]?.actor)),economic=new Map<number,{income:number;attackCost:number}>();
  net.providers.forEach((p,i)=>{const current=economic.get(p.actor)??{income:0,attackCost:0};current.income+=result.rewards[i];current.attackCost+=p.attackCost;economic.set(p.actor,current)});
  for(const p of bases){const actor=economic.get(p.actor)??{income:0,attackCost:0},operating=p.participating?c.cost*(.55+.45*(p.effort??1)):0,payoff=actor.income-operating-actor.attackCost-(p.infrastructureCost??0);p.lastPayoff=payoff;p.cumulativePayoff=(p.cumulativePayoff??0)+payoff;p.expectedReward=.72*(p.expectedReward??actor.income)+.28*actor.income;if(detectedActors.has(p.actor)){p.reputation=clamp(p.reputation-.2,.02,1);p.stake=Math.max(0,p.stake-Math.min(p.stake,Math.max(c.attackCost,1)*2))}else if(p.participating){p.reputation=clamp(p.reputation+.012*(p.actual>0?1:.25),.02,1)}}
}

export function participationMetrics(net:NetworkState){const bases=net.providers.filter(p=>!p.sybil),honest=bases.filter(p=>!p.malicious),malicious=bases.filter(p=>p.malicious),rate=(ps:typeof bases)=>ps.length?ps.filter(p=>p.participating).length/ps.length:null;return{participation:rate(bases),honestParticipation:rate(honest),maliciousParticipation:rate(malicious)}}
