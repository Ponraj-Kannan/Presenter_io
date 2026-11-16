<script setup>
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import { RealtimeService } from '../services/realtime.js'

// ── Props ─────────────────────────────────────────────────────────────────────
const CODE_LIBRARY = {}

const props = defineProps({
  language:   { type: String,  default: 'java' },
  codeKey:    { type: String,  default: '' },
  starterCode:{ type: String,  default: '' },
  hideStdin:  { type: Boolean, default: false },
  theme:      { type: String,  default: 'light' },
  // ── Injected by StepFlow ──────────────────────────────────────────────────
  isMentor:    { type: Boolean, default: false },
  roomCode:    { type: String,  default: '' },
  stepNumber:  { type: Number,  default: 0 },
  isClassLive: { type: Boolean, default: false },
  isClassEnded:{ type: Boolean, default: false },
  /**
   * 'present'  — Mentor: fully interactive, publishes changes
   * 'watch'    — Student (locked): inert, receives sync via postMessage to OC iframe
   * 'practice' — Student (unlocked): fully interactive, never publishes
   */
  mode: { type: String, default: 'present' }
})

// ── Starter code ──────────────────────────────────────────────────────────────
const resolvedCode = computed(() => {
  if (props.codeKey && CODE_LIBRARY[props.codeKey]) return CODE_LIBRARY[props.codeKey]
  return props.starterCode
})

// ── OC language map ───────────────────────────────────────────────────────────
const OC_LANG_MAP = { java:'java', python:'python', python3:'python', cpp:'cpp', c:'c', js:'javascript', javascript:'javascript' }
const ocLang = computed(() => OC_LANG_MAP[props.language] || props.language)

// ── OC iframe URL ─────────────────────────────────────────────────────────────
const STORAGE_KEY = `oc-code-${props.language}-${props.codeKey || 'default'}`

const oneCompilerUrl = computed(() => {
  const base = `https://onecompiler.com/embed/${ocLang.value}`
  const params = new URLSearchParams({
    theme:              props.theme,
    hideNewFileOption:  'false',
    hideStdin:          props.hideStdin ? 'true' : 'false',
    hideTitle:          'true',
    listenToEvents:     'true',
    codeChangeEvent:    'true',
    fontSize:           '14',
  })
  if (props.mode === 'present') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const savedCode = saved ? JSON.parse(saved).code : null
      const initialCode = savedCode || resolvedCode.value
      if (initialCode) params.set('code', initialCode)
    } catch (_) {}
  } else {
    if (resolvedCode.value) params.set('code', resolvedCode.value)
  }
  return `${base}?${params.toString()}`
})

// ── Shared refs ───────────────────────────────────────────────────────────────
const currentCode = ref(resolvedCode.value)
const currentFileName = ref(
  'Main.' + (
    props.language === 'python' || props.language === 'python3' ? 'py' :
    props.language === 'javascript' || props.language === 'js' ? 'js' :
    props.language === 'cpp' ? 'cpp' :
    props.language === 'c' ? 'c' : 'java'
  )
)
const ocFrameRef = ref(null)

// ── Watch mode overlay state ──────────────────────────────────────────────────
const watchRunOutput   = ref(null)       // string | null
const watchRunStatus   = ref(null)       // 'running'|'success'|'error'|null
const watchExecTime    = ref(null)       // string | null
const watchActiveTab   = ref('console')  // 'console'|'io'
const watchConnected   = ref(false)      // received first valid state
const watchWaiting     = ref(false)      // 5s timeout — show "Waiting…"

// ── Error boundary state ──────────────────────────────────────────────────────
const hasError   = ref(false)
const errorMsg   = ref('')
const showDetail = ref(false)
const retryKey   = ref(0) // bump to remount the iframe

// ── Host inject (ClassRoom provides this) ─────────────────────────────────────
const _host = inject('stepFlowHost', null)

// ── Realtime ──────────────────────────────────────────────────────────────────
let _realtime     = null   // present mode
let _watchRt      = null   // watch mode separate instance

