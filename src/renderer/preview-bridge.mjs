import { getSampleIssue } from '../shared/sample.mjs';

/** Honest browser-only preview. No persistence, networking, credentials or fake jobs. */
export function createPreviewBridge() {
  let settings={version:1,uiLanguage:'zh-CN',publication:{title:'The Personal Press',time:'07:00',timeZone:'Asia/Shanghai',enabled:false},profile:{tracks:[],lenses:[],custom:'',depth:3},sources:[],model:{provider:'openai',model:'',baseUrl:'',maxArticles:6,review:true},reading:{languageA:'en',languageB:'zh-CN',ratio:70,fontSize:17,palette:'ink',layout:'newspaper'},print:{enabled:false,deviceName:'',paperSize:'A4',duplex:'simplex',maxPages:12,includeLeisure:true},entertainment:{enabled:true,sudoku:true,crossword:true,riddle:true,joke:true},calendar:{events:[]}};
  const copy=value=>JSON.parse(JSON.stringify(value));
  const unavailable=async()=>{throw new Error('This action requires the desktop application.');};
  return {
    isPreview:true,
    getState:async()=>({settings:copy(settings),issues:[],credentialStatus:{},storage:{credentialProtection:'preview'},runtime:{version:'preview',platform:'browser',activeJob:null,nextDelivery:null,lastError:null}}),
    saveSettings:async value=>{settings=copy(value);return copy(settings);},
    getSample:async()=>getSampleIssue(settings.reading),
    getIssue:async id=>id==='sample'?getSampleIssue(settings.reading):unavailable(),
    saveCredential:unavailable,listModels:unavailable,generateToday:unavailable,exportIssue:unavailable,listPrinters:unavailable,testPrint:unavailable,printIssue:unavailable,getPrintJobs:unavailable,openSource:unavailable,
    onStateChanged:()=>()=>{}
  };
}
