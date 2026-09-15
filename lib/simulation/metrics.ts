export const metricDefinitions:Record<string,{label:string;definition:string;unit?:string}>={
 utility:{label:'Network utility',definition:'U = w₁C + w₂D + w₃Q − w₄R − w₅I. A weighted dimensionless score; not constrained to [0,1].'},
 coverage:{label:'Network coverage',definition:'C = users within at least one online provider radius / all users. User coverage, not geographic area.',unit:'%'},
 demand:{label:'Demand served',definition:'D = total delivered demand / total genuine demand.',unit:'%'},
 quality:{label:'Service quality',definition:'Q = Σ(delivered demand × link quality) / total genuine demand. Link quality = provider quality × (1 − 0.35 × distance/radius).',unit:'%'},
 redundancy:{label:'Infrastructure redundancy',definition:'R = users within at least two online coverage disks / all users, regardless of capacity.',unit:'%'},
 totalRewards:{label:'Total rewards',definition:'Total paid after withholding flagged rewards. Withheld funds remain unspent.',unit:'cr'},
 averageReward:{label:'Average provider reward',definition:'Total paid / all identities, including offline providers and Sybils.',unit:'cr'},
 leakage:{label:'Fraudulent reward leakage',definition:'Σ reward × max(0, claimed − actual) / claimed; zero fraction for zero claim. Proportional attribution to fabricated service, not causal attack gain.',unit:'cr'},
 detection:{label:'Fraud detection rate',definition:'Correctly detected inflated-claim identities / all inflated-claim identities. N/A if none.',unit:'%'},
 falsePositives:{label:'False positives',definition:'Audited truthful identities incorrectly flagged.'},
 verificationCost:{label:'Verification cost',definition:'Audited identity count × cost per audit.',unit:'cr'},
 prevented:{label:'Fraudulent rewards prevented',definition:'Σ gross reward × fraudulent claim fraction for correctly detected fraud.',unit:'cr'},
 verificationEfficiency:{label:'Verification efficiency',definition:'Fraudulent rewards prevented / verification cost. N/A if no cost.',unit:'×'},
 attackROI:{label:'Attack ROI',definition:'(Fraudulent reward obtained − attack cost) / attack cost. N/A at zero attack cost. Recoverable stake excluded.',unit:'%'},
 participation:{label:'Provider participation',definition:'Base providers choosing to participate / all base providers, averaged across behavioral rounds.',unit:'%'},
 honestParticipation:{label:'Honest provider participation',definition:'Honest base providers choosing to participate / all honest base providers.',unit:'%'},
 maliciousParticipation:{label:'Malicious provider participation',definition:'Malicious base providers choosing to participate / all malicious base providers.',unit:'%'},
 concentration:{label:'Reward concentration',definition:'HHI = Σ(reward / total paid)² across identities. N/A if no payout.'},
 usefulEfficiency:{label:'Useful reward efficiency',definition:'Rewards attributable to truthful service at positive-MU identities / total paid. N/A if no payout.',unit:'%'},
 verified:{label:'Providers verified',definition:'Audit count ≤ floor(identity count × budget / 100). Risk allocation can leave budget unused.'}
};
export function formatMetric(key:string,v:number|null|undefined){if(v===null||v===undefined||!Number.isFinite(v))return 'N/A';const u=metricDefinitions[key]?.unit;if(u==='%')return `${(v*100).toFixed(1)}%`;if(u==='cr')return v.toLocaleString('en-US',{maximumFractionDigits:1});return `${v.toFixed(u==='×'?2:3)}${u==='×'?'×':''}`}