let _debounceTimer  = null
let _keyframeTimer  = null
const DEBOUNCE_MS   = 150
const KEYFRAME_MS   = 10000
const TIMEOUT_MS    = 5000
const RETRY_MS      = 3000

let _lastRunOutput = null
let _lastRunStatus = null
let _lastExecTime  = null
let _runnerVersion = 0
let _appliedVersion = -1

let _connectTimeoutId = null
let _retryIntervalId  = null

// ── PRESENT MODE helpers ──────────────────────────────────────────────────────

function _getOrCreateRealtime() {
  if (!_realtime && props.roomCode) _realtime = new RealtimeService(props.roomCode)
  return _realtime
}

function _buildPayload(overrides = {}) {
  _runnerVersion++
  const p = {
    senderRole:    'mentor',
    stepNumber:    props.stepNumber,
    version:       _runnerVersion,
    code:          currentCode.value,
    language:      ocLang.value,
    fileName:      currentFileName.value,
    runOutput:     _lastRunOutput,
    runStatus:     _lastRunStatus,
    executionTime: _lastExecTime,
    ...overrides
  }
  if (p.runOutput && p.runOutput.length > 65536) {
    p.runOutput = p.runOutput.slice(0, 65536) + '\nOutput truncated'
  }
  return p
}

function _publish(payload) {
  const rt = _getOrCreateRealtime()
  if (!rt) return
  rt.publish('javarunner-sync', payload)
  // Update same-tab cache (BroadcastChannel doesn't loop back to sender)
  if (_host && typeof _host.setJavaRunnerState === 'function') {
    _host.setJavaRunnerState(props.stepNumber, payload)
  }
}

function broadcastCode() {
  if (props.mode !== 'present' || !props.isClassLive || !props.roomCode) return
  _publish(_buildPayload())
}

function _scheduleBroadcast() {
  if (props.mode !== 'present' || !props.isClassLive) return
  if (_debounceTimer) clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(broadcastCode, DEBOUNCE_MS)
}

function _startKeyframe() {
  if (_keyframeTimer) clearInterval(_keyframeTimer)
  _keyframeTimer = setInterval(() => {
    if (props.mode === 'present' && props.isClassLive && props.roomCode) broadcastCode()
  }, KEYFRAME_MS)
}

function _stopKeyframe() {
  if (_keyframeTimer) { clearInterval(_keyframeTimer); _keyframeTimer = null }
}

// ── PRESENT MODE: OC postMessage handler ─────────────────────────────────────
let _msgHandler = null

function _setupMentorHandler() {
  if (typeof window === 'undefined') return
  _msgHandler = (event) => {
    if (!event.data) return
    if (event.data.source === 'vue-devtools-proxy') return
    if (ocFrameRef.value && event.source !== ocFrameRef.value.contentWindow) return

    let newFileName = currentFileName.value
    let codeChanged = false

    if (event.data.files && Array.isArray(event.data.files) && event.data.files.length > 0) {
      const f = event.data.files[0]
      if (f.content !== undefined) {
        const nc = f.content ?? currentCode.value
        if (nc !== currentCode.value) { currentCode.value = nc; codeChanged = true }
      }
      if (f.name) newFileName = f.name
      if (event.data.language) codeChanged = true
    } else if (typeof event.data.code === 'string') {
      const nc = event.data.code
      if (nc !== currentCode.value) { currentCode.value = nc; codeChanged = true }
    } else if (typeof event.data.data === 'string' && event.data.type !== 'result') {
      const nc = event.data.data
      if (nc !== currentCode.value) { currentCode.value = nc; codeChanged = true }
    }

    if (newFileName !== currentFileName.value) { currentFileName.value = newFileName; codeChanged = true }

    if (event.data.type === 'result') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: currentCode.value, savedAt: new Date().toISOString() }))
      } catch (_) {}

      if (props.mode === 'present' && props.isClassLive && props.roomCode) {
        const output  = typeof event.data.output === 'string' ? event.data.output : (event.data.stderr || event.data.stdout || '')
        const status  = event.data.status || (event.data.error ? 'error' : 'success')
        const execTime = event.data.executionTime
          ? String(event.data.executionTime)
          : (event.data.time ? `${event.data.time} ms` : null)

        _lastRunOutput = output
        _lastRunStatus = status
        _lastExecTime  = execTime

        // Publish run result immediately — no debounce
        _publish(_buildPayload({ runOutput: output, runStatus: status, executionTime: execTime }))
      }
    } else if (codeChanged) {
      _scheduleBroadcast()
    }
  }
  window.addEventListener('message', _msgHandler)
}

