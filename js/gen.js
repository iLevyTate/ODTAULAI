// ========== GENERATIVE LLM (opt-in, local-only) ==========
// Mirrors js/intel.js but loads a small instruct-tuned text-generation
// pipeline for the Ask feature. Strictly opt-in: nothing happens until
// the user flips a Settings toggle AND clicks download. No cloud LLM,
// no analytics, no fetch besides the one-time model weights from the
// same Hugging Face CDN already used by the embedding model.

const GEN_TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.1';
const GEN_CFG_KEY = 'stupind_gen_cfg';
const GEN_HIST_KEY = 'stupind_gen_history';

// Published instruct-tuned models with ONNX weights in each repo's onnx/
// subfolder. Verified HF slugs (Xenova/* does NOT host SmolLM2 — use the
// HuggingFaceTB originals and onnx-community repacks).
const GEN_MODEL_PRESETS = [
  { id:'HuggingFaceTB/SmolLM2-360M-Instruct', dtype:'q4', sizeMb:230, label:'SmolLM2 360M (balanced)', note:'Recommended for most devices' },
  { id:'HuggingFaceTB/SmolLM2-135M-Instruct', dtype:'q4', sizeMb:100, label:'SmolLM2 135M (tiny)',     note:'Lowest RAM — older phones' },
  { id:'onnx-community/Qwen2.5-0.5B-Instruct', dtype:'q4', sizeMb:320, label:'Qwen2.5 0.5B (bigger)',   note:'Desktop / WebGPU preferred' },
];

// Any pre-v27 config that points at the stale Xenova/* slugs gets reset to
// the current default preset. Keeps existing users from hitting a 401.
const GEN_CFG_VERSION = 2;

let _genPipe = null;
let _genReady = false;
let _genLoading = false;
let _genDevice = null;
let _genModelId = null;
let _genLoadPromise = null;
let _genAbortCtl = null;
let _genLastError = null;

function getGenDevice(){ return _genDevice; }
function getGenModel(){ return _genModelId; }
function isGenReady(){ return _genReady; }
function isGenLoading(){ return _genLoading; }
function getGenLastError(){ return _genLastError; }
function clearGenLastError(){ _genLastError = null; }

function _loadGenCfg(){
  let cfg = {};
  try{ cfg = JSON.parse(localStorage.getItem(GEN_CFG_KEY) || '{}') || {}; }
  catch(e){ cfg = {}; }
  if(typeof cfg.enabled !== 'boolean') cfg.enabled = false;
  if(!cfg.modelId) cfg.modelId = GEN_MODEL_PRESETS[0].id;
  if(!cfg.dtype)  cfg.dtype  = GEN_MODEL_PRESETS[0].dtype;
  if(typeof cfg.timeoutSec !== 'number') cfg.timeoutSec = _defaultTimeoutSec();
  if(typeof cfg.downloaded !== 'boolean') cfg.downloaded = false;
  // Migrate: old builds wrote Xenova/SmolLM2-* ids that don't exist on HF.
  // Also fall forward to the current default if the stored id isn't in the
  // preset list so users never get stuck on a stale slug.
  const known = GEN_MODEL_PRESETS.some(p => p.id === cfg.modelId);
  if(!known || cfg.cfgVersion !== GEN_CFG_VERSION){
    cfg.modelId = GEN_MODEL_PRESETS[0].id;
    cfg.dtype = GEN_MODEL_PRESETS[0].dtype;
    cfg.downloaded = false;
    cfg.cfgVersion = GEN_CFG_VERSION;
  }
  return cfg;
}

function _saveGenCfg(cfg){
  try{ localStorage.setItem(GEN_CFG_KEY, JSON.stringify(cfg)); }catch(e){}
}

function _defaultTimeoutSec(){
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  return isMobile ? 30 : 60;
}

function _mobileRamHint(){
  // Very coarse hint; iOS Safari does not report deviceMemory, fall back to agent.
  if(typeof navigator === 'undefined') return null;
  const dm = navigator.deviceMemory;
  if(typeof dm === 'number' && dm < 4) return 'low';
  if(/iPhone|iPad|iPod/.test(navigator.userAgent || '')) return 'ios-unknown';
  return null;
}

function getGenPresets(){ return GEN_MODEL_PRESETS.slice(); }
function getGenCfg(){ return _loadGenCfg(); }
function saveGenCfg(cfg){ _saveGenCfg(cfg); return cfg; }

function getAskHistory(){
  try{ const arr = JSON.parse(localStorage.getItem(GEN_HIST_KEY) || '[]'); return Array.isArray(arr) ? arr : []; }
  catch(e){ return []; }
}
function pushAskHistory(text){
  const s = String(text || '').trim();
  if(!s) return;
  const arr = getAskHistory().filter(x => x && x.text !== s);
  arr.unshift({ ts: Date.now(), text: s.slice(0, 280) });
  try{ localStorage.setItem(GEN_HIST_KEY, JSON.stringify(arr.slice(0, 5))); }catch(e){}
}

/**
 * Load the text-generation pipeline. Does nothing if already loaded.
 * @param {string} modelId
 * @param {string} dtype
 * @param {(progress: { progress?:number, status?:string, file?:string }) => void} [onProgress]
 */
