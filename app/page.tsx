"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {BarChart3,Check,Download,FlaskConical,LoaderCircle,Play,RadioTower,X} from "lucide-react";
import {Progress} from "@/components/ui/progress";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";
import {Choice,NumberField} from "@/components/lab/controls";
import {NetworkMap,modes} from "@/components/lab/network-map";
import {ComparisonChart,RoundChart,colors,mechanismLabel} from "@/components/lab/charts";
import {ProviderDetails} from "@/components/lab/details";
import {Settings} from "@/components/lab/settings";
import {simulate,statistics} from "@/lib/simulation/engine";
import {formatMetric as fmt,metricDefinitions} from "@/lib/simulation/metrics";
import {defaults,mechanisms,type Config,type Mechanism,type Provider,type Trial} from "@/lib/simulation/types";

type View="Simulation"|"Experiment"|"Results";
const resultMetrics=["utility","leakage","detection","verificationEfficiency","attackROI"];
const roundMetrics=["utility","coverage","participation","honestParticipation","maliciousParticipation","leakage","attackROI","totalRewards","verificationCost"];
const attacks:Config["attack"][]=["none","false contribution","sybil","strategic placement","fake demand","collusion"];

export default function Home(){
  const [view,setView]=useState<View>("Experiment");
  const [config,setConfig]=useState<Config>(defaults);
  const [trial,setTrial]=useState<Trial>(()=>simulate({...defaults,trials:1}));
  const [trials,setTrials]=useState<Trial[]>([]);
  const [mechanism,setMechanism]=useState<Mechanism>("Proposed");
  const [mode,setMode]=useState("Coverage");
  const [provider,setProvider]=useState<Provider|null>(null);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState(0);
  const [notice,setNotice]=useState("");
  const workers=useRef<Worker[]>([]);
  const result=trial.results.find(r=>r.mechanism===mechanism)!;
  const sample=useMemo(()=>trials.length?trials:[trial],[trials,trial]);
  const dirty=JSON.stringify({...config,trials:1})!==JSON.stringify({...sample[0].config,trials:1});
  const patch=<K extends keyof Config>(key:K,value:Config[K])=>setConfig(c=>({...c,[key]:value}));

  useEffect(()=>()=>workers.current.forEach(w=>w.terminate()),[]);
  useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(""),6000);return()=>clearTimeout(id)},[notice]);

  function run(count=config.trials){
    workers.current.forEach(w=>w.terminate());setBusy(true);setProgress(0);setProvider(null);
    const workerCount=count>=25?Math.min(4,Math.max(1,navigator.hardwareConcurrency??4),count):1,base=Math.floor(count/workerCount),remainder=count%workerCount,workerProgress=Array(workerCount).fill(0);
    const gathered:Trial[]=[];let finished=0,offset=0,failed=false;
    const stopAll=()=>{workers.current.forEach(w=>w.terminate());workers.current=[]};
    workers.current=Array.from({length:workerCount},(_,index)=>{
      const size=base+(index<remainder?1:0),start=offset;offset+=size;
      const w=new Worker("/simulation-worker.js",{type:"module"});
      w.onmessage=e=>{
        if(e.data.type==="trial"){
          gathered.push(e.data.trial);gathered.sort((a,b)=>((a.seed-config.seed)>>>0)-((b.seed-config.seed)>>>0));
          if(e.data.trial.seed===((config.seed+count-1)>>>0))setTrial(e.data.trial);
          setTrials([...gathered]);
        }
        if(e.data.type==="progress"){workerProgress[index]=e.data.progress;setProgress(workerProgress.reduce((s,v)=>s+v,0)/workerCount*100)}
        if(e.data.type==="done"&&!failed){workerProgress[index]=1;finished++;w.terminate();if(finished===workerCount){workers.current=[];setProgress(100);setBusy(false);setView("Results");setTrials([...gathered]);setNotice(`${gathered.length} paired seeded trial${gathered.length===1?"":"s"} completed.`)}}
        if(e.data.type==="error"&&!failed){failed=true;stopAll();setBusy(false);setNotice(e.data.message)}
      };
      w.onerror=e=>{if(!failed){failed=true;stopAll();setBusy(false);setNotice(`Simulation failed: ${e.message}`)}};
      w.postMessage({config:{...config,trials:size,seed:(config.seed+start)>>>0},totalTrials:count});
      return w;
    });
  }

  function exportCSV(){
    const quote=(v:unknown)=>`"${String(v??"").replaceAll('"','""')}"`;
    const rows=[["model","seed","mechanism","round",...roundMetrics,"configuration"],...sample.flatMap(t=>t.results.flatMap(r=>r.history.map(h=>["2.0",t.seed,r.mechanism,h.round,...roundMetrics.map(k=>h.metrics[k]),JSON.stringify(t.config)])))];
    const blob=new Blob([rows.map(r=>r.map(quote).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8;"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`depin-results-${sample[0].seed}-${sample.length}trials.csv`;a.click();URL.revokeObjectURL(a.href);
    setNotice("Raw per-seed mechanism results exported.");
  }

  useEffect(()=>{
    const ctx=(document as Document&{modelContext?:{registerTool:(t:unknown,o:unknown)=>unknown}}).modelContext;if(!ctx)return;
    const abort=new AbortController();
    try{Promise.resolve(ctx.registerTool({name:"read_depin_experiment",description:"Read the completed repeated-round simulation, aggregate metrics, and round histories.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:(input:unknown)=>{if(!input||typeof input!=="object"||Object.keys(input).length)throw Error("Expected an empty object");return{model:"2.0",config:sample[0].config,trials:sample.map(t=>({seed:t.seed,results:t.results.map(r=>({mechanism:r.mechanism,metrics:r.metrics,history:r.history}))}))}}},{signal:abort.signal})).catch(()=>{})}catch{}
    return()=>abort.abort();
  },[sample]);

  const selectedNetwork=result.network??trial.network,malicious=selectedNetwork.providers.filter(p=>p.malicious&&!p.sybil).length;
  const leakageDelta=statistics(sample.map(t=>(t.results[3].metrics.leakage??0)-(t.results[0].metrics.leakage??0)));
  const detectionDelta=statistics(sample.map(t=>(t.results[3].metrics.detection??0)-(t.results[0].metrics.detection??0)));

  return <main className="research-app">
    <header className="research-header">
      <div className="research-brand"><span><RadioTower size={18}/></span><div><strong>DePIN Research Lab</strong><small>VERIFICATION-AWARE INCENTIVE EXPERIMENT</small></div></div>
      <nav aria-label="Primary views">{(["Simulation","Experiment","Results"] as View[]).map((name,i)=><button key={name} data-active={view===name} onClick={()=>setView(name)}><b>0{i+1}</b>{name}</button>)}</nav>
      <div className="research-actions"><span className={dirty?"edited":"ready"}>{busy?`${Math.round(progress)}%`:dirty?"parameters edited":`${sample.length} trial${sample.length===1?"":"s"}`}</span><button className="compact-export" onClick={exportCSV}><Download size={14}/>CSV</button></div>
    </header>

    {busy&&<div className="research-progress"><Progress value={progress}/><button onClick={()=>{workers.current.forEach(w=>w.terminate());workers.current=[];setBusy(false);setNotice("Run stopped; completed trials retained.")}}>Stop</button></div>}

    <div className="research-main">
      {view==="Simulation"&&<SimulationView trial={trial} resultMechanism={mechanism} mode={mode} setMode={setMode} onProvider={setProvider} malicious={malicious}/>} 
      {view==="Experiment"&&<ExperimentView config={config} setConfig={setConfig} mechanism={mechanism} setMechanism={setMechanism} busy={busy} run={run} patch={patch}/>} 
      {view==="Results"&&<ResultsView sample={sample} dirty={dirty} busy={busy} run={()=>run()} exportCSV={exportCSV} leakageDelta={leakageDelta} detectionDelta={detectionDelta}/>} 
    </div>

    <ProviderDetails provider={provider} trial={trial} result={result} onClose={()=>setProvider(null)}/>
    {notice&&<div className="notice" role="status"><Check size={16}/>{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice("")}><X size={14}/></button></div>}
  </main>;
}

function SimulationView({trial,resultMechanism,mode,setMode,onProvider,malicious}:{trial:Trial;resultMechanism:Mechanism;mode:string;setMode:(v:string)=>void;onProvider:(p:Provider)=>void;malicious:number}){
  const selected=trial.results.find(r=>r.mechanism===resultMechanism)!,network=selected.network??trial.network,last=selected.history.at(-1)?.metrics;
  return <><div className="view-intro"><div><span className="view-kicker">01 / SIMULATION</span><h1>Network state</h1><p>Inspect the physical environment used by the current experiment.</p></div><Choice label="Map layer" value={mode} options={modes} onChange={setMode}/></div>
    <div className="network-summary"><div><span>Providers</span><strong>{network.providers.length}</strong></div><div><span>Users</span><strong>{network.users.length.toLocaleString()}</strong></div><div><span>Final coverage</span><strong>{fmt("coverage",last?.coverage??network.health.coverage)}</strong></div><div><span>Malicious</span><strong>{malicious}</strong></div></div>
    <section className="research-panel map-research-panel"><div className="research-panel-head"><div><h2>20 × 20 network field</h2><p>Final round {trial.config.rounds} · seed {trial.seed} · click a provider to inspect its economic state.</p></div><span className="sample-tag">{mechanismLabel(resultMechanism)}</span></div><NetworkMap trial={trial} mechanism={resultMechanism} mode={mode} onSelect={onProvider}/><div className="map-legend"><span><i style={{background:"#6fdec0"}}/>Honest provider</span><span><i style={{background:"#f0a283"}}/>Malicious</span><span><i style={{background:"#c4a1ee"}}/>Sybil</span><span><i className="ring"/>Verified</span></div></section>
  </>;
}

function ExperimentView({config,setConfig,mechanism,setMechanism,busy,run,patch}:{config:Config;setConfig:(c:Config)=>void;mechanism:Mechanism;setMechanism:(m:Mechanism)=>void;busy:boolean;run:(count?:number)=>void;patch:<K extends keyof Config>(key:K,value:Config[K])=>void}){
  return <><div className="view-intro"><div><span className="view-kicker">02 / EXPERIMENT</span><h1>Configure one reproducible test</h1><p>Set parameters, run paired mechanisms, and move directly to quantitative results.</p></div></div>
    <section className="research-panel experiment-panel"><div className="experiment-form">
      <Choice label="Providers" value={String(config.providers)} options={["50","100","250","500","1000"]} onChange={v=>patch("providers",+v)}/><NumberField label="Users" value={config.users} onChange={v=>patch("users",v)} min={1} max={5000}/><Choice label="Malicious provider %" value={String(config.malicious)} options={["0","5","10","20","30","40","50"]} onChange={v=>patch("malicious",+v)}/><Choice label="Attack type" value={config.attack} options={attacks} onChange={v=>patch("attack",v as Config["attack"])}/><Choice label="Verification budget %" value={String(config.budget)} options={["1","5","10","25","50","100"]} onChange={v=>patch("budget",+v)}/><Choice label="Reward mechanism for map" value={mechanism} options={mechanisms} onChange={v=>setMechanism(v as Mechanism)}/><Choice label="Simulation rounds" value={String(config.rounds)} options={["10","25","50","100","200"]} onChange={v=>patch("rounds",+v)}/><Choice label="Number of trials" value={String(config.trials)} options={["1","10","25","50","100"]} onChange={v=>patch("trials",+v)}/><NumberField label="Random seed" value={config.seed} onChange={v=>patch("seed",v)} min={0} max={4294967295}/>
    </div><div className="experiment-runbar"><div><FlaskConical size={18}/><span><strong>Paired design</strong><small>Every seed evaluates all four reward mechanisms against the same network.</small></span></div><button className="run-100" disabled={busy} onClick={()=>run(100)}>Run 100 trials</button><button className="run-primary" disabled={busy} onClick={()=>run()}>{busy?<LoaderCircle className="spin" size={16}/>:<Play size={16} fill="currentColor"/>}Run experiment</button></div></section>
    <section className="model-assumptions"><h2>Model assumptions</h2><div><p><b>Participation.</b> Providers compare an exponentially weighted expected reward with operating and investment costs. A 2.5% exploration probability prevents irreversible early exit.</p><p><b>Placement and effort.</b> Every third round, participating providers compare their current location with three seeded alternatives. Contribution rewards favor demand volume; marginal-utility rules favor underserved demand. Effort adapts gradually and changes capacity, quality, and uptime.</p><p><b>Strategic attacks.</b> Malicious providers attack only when expected fraud income after audit and stake-loss risk exceeds honest payoff. Detection lowers reputation and stake, which affects later rewards and decisions.</p><p><b>Paired environments.</b> Mechanisms share the initial provider/user draw and round demand shocks. Per-round marginal utility uses an allocation-derived local estimate for tractability; the final map recomputes exact leave-one-out marginal utility.</p></div><code>payoffₜ = rewardₜ − operating costₜ − attack costₜ − infrastructure costₜ</code></section>
    <details className="advanced-panel"><summary>Advanced parameter assumptions</summary><div className="advanced-grid"><div><h3>Network</h3><Settings config={config} setConfig={setConfig} group="network"/></div><div><h3>Attack</h3><Settings config={config} setConfig={setConfig} group="attack"/></div><div><h3>Verification</h3><Settings config={config} setConfig={setConfig} group="verification"/></div><div><h3>Economics</h3><Settings config={config} setConfig={setConfig} group="economics"/></div></div></details>
  </>;
}

function ResultsView({sample,dirty,busy,run,exportCSV,leakageDelta,detectionDelta}:{sample:Trial[];dirty:boolean;busy:boolean;run:()=>void;exportCSV:()=>void;leakageDelta:ReturnType<typeof statistics>;detectionDelta:ReturnType<typeof statistics>}){
  const [timelineLabel,setTimelineLabel]=useState(metricDefinitions.utility.label),timelineMetric=roundMetrics.find(k=>metricDefinitions[k].label===timelineLabel)??"utility";
  return <><div className="view-intro results-intro"><div><span className="view-kicker">03 / RESULTS</span><h1>Mechanism comparison</h1><p>{sample.length} paired seeded trial{sample.length===1?"":"s"} · {sample[0].config.rounds} rounds each · seeds {sample[0].seed}{sample.length>1?`–${sample[sample.length-1].seed}`:""}</p></div><div><button className="compact-export large" onClick={exportCSV}><Download size={15}/>Export CSV</button><button className="rerun" disabled={busy} onClick={run}><Play size={14}/>Re-run</button></div></div>
    {dirty&&<div className="stale-banner">Results show the last completed configuration. Run the experiment to apply edited parameters.</div>}
    <section className="research-panel evidence-table"><div className="research-panel-head"><div><h2>Quantitative evidence</h2><p>{sample.length>1?"Mean with sample SD and 95% Student-t confidence interval":"Single seeded observation; run multiple trials for uncertainty estimates"}</p></div><span className="sample-tag">n = {sample.length}</span></div><Table><TableHeader><TableRow><TableHead>Metric</TableHead>{mechanisms.map((m,i)=><TableHead key={m} style={{color:colors[i]}}>{mechanismLabel(m)}</TableHead>)}</TableRow></TableHeader><TableBody>{resultMetrics.map(k=><TableRow key={k}><TableCell title={metricDefinitions[k].definition}>{metricDefinitions[k].label}</TableCell>{mechanisms.map((m,i)=>{const s=statistics(sample.map(t=>t.results[i].metrics[k]));return <TableCell key={m}><strong>{fmt(k,s.mean)}</strong>{sample.length>1&&<><small>SD {fmt(k,s.sd)}</small><small>95% CI {s.low===null?"N/A":`${fmt(k,s.low)}–${fmt(k,s.high)}`}</small></>}</TableCell>})}</TableRow>)}</TableBody></Table></section>
    <div className="mobile-evidence">{mechanisms.map((m,i)=><section className="research-panel" key={m}><h2 style={{color:colors[i]}}>{mechanismLabel(m)}</h2>{resultMetrics.map(k=>{const s=statistics(sample.map(t=>t.results[i].metrics[k]));return <div className="mobile-result" key={k}><span>{metricDefinitions[k].label}</span><strong>{fmt(k,s.mean)}</strong>{sample.length>1&&<small>SD {fmt(k,s.sd)} · 95% CI {s.low===null?"N/A":`${fmt(k,s.low)} to ${fmt(k,s.high)}`}</small>}</div>})}</section>)}</div>
    <section className="research-panel trajectory-panel"><div className="research-panel-head"><div><h2>Behavior across rounds</h2><p>Mean trajectory across paired seeds · choose any tracked outcome</p></div><Choice label="Tracked metric" value={timelineLabel} options={roundMetrics.map(k=>metricDefinitions[k].label)} onChange={setTimelineLabel}/></div><RoundChart trials={sample} metric={timelineMetric}/></section>
    <div className="results-charts">{[["leakage","Fraudulent reward leakage"],["detection","Fraud detection rate"],["verificationEfficiency","Verification efficiency"]].map(([metric,title])=><section className="research-panel chart-card" key={metric}><div className="research-panel-head"><div><h2>{title}</h2><p>Mean across paired seeds</p></div></div><ComparisonChart trials={sample} metric={metric}/></section>)}</div>
    <section className="statistical-summary"><div><BarChart3 size={20}/><span><strong>Statistical summary</strong><small>Proposed mechanism minus contribution-based</small></span></div><p>Fraudulent leakage difference: <b>{fmt("leakage",leakageDelta.mean)}</b>{sample.length>1&&<> (SD {fmt("leakage",leakageDelta.sd)}; 95% CI {leakageDelta.low===null?"N/A":`${fmt("leakage",leakageDelta.low)} to ${fmt("leakage",leakageDelta.high)}`})</>}.</p><p>Detection-rate difference: <b>{fmt("detection",detectionDelta.mean)}</b>{sample.length>1&&<> (SD {fmt("detection",detectionDelta.sd)}; 95% CI {detectionDelta.low===null?"N/A":`${fmt("detection",detectionDelta.low)} to ${fmt("detection",detectionDelta.high)}`})</>}.</p><small>Intervals describe Monte Carlo uncertainty under this model. They do not establish real-world validity or optimality.</small></section>
  </>;
}