function _teardownMentorHandler() {
  if (_msgHandler) { window.removeEventListener('message', _msgHandler); _msgHandler = null }
  if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null }
}

// ── WATCH MODE: apply mentor state to OC iframe ───────────────────────────────

function _applyWatchState(data) {
  if (!data || data.senderRole !== 'mentor') return
  // Allow version 0 (from cached/initial state) to always apply; subsequent must be newer
  const v = Number(data.version || 0)
  if (v > 0 && v <= _appliedVersion) return
  if (v > 0) _appliedVersion = v

  if (data.runStatus   !== undefined) watchRunStatus.value = data.runStatus
  if (data.runOutput   !== undefined) watchRunOutput.value = data.runOutput
  if (data.executionTime !== undefined) watchExecTime.value = data.executionTime

  // Push code into OC iframe via postMessage
  const frame = ocFrameRef.value
  if (frame && frame.contentWindow && data.code !== undefined) {
    const lang     = data.language || ocLang.value
    const fileName = data.fileName || currentFileName.value
    frame.contentWindow.postMessage({
      eventType: 'populateCode',
      language:  lang,
      files:     [{ name: fileName, content: data.code }]
    }, '*')
  }

  watchConnected.value = true
  watchWaiting.value   = false
  _clearConnectTimeout()
  _clearRetry()
}

function _clearConnectTimeout() {
  if (_connectTimeoutId) { clearTimeout(_connectTimeoutId); _connectTimeoutId = null }
}

function _clearRetry() {
  if (_retryIntervalId) { clearInterval(_retryIntervalId); _retryIntervalId = null }
}

function _startRetry() {
  if (_retryIntervalId) return
  watchWaiting.value = true
  _retryIntervalId = setInterval(() => {
    if (watchConnected.value) { _clearRetry(); return }
    // Send request-state — the ClassRoom mentor side responds with broadcastRoomState()
    if (_watchRt) _watchRt.publish('request-state', { senderRole: 'student', stepNumber: props.stepNumber })
  }, RETRY_MS)
}

function _setupWatchSubscription() {
  if (!props.roomCode) return
  _watchRt = new RealtimeService(props.roomCode)

  _watchRt.on('javarunner-sync', (data) => {
    if (data && Number(data.stepNumber) === props.stepNumber) {
      _applyWatchState(data)
    }
  })

  // Also listen for state-sync replies (mentor broadcasts full state including javarunnerLatestByStep)
  // This path is handled by ClassRoom which updates host.getJavaRunnerState; we poll after a short delay
  _connectTimeoutId = setTimeout(() => {
    if (!watchConnected.value) _startRetry()
  }, TIMEOUT_MS)

  // Send state request immediately on subscribe — mentor will reply with broadcastRoomState
  // which includes javarunnerLatestByStep, and ClassRoom will update javarunnerStateByStep,
  // then JavaRunner also receives javarunner-sync via the keyframe or immediate re-broadcast.
  // Send both: request-state (triggers ClassRoom mentor) and direct state request.
  _watchRt.onSubscribed(() => {
    if (!watchConnected.value && _watchRt) {
      _watchRt.publish('request-state', { senderRole: 'student', stepNumber: props.stepNumber })
    }
  })
}

function _teardownWatchSubscription() {
  _clearConnectTimeout()
  _clearRetry()
  if (_watchRt) { _watchRt.destroy(); _watchRt = null }
}

