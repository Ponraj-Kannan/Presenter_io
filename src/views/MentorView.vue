<template>
  <div class="mentor-view flex-1 w-full min-h-0 flex flex-col overflow-y-auto md:overflow-hidden relative">

    <!-- PHASE 3: Live Classroom -->
    <ClassRoom
      v-if="phase === 'classroom' && roomCode"
      ref="classroomRef"
      :is-mentor="true"
      :room-code="roomCode"
      @leave="handleLeave"
    />

    <!-- PHASE 2: Room Created card -->
    <MentorRoomCreatedView
      v-else-if="phase === 'created' && roomCode"
      :room-code="roomCode"
      @back-home="handleBackHome"
      @open-class-room="handleOpenClassRoom"
    />

    <!-- PHASE 1: Create a room -->
    <div
      v-else
      class="mentor-create-view w-full max-w-sm mx-auto px-4 py-6 md:py-8 flex-1 flex flex-col justify-center select-none"
    >
      <div class="bg-card rounded-2xl p-6 sm:p-7 border border-border shadow-card">
        <h1 class="text-xl font-bold text-primary tracking-tight mb-1">
          Create a room
        </h1>
        <p class="text-xs text-secondary mb-5">
          Create a room and share the code with your students.
        </p>

        <button
          type="button"
          @click="handleCreateRoom"
          class="btn-tonal-accent w-full font-semibold py-3 rounded-xl text-sm transition cursor-pointer active:scale-98 flex items-center justify-center gap-2 min-h-[44px]"
        >
          <span>Create Room</span>
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import MentorRoomCreatedView from '../components/MentorRoomCreatedView.vue'
import ClassRoom from '../components/ClassRoom.vue'
import { currentUserRole } from '../services/auth.js'
import {
  setActiveRoomCode,
  registerRoomExitHandler,
  leaveRoom,
  isClassEnded as sessionClassEnded
} from '../services/session.js'

const router = useRouter()

// Persist the mentor's live room across refreshes (tab-scoped, separate from student key)
const TAB_SESSION_KEY = 'presenter_mentor_room_v1'

// phase: 'create' | 'created' | 'classroom'
const phase = ref('create')
const roomCode = ref('')
const classroomRef = ref(null)

let unregisterExitHandler = null

// ── Code generation (unchanged logic) ──────────────────────────────────────
function generate6DigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// ── Permission guard: only Mentor may create a room ────────────────────────
function canCreateRoom() {
  return (currentUserRole.value || '').toLowerCase() === 'mentor'
}

// ── Handlers ───────────────────────────────────────────────────────────────
function handleCreateRoom() {
  if (!canCreateRoom()) return  // silently reject non-Mentor callers
  if (roomCode.value) return    // already has a live room — never create a second one

  const code = generate6DigitCode()
  roomCode.value = code
  setActiveRoomCode(code)
  persistRoom(code)
  phase.value = 'created'
}

function handleOpenClassRoom(code) {
  phase.value = 'classroom'
  setActiveRoomCode(code)
}

function handleBackHome() {
  // Return to Room Created card (room stays alive)
  phase.value = 'created'
  // Re-assert the active room code (leaveRoom may have cleared it)
  if (roomCode.value) {
    setActiveRoomCode(roomCode.value)
  }
}

function handleLeave() {
  // This is called by the ClassRoom's internal @leave event (if it emits one).
  // The global Navbar Leave goes through leaveRoom → exitMentorRoom.
  // Either way: keep room alive, go back to the Room Created card.
  phase.value = 'created'
  if (roomCode.value) {
    setActiveRoomCode(roomCode.value)
  }
}

// ── Room exit handler (called by universal leaveRoom / Sign out) ───────────
function exitMentorRoom() {
  if (classroomRef.value && typeof classroomRef.value.leaveClass === 'function') {
    try {
      classroomRef.value.leaveClass()
    } catch (_) {}
  }

  // If the class has ended (End Class button), destroy the room entirely.
  // If just leaving the classroom view (Leave button), keep the room code.
  if (sessionClassEnded.value) {
    phase.value = 'create'
    roomCode.value = ''
    clearPersistedRoom()
  } else {
    // Just leaving the classroom — keep room alive, go to Room Created card
    phase.value = 'created'
    // Re-persist and re-assert the code (leaveRoom clears activeRoomCode after handler runs)
    if (roomCode.value) {
      // We use a microtask so this runs after leaveRoom clears activeRoomCode
      Promise.resolve().then(() => {
        if (roomCode.value) {
          setActiveRoomCode(roomCode.value)
          persistRoom(roomCode.value)
        }
      })
    }
  }
}

// ── Session persistence (tab-scoped) ───────────────────────────────────────
function persistRoom(code) {
  try {
    sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify({ roomCode: code }))
  } catch (_) {}
}

function clearPersistedRoom() {
  try {
    sessionStorage.removeItem(TAB_SESSION_KEY)
  } catch (_) {}
}

function restoreRoom() {
  try {
    const raw = sessionStorage.getItem(TAB_SESSION_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    if (saved && saved.roomCode) {
      roomCode.value = saved.roomCode
      setActiveRoomCode(saved.roomCode)
      phase.value = 'created'   // Show the Room Created card — not auto-enter classroom
    }
  } catch (_) {}
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(() => {
  unregisterExitHandler = registerRoomExitHandler(exitMentorRoom)
  restoreRoom()
})

onUnmounted(() => {
  if (unregisterExitHandler) {
    unregisterExitHandler()
    unregisterExitHandler = null
  }
})
</script>