async function genLoad(modelId, dtype, onProgress){
  if(_genReady && _genModelId === modelId) return;
  if(_genLoadPromise) return _genLoadPromise;

  _genLoading = true;
  _genModelId = modelId;
  _genLastError = null;

  const cb = typeof onProgress === 'function' ? onProgress : () => {};

  _genLoadPromise = (async () => {
    let pipeline, env;
    try{
      const mod = await import(GEN_TRANSFORMERS_CDN);
      pipeline = mod.pipeline;
      env = mod.env;
    }catch(e){
      _genLoading = false;
      _genLoadPromise = null;
      _genLastError = 'Failed to load Transformers.js from CDN: ' + (e.message || e);
      throw e;
    }
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    // On WebGPU we prefer q4f16 (int4 weights + fp16 activations) when the
    // caller's stored dtype is plain q4; on WASM we use q4 (fp16 activations
    // aren't supported). This mirrors what works across Transformers.js v3.
    const webgpuDtype = dtype === 'q4' ? 'q4f16' : (dtype || 'q4f16');
    const wasmDtype   = dtype === 'q4f16' ? 'q4' : (dtype || 'q4');

    let lastErr = null;
    try{
      try{
        _genPipe = await pipeline('text-generation', modelId, {
          device: 'webgpu',
          dtype: webgpuDtype,
          progress_callback: cb,
        });
        _genDevice = 'webgpu';
      }catch(e){
        lastErr = e;
        console.warn('[gen] WebGPU pipeline failed, falling back to WASM', e);
        _genPipe = await pipeline('text-generation', modelId, {
          device: 'wasm',
          dtype: wasmDtype,
          progress_callback: cb,
        });
        _genDevice = 'wasm';
      }
      _genReady = true;
      _genLastError = null;
    }catch(e){
      _genPipe = null;
      _genReady = false;
      _genDevice = null;
      _genLoading = false;
      _genLoadPromise = null;
      const msg = (e && e.message) ? e.message : String(e);
      _genLastError = _friendlyGenError(msg, modelId);
      throw e;
    }
    _genLoading = false;
    _genLoadPromise = null;
  })();

  return _genLoadPromise;
}

function _friendlyGenError(msg, modelId){
  const m = String(msg || '');
  if(/Unauthorized|403|404|not found/i.test(m)){
    return `Model "${modelId}" could not be downloaded. The repo may be private, missing, or not published with ONNX weights. Try a different preset. Raw: ${m.slice(0, 120)}`;
  }
  if(/NetworkError|Failed to fetch/i.test(m)){
    return 'Network error while downloading model weights. Check connection and retry.';
  }
  if(/out of memory|OOM|Allocation failed/i.test(m)){
    return 'Device ran out of memory loading the model. Try the smaller Tiny (135M) preset.';
  }
  return 'Load failed: ' + m.slice(0, 180);
}

function genAbort(){
  if(_genAbortCtl){
    try{ _genAbortCtl.abort(); }catch(e){}
  }
}

/**
 * Generate text. Streams tokens via onToken if provided.
 * @param {{ messages?:Array, prompt?:string, maxTokens?:number, temperature?:number, onToken?:(t:string)=>void, signal?:AbortSignal }} opts
 * @returns {Promise<string>} Full generated text (without the prompt).
 */
async function genGenerate(opts){
  if(!_genReady || !_genPipe) throw new Error('GEN_NOT_READY');
  const maxTokens   = Math.min(1024, Math.max(16, opts.maxTokens || 512));
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.2;
  const onToken     = typeof opts.onToken === 'function' ? opts.onToken : null;

  // Chain the caller's AbortSignal with our own for genAbort().
  _genAbortCtl = new AbortController();
  const ctl = _genAbortCtl;
  if(opts.signal){
    if(opts.signal.aborted){ ctl.abort(); }
    else opts.signal.addEventListener('abort', () => ctl.abort(), { once: true });
  }

  const tokenizer = _genPipe.tokenizer;
  let inputs;
  if(Array.isArray(opts.messages) && typeof tokenizer.apply_chat_template === 'function'){
    inputs = tokenizer.apply_chat_template(opts.messages, { tokenize: false, add_generation_prompt: true });
  } else if(typeof opts.prompt === 'string'){
    inputs = opts.prompt;
  } else {
    throw new Error('GEN_NO_INPUT');
  }

  let streamer = null;
  try{
    const mod = await import(GEN_TRANSFORMERS_CDN);
    if(mod && mod.TextStreamer && onToken){
      streamer = new mod.TextStreamer(tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (t) => { try{ onToken(t); }catch(e){} },
      });
    }
  }catch(e){
    // streaming is optional — fall through with full-string output
  }

  const out = await _genPipe(inputs, {
    max_new_tokens: maxTokens,
    do_sample: temperature > 0,
    temperature: temperature,
    return_full_text: false,
    streamer,
  });

  if(ctl.signal.aborted) throw new Error('GEN_ABORTED');
  _genAbortCtl = null;

  if(Array.isArray(out) && out.length){
    const first = out[0];
    if(first && typeof first.generated_text === 'string') return first.generated_text;
  }
  return '';
}

if(typeof window !== 'undefined'){
  window.GEN_MODEL_PRESETS = GEN_MODEL_PRESETS;
  window.getGenPresets = getGenPresets;
  window.getGenCfg = getGenCfg;
  window.saveGenCfg = saveGenCfg;
  window.genLoad = genLoad;
  window.genGenerate = genGenerate;
  window.genAbort = genAbort;
  window.isGenReady = isGenReady;
  window.isGenLoading = isGenLoading;
  window.getGenDevice = getGenDevice;
  window.getGenModel = getGenModel;
  window.getGenLastError = getGenLastError;
  window.clearGenLastError = clearGenLastError;
  window.getAskHistory = getAskHistory;
  window.pushAskHistory = pushAskHistory;
  window._mobileRamHint = _mobileRamHint;
}