// ── OC iframe load event ──────────────────────────────────────────────────────
const onIframeLoad = () => {
  // After OC loads, if we're in watch mode and already have cached state, apply it
  if (props.mode === 'watch' && _host && typeof _host.getJavaRunnerState === 'function') {
    const cached = _host.getJavaRunnerState(props.stepNumber)
    if (cached) _applyWatchState({ ...cached, senderRole: 'mentor', version: 0 })
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  if (props.mode === 'present') {
    _setupMentorHandler()
    if (props.isClassLive && props.roomCode) {
      setTimeout(broadcastCode, 500)
      _startKeyframe()
    }
  } else if (props.mode === 'watch') {
    _setupWatchSubscription()
    // Check host cache immediately (populated by state-sync for late joiners)
    if (_host && typeof _host.getJavaRunnerState === 'function') {
      const cached = _host.getJavaRunnerState(props.stepNumber)
      if (cached) {
        // Delay by 800ms to let the OC iframe load first
        setTimeout(() => _applyWatchState({ ...cached, senderRole: 'mentor', version: 0 }), 800)
      }
    }
  }
})

watch(() => props.isClassLive, (live) => {
  if (props.mode === 'present') {
    if (live && props.roomCode) {
      setTimeout(broadcastCode, 300)
      _startKeyframe()
    } else {
      _stopKeyframe()
    }
  }
})

onUnmounted(() => {
  _teardownMentorHandler()
  _teardownWatchSubscription()
  _stopKeyframe()
  if (_realtime) { _realtime.destroy(); _realtime = null }
})
</script>

<template>
  <div class="oc-root">
    <!-- ── Error boundary ─────────────────────────────────────────────── -->
    <div v-if="hasError" class="oc-error-panel" role="alert">
      <div class="oc-error-title">Could not load the compiler</div>
      <button class="oc-error-retry" @click="retryKey++; hasError = false; errorMsg = ''">Retry</button>
      <details class="oc-error-details">
        <summary @click="showDetail = !showDetail">Show details</summary>
        <pre class="oc-error-pre">{{ errorMsg }}</pre>
      </details>
    </div>

    <!-- ── Main compiler area ─────────────────────────────────────────── -->
    <div
      v-else
      :key="retryKey"
      class="oc-slide"
      :class="{ 'oc-slide--watch': mode === 'watch' }"
    >
      <!-- Watch mode: transparent shield blocks all iframe interaction -->
      <div v-if="mode === 'watch'" class="oc-shield" aria-hidden="true"></div>

      <!-- Watch mode: "Connecting…" / "Waiting…" overlay -->
      <div
        v-if="mode === 'watch' && !watchConnected"
        class="oc-skeleton"
        role="status"
        aria-live="polite"
      >
        <span class="oc-skeleton-text">
          {{ watchWaiting ? 'Waiting for the Mentor\'s screen…' : 'Connecting to the Mentor\'s screen…' }}
        </span>
        <span v-if="watchWaiting" class="oc-skeleton-hint">Reconnecting in a moment</span>
      </div>

      <!-- OC iframe -->
      <div class="oc-frame-wrap" :class="{ 'oc-frame-wrap--dim': mode === 'watch' && !watchConnected }">
        <iframe
          ref="ocFrameRef"
          :src="oneCompilerUrl"
          class="oc-frame"
          frameborder="0"
          allowfullscreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
          id="compiler-text-area"
          @load="onIframeLoad"
          :aria-label="mode === 'watch' ? 'Mentor\'s compiler, view only' : undefined"
        ></iframe>
      </div>

      <!-- Watch mode: overlay console (students can't trigger Run, so OC console stays empty) -->
      <div
        v-if="mode === 'watch'"
        class="oc-ov-console"
        role="region"
        aria-label="Console output"
      >
        <!-- Tab bar -->
        <div class="oc-ov-tabbar">
          <div class="oc-ov-tabs">
            <button
              class="oc-ov-tab"
              :class="{ 'oc-ov-tab--active': watchActiveTab === 'console' }"
              @click="watchActiveTab = 'console'"
            >Console</button>
            <button
              class="oc-ov-tab"
              :class="{ 'oc-ov-tab--active': watchActiveTab === 'io' }"
              @click="watchActiveTab = 'io'"
            >I/O</button>
          </div>
          <div v-if="watchExecTime" class="oc-ov-exectime">
            <svg v-if="watchRunStatus === 'success'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-success,#22c55e)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <svg v-else-if="watchRunStatus === 'error'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger,#ef4444)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <span>{{ watchExecTime }}</span>
          </div>
        </div>

        <!-- Body -->
        <div class="oc-ov-body" aria-live="polite">
          <template v-if="watchActiveTab === 'console'">
            <pre v-if="watchRunOutput !== null && watchRunOutput !== undefined" class="oc-ov-output">{{ watchRunOutput }}</pre>
            <div v-else class="oc-ov-empty">
              <span class="oc-ov-empty-title">Live Console</span>
              <span class="oc-ov-empty-hint">Click Run to start</span>
            </div>
          </template>
          <template v-if="watchActiveTab === 'io'">
            <div class="oc-ov-io-label">Input (read-only)</div>
            <textarea class="oc-ov-io-textarea" readonly placeholder="No input"></textarea>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Root: fills whatever flex cell ClassRoom gives it ───────────────── */
.oc-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
}

/* ── Error panel ─────────────────────────────────────────────────────── */
.oc-error-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1.5rem;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.oc-error-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-danger, #ef4444);
}

.oc-error-retry {
  padding: 0.375rem 0.875rem;
  border-radius: 0.375rem;
  border: 1px solid var(--btn-tonal-danger-border, #ef4444);
  background: var(--btn-tonal-danger-bg, #fef2f2);
  color: var(--btn-tonal-danger-text, #dc2626);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.oc-error-details {
  font-size: 0.75rem;
  color: var(--color-secondary, #64748b);
}

.oc-error-pre {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--bg-raised, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.6875rem;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Slide container ─────────────────────────────────────────────────── */
.oc-slide {
  --oc-fs:        0.75rem;
  --oc-fw:        600;
  --oc-lh:        1rem;
  --oc-run-fs:    0.6875rem;
  --oc-run-r:     0.375rem;
  --oc-run-p:     0.125rem 0.5rem;
  --oc-run-h:     22px;

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  border-radius: 5px;
  overflow: hidden;
  position: relative;
}

/* Watch mode cursor */
.oc-slide--watch { cursor: default; }

/* ── Inert shield ────────────────────────────────────────────────────── */
.oc-shield {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: all;
  cursor: default;
  background: transparent;
}

/* ── Connecting / waiting skeleton ───────────────────────────────────── */
.oc-skeleton {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--bg-page, rgba(255,255,255,0.88));
  pointer-events: none;
}

.oc-skeleton-text {
  font-size: 0.8125rem;
  color: var(--color-secondary, #64748b);
  font-style: italic;
}

.oc-skeleton-hint {
  font-size: 0.6875rem;
  color: var(--color-muted, #94a3b8);
}

/* ── OC iframe wrapper ───────────────────────────────────────────────── */
.oc-frame-wrap {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  transition: opacity 0.2s;
}

.oc-frame-wrap--dim { opacity: 0.3; }

.oc-frame {
  width: 100%;
  height: 100%;
  display: block;
  border: none;
  zoom: 1;
}

/* ── Overlay console (watch mode) ────────────────────────────────────── */
.oc-ov-console {
  position: absolute;
  right: 0;
  top: 36px;    /* below OC tab bar */
  bottom: 26px; /* above OC status bar */
  width: 42%;
  min-width: 180px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background: var(--bg-card, #fff);
  border-left: 1px solid var(--color-border, #e2e8f0);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

.oc-ov-tabbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  background: var(--bg-panel, #f8fafc);
  min-height: 32px;
  flex-shrink: 0;
}

.oc-ov-tabs { display: flex; align-items: center; }

.oc-ov-tab {
  font-size: 0.71875rem;
  font-weight: 500;
  color: var(--color-secondary, #64748b);
  padding: 4px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.oc-ov-tab:hover { color: var(--color-primary, #334155); }
.oc-ov-tab--active {
  color: var(--color-primary, #334155);
  border-bottom: 2px solid var(--color-accent, #6366f1);
}

.oc-ov-exectime {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  color: var(--color-secondary, #64748b);
  font-variant-numeric: tabular-nums;
}

.oc-ov-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
}

.oc-ov-output {
  margin: 0;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 0.75rem;
  color: var(--color-primary, #1e293b);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.oc-ov-empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 0;
}

.oc-ov-empty-title {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-muted, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.oc-ov-empty-hint {
  font-size: 0.71875rem;
  color: var(--color-muted-soft, #cbd5e1);
}

.oc-ov-io-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-muted, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.oc-ov-io-textarea {
  flex: 1;
  resize: none;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  padding: 6px 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: var(--color-primary, #334155);
  background: var(--bg-raised, #f8fafc);
  min-height: 60px;
  outline: none;
}

/* ── OC iframe deep overrides ────────────────────────────────────────── */
:deep(.tab:not(.run-btn):not(.btn-run)),
:deep(.file-tab),
:deep(.editor-tab),
:deep(.tab-item),
:deep([data-tab]),
:deep(.file-name),
:deep(.filename),
:deep(.lang-select),
:deep(.language-select),
:deep(.lang-dropdown),
:deep(.language-dropdown),
:deep(.lang-label),
:deep(.language-label),
:deep(.select-lang) {
  font-size: var(--oc-fs, 0.75rem) !important;
  line-height: var(--oc-lh, 1rem) !important;
}

:deep(.console-tab),
:deep(.io-tab),
:deep(.output-tab),
:deep(.terminal-tab),
:deep(.console-tabs .tab),
:deep(.bottom-tabs .tab),
:deep(.console-header .tab),
:deep([data-tab="console"]),
:deep([data-tab="io"]),
:deep([data-tab="Console"]),
:deep([data-tab="I/O"]) {
  font-size: var(--oc-fs, 0.75rem) !important;
  line-height: var(--oc-lh, 1rem) !important;
}

:deep(.live-console),
:deep(.console-empty-title),
:deep(.empty-state-title),
:deep(.console-title),
:deep(.empty-title),
:deep(.empty-console h3),
:deep(.empty-state h3),
:deep(.empty-state h4),
:deep(.console-empty-desc),
:deep(.console-empty-text),
:deep(.empty-state-desc),
:deep(.empty-state p),
:deep(.empty-message),
:deep(.console-placeholder) {
  font-size: var(--oc-fs, 0.75rem) !important;
  line-height: var(--oc-lh, 1rem) !important;
}

:deep(.theme-toggle),
:deep(.theme-label),
:deep(.theme-btn),
:deep(.status-theme),
:deep(.terminal-label),
:deep(.terminal-title),
:deep(.status-terminal),
:deep(.status-item),
:deep(.status-bar span),
:deep(.editor-footer span) {
  font-size: var(--oc-fs, 0.75rem) !important;
  line-height: var(--oc-lh, 1rem) !important;
}

:deep(.tab-bar),
:deep(.editor-tabs),
:deep(.tabs-header),
:deep(.file-tabs) {
  min-height: 34px;
  padding: 3px 8px;
  align-items: center;
}

:deep(.status-bar),
:deep(.editor-footer),
:deep(.bottom-bar) {
  min-height: 26px;
  padding: 2px 8px;
  align-items: center;
}

/* ── Run button ──────────────────────────────────────────────────────── */
:deep(.run-btn),
:deep(.btn-run),
:deep(button.run),
:deep(.run-button),
:deep(.editor-run-btn),
:deep(.oc-run-btn),
:deep([data-action="run"]),
:deep([title*="Run"]),
:deep(button[title*="Run"]),
:deep(.tab-bar button.run),
:deep(.tab-bar .run-btn),
:deep(.tab-bar .btn-run),
:deep(.editor-tabs .run-btn),
:deep(.editor-tabs button.run),
:deep(.file-tabs .run-btn),
:deep(.file-tabs button.run) {
  border-radius: var(--oc-run-r, 0.375rem) !important;
  border: 1px solid var(--btn-tonal-danger-border) !important;
  box-shadow: none !important;
  background: var(--btn-tonal-danger-bg) !important;
  background-color: var(--btn-tonal-danger-bg) !important;
  color: var(--btn-tonal-danger-text) !important;
  font-size: var(--oc-run-fs, 0.6875rem) !important;
  font-weight: var(--oc-fw, 600) !important;
  line-height: 1rem !important;
  letter-spacing: normal !important;
  padding: var(--oc-run-p, 0.125rem 0.5rem) !important;
  height: var(--oc-run-h, 22px) !important;
  min-height: var(--oc-run-h, 22px) !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  cursor: pointer !important;
  transition: all 0.15s ease-in-out !important;
}

:deep(.run-btn:hover:not(:disabled)),
:deep(.btn-run:hover:not(:disabled)),
:deep(button.run:hover:not(:disabled)),
:deep(.run-button:hover:not(:disabled)),
:deep([data-action="run"]:hover:not(:disabled)),
:deep([title*="Run"]:hover:not(:disabled)),
:deep(button[title*="Run"]:hover:not(:disabled)) {
  background: var(--btn-tonal-danger-hover) !important;
  background-color: var(--btn-tonal-danger-hover) !important;
  border-color: var(--btn-tonal-danger-border) !important;
  color: var(--btn-tonal-danger-text) !important;
}

:deep(.run-btn:active:not(:disabled)),
:deep(.btn-run:active:not(:disabled)),
:deep(button.run:active:not(:disabled)),
:deep(.run-button:active:not(:disabled)),
:deep([data-action="run"]:active:not(:disabled)),
:deep([title*="Run"]:active:not(:disabled)),
:deep(button[title*="Run"]:active:not(:disabled)) {
  background: var(--btn-tonal-danger-pressed) !important;
  background-color: var(--btn-tonal-danger-pressed) !important;
  border-color: var(--btn-tonal-danger-border) !important;
  color: var(--btn-tonal-danger-text) !important;
}

:deep(.run-btn:disabled),
:deep(.run-btn[disabled]),
:deep(.run-btn.disabled),
:deep(.btn-run:disabled),
:deep(button.run:disabled),
:deep([data-action="run"]:disabled) {
  background-color: var(--btn-disabled-bg, rgba(32,33,36,0.12)) !important;
  color: var(--btn-disabled-text, rgba(32,33,36,0.38)) !important;
  border-color: transparent !important;
  cursor: not-allowed !important;
  opacity: 0.6 !important;
  box-shadow: none !important;
}

:deep(.run-btn svg),
:deep(.run-btn .icon),
:deep(.btn-run svg),
:deep(button.run svg),
:deep(.run-button svg),
:deep([data-action="run"] svg),
:deep([title*="Run"] svg),
:deep(button[title*="Run"] svg) {
  color: var(--btn-tonal-danger-text) !important;
  fill: currentColor !important;
  stroke: currentColor !important;
  width: 0.625rem !important;
  height: 0.625rem !important;
  flex-shrink: 0 !important;
}

:deep(.run-btn svg path),
:deep(.run-btn svg polygon),
:deep(.btn-run svg path),
:deep(.btn-run svg polygon),
:deep(button.run svg path),
:deep(button.run svg polygon),
:deep(.run-button svg path),
:deep(.run-button svg polygon),
:deep([data-action="run"] svg path),
:deep([data-action="run"] svg polygon) {
  fill: currentColor !important;
  stroke: currentColor !important;
}
</style>
