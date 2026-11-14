<template>
  <div class="student-view flex-1 w-full min-h-0 flex flex-col overflow-y-auto md:overflow-hidden relative">
    <!-- 1. Join Room & Name Entry -->
    <StudentJoinView
      v-if="view === 'student-join'"
      :initial-name="profile?.name || ''"
      @join-room="handleStudentJoinRoom"
      @back-home="handleLeave"
    />

    <!-- 2. Waiting for Class to Start -->
    <StudentWaiting
      v-else-if="view === 'student-waiting'"
      :room-code="currentRoomCode"
      @leave="handleLeave"
    />

    <!-- 3. Class Already Ended -->
    <div
      v-else-if="view === 'student-ended'"
      class="w-full max-w-md mx-auto bg-card rounded-2xl p-6 sm:p-8 border border-border text-center my-auto select-none shadow-card"
    >
      <div class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-raised text-secondary border border-border font-medium text-xs mb-3">
        Room {{ currentRoomCode }}
      </div>
      <h2 class="text-xl font-bold text-primary tracking-tight mb-2">
        This class has ended
      </h2>
      <p class="text-sm text-secondary mb-6">
        This session is no longer accepting participants.
      </p>
      <button
        type="button"
        @click="handleLeave"
        class="btn-secondary inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer active:scale-98 focus-visible:ring-2 focus-visible:ring-accent"
      >
        Back to Home
      </button>
    </div>

    <!-- 4. Removed by Mentor -->
    <div
      v-else-if="view === 'student-removed'"
      class="w-full max-w-md mx-auto bg-card rounded-2xl p-6 sm:p-8 border border-border text-center my-auto select-none shadow-card"
    >
      <div class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-raised text-secondary border border-border font-medium text-xs mb-3">
        Room {{ currentRoomCode }}
      </div>
      <h2 class="text-xl font-bold text-primary tracking-tight mb-2">
        {{ isRemovedRejoin ? 'You were removed from this class.' : 'You have been removed from this class by the Mentor.' }}
      </h2>
      <p class="text-sm text-secondary mb-6">
        {{ isRemovedRejoin ? 'You cannot rejoin this session.' : 'You can no longer participate in this session.' }}
      </p>
      <button
        type="button"
        @click="handleLeave"
        class="btn-secondary inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer active:scale-98 focus-visible:ring-2 focus-visible:ring-accent"
      >
        Leave
      </button>
    </div>

    <!-- 5. Live Classroom -->
    <ClassRoom
      v-else-if="view === 'classroom'"
      ref="classroomRef"
      :is-mentor="false"
      :student-name="studentDisplayName"
      :student-id="studentId"
      :room-code="currentRoomCode"
      :initial-room-state="initialClassroomState"
      @leave="handleLeave"
      @student-removed="handleStudentRemovedByMentor"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import StudentJoinView from '../components/StudentJoinView.vue'
import StudentWaiting from '../components/StudentWaiting.vue'
import ClassRoom from '../components/ClassRoom.vue'
import { RealtimeService } from '../services/realtime'
import { profile } from '../services/auth'
import {
  setActiveRoomCode,
  setIsClassEnded,
  registerRoomExitHandler,
  leaveRoom
} from '../services/session.js'

const router = useRouter()

const view = ref('student-join') // 'student-join' | 'student-waiting' | 'student-ended' | 'student-removed' | 'classroom'
const currentRoomCode = ref(null)
const studentDisplayName = ref('')
const studentId = ref('')
const initialClassroomState = ref(null)
const isRemovedRejoin = ref(false)
const classroomRef = ref(null)

const TAB_SESSION_KEY = 'presenter_tab_session_v1'

let studentWaitingRealtime = null
let studentWaitingPollTimer = null
let unregisterExitHandler = null

watch(view, (v) => {
  if (v === 'student-ended') {
    setIsClassEnded(true)
  } else if (v === 'student-join') {
    setIsClassEnded(false)
  }
})

function createStudentId() {
  return `st_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

function saveStudentTabSession(session) {
  try {
    sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify(session))
  } catch (_) {}
}

function clearStudentTabSession() {
  try {
    sessionStorage.removeItem(TAB_SESSION_KEY)
    const keysToRemove = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith('presenter_hand_')) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k))
  } catch (_) {}
}

function cleanupWaitingRealtime() {
  if (studentWaitingPollTimer) {
    clearInterval(studentWaitingPollTimer)
    studentWaitingPollTimer = null
  }
  if (studentWaitingRealtime) {
    studentWaitingRealtime.destroy()
    studentWaitingRealtime = null
  }
}

function enterStudentSession({ roomCode, name, id }) {
  cleanupWaitingRealtime()
  initialClassroomState.value = null
  currentRoomCode.value = roomCode
  setActiveRoomCode(roomCode)
  setIsClassEnded(false)
  studentDisplayName.value = name || profile.value?.name || 'Student'

  let storedSessionStudentId = null
  try {
    storedSessionStudentId = sessionStorage.getItem(`presenter_student_id_${roomCode}`)
  } catch (_) {}
  studentId.value = id || storedSessionStudentId || createStudentId()
  try {
    sessionStorage.setItem(`presenter_student_id_${roomCode}`, studentId.value)
  } catch (_) {}

  saveStudentTabSession({
    role: 'student',
    roomCode,
    name: studentDisplayName.value,
    studentId: studentId.value
  })

  // Check if student was previously removed from this room
  let isRemoved = false
  try {
    isRemoved = Boolean(localStorage.getItem(`presenter_removed_${roomCode}`))
  } catch (_) {}

  if (isRemoved) {
    isRemovedRejoin.value = true
    view.value = 'student-removed'
    return
  }

  // Check if class is already live or ended in cache
  const cachedRaw = localStorage.getItem(`presenter_room_state_${roomCode}`)
  let alreadyLive = false
  if (cachedRaw) {
    try {
      const parsed = JSON.parse(cachedRaw)
      if (parsed && parsed.senderRole === 'mentor') {
        if (Array.isArray(parsed.removedStudentIds) && parsed.removedStudentIds.includes(studentId.value)) {
          try {
            localStorage.setItem(`presenter_removed_${roomCode}`, studentId.value)
          } catch (_) {}
          isRemovedRejoin.value = true
          view.value = 'student-removed'
          return
        }
        if (parsed.isClassEnded) {
          initialClassroomState.value = null
          view.value = 'student-ended'
          setIsClassEnded(true)
          return
        }
        if (parsed.isClassLive) {
          initialClassroomState.value = parsed
          alreadyLive = true
        }
      }
    } catch (_) {}
  }

  if (alreadyLive) {
    view.value = 'classroom'
  } else {
    view.value = 'student-waiting'
    listenForClassStart(roomCode)
  }
}

function handleStudentJoinRoom({ roomCode, name, studentId: customId, id }) {
  const resolvedName = name || profile.value?.name || 'Student'
  let resolvedId = customId || id
  if (!resolvedId) {
    try {
      resolvedId = sessionStorage.getItem(`presenter_student_id_${roomCode}`)
    } catch (_) {}
  }
  if (!resolvedId) {
    try {
      resolvedId = localStorage.getItem(`presenter_student_id_${roomCode}_${resolvedName.toLowerCase()}`)
    } catch (_) {}
  }
  if (!resolvedId) {
    resolvedId = createStudentId()
  }
  try {
    sessionStorage.setItem(`presenter_student_id_${roomCode}`, resolvedId)
    localStorage.setItem(`presenter_student_id_${roomCode}_${resolvedName.toLowerCase()}`, resolvedId)
  } catch (_) {}

  enterStudentSession({
    roomCode,
    name: resolvedName,
    id: resolvedId
  })
}

function listenForClassStart(roomCode) {
  cleanupWaitingRealtime()

  studentWaitingRealtime = new RealtimeService(roomCode)

  const sendJoinAndRequest = () => {
    if (!studentWaitingRealtime) return
    if (studentDisplayName.value) {
      studentWaitingRealtime.publish('student-join', {
        name: studentDisplayName.value,
        studentId: studentId.value,
        role: 'student',
        senderRole: 'student'
      })
    } else {
      studentWaitingRealtime.publish('request-state', {
        name: 'Student',
        studentId: studentId.value,
        role: 'student',
        senderRole: 'student'
      })
    }
  }

  studentWaitingRealtime.on('class-start', (data) => {
    if (!data || data.senderRole !== 'mentor') return
    initialClassroomState.value = {
      senderRole: 'mentor',
      mentorId: data.mentorId,
      isClassLive: true,
      isClassEnded: false,
      currentStepIndex: 0
    }
    cleanupWaitingRealtime()
    view.value = 'classroom'
  })

  studentWaitingRealtime.on('class-end', (data) => {
    if (!data || data.senderRole !== 'mentor') return
    cleanupWaitingRealtime()
    initialClassroomState.value = null
    view.value = 'student-ended'
    setIsClassEnded(true)
  })

  studentWaitingRealtime.on('student-removed', (data) => {
    if (!data || data.senderRole !== 'mentor' || !data.mentorId) return
    if (data.studentId !== studentId.value) return
    try {
      localStorage.setItem(`presenter_removed_${roomCode}`, studentId.value)
    } catch (_) {}
    cleanupWaitingRealtime()
    isRemovedRejoin.value = Boolean(data.isRejoinAttempt)
    view.value = 'student-removed'
  })

  studentWaitingRealtime.on('state-sync', (state) => {
    if (!state || state.senderRole !== 'mentor') return
    if (Array.isArray(state.removedStudentIds) && state.removedStudentIds.includes(studentId.value)) {
      try {
        localStorage.setItem(`presenter_removed_${roomCode}`, studentId.value)
      } catch (_) {}
      cleanupWaitingRealtime()
      isRemovedRejoin.value = true
      view.value = 'student-removed'
      return
    }
    if (state.isClassEnded) {
      cleanupWaitingRealtime()
      initialClassroomState.value = null
      view.value = 'student-ended'
      setIsClassEnded(true)
      return
    }
    if (state.isClassLive && !state.isClassEnded) {
      initialClassroomState.value = state
      cleanupWaitingRealtime()
      view.value = 'classroom'
    }
  })

  studentWaitingRealtime.onSubscribed(() => {
    sendJoinAndRequest()
  })

  studentWaitingPollTimer = setInterval(() => {
    sendJoinAndRequest()
  }, 2000)
}

function handleStudentRemovedByMentor({ reason, roomCode, studentId: removedId }) {
  cleanupWaitingRealtime()
  if (roomCode && removedId) {
    try {
      localStorage.setItem(`presenter_removed_${roomCode}`, removedId)
    } catch (_) {}
  }
  isRemovedRejoin.value = reason === 'rejoin'
  view.value = 'student-removed'
}

// Exit handler called by universal leaveRoom()
function exitStudentRoom() {
  if (classroomRef.value && typeof classroomRef.value.leaveClass === 'function') {
    try {
      classroomRef.value.leaveClass()
    } catch (_) {}
  }
  if (view.value === 'student-waiting' && studentWaitingRealtime) {
    try {
      studentWaitingRealtime.publish('student-leave', {
        senderRole: 'student',
        role: 'student',
        studentId: studentId.value,
        studentName: studentDisplayName.value
      })
    } catch (_) {}
  }
  cleanupWaitingRealtime()
  view.value = 'student-join'
  currentRoomCode.value = null
  studentDisplayName.value = ''
  studentId.value = ''
  initialClassroomState.value = null
  isRemovedRejoin.value = false
}

function handleLeave() {
  leaveRoom(router, 'student')
}

function handleWaitingPageHide() {
  if (view.value === 'student-waiting' && studentWaitingRealtime) {
    studentWaitingRealtime.publishUnload('student-disconnecting', {
      senderRole: 'student',
      role: 'student',
      studentId: studentId.value,
      studentName: studentDisplayName.value
    })
  }
}

function handleWaitingWakeOrOnline() {
  if (view.value === 'student-waiting' && studentWaitingRealtime) {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    if (studentDisplayName.value) {
      studentWaitingRealtime.publish('student-join', {
        name: studentDisplayName.value,
        studentId: studentId.value,
        role: 'student',
        senderRole: 'student'
      })
    }
  }
}

onMounted(() => {
  unregisterExitHandler = registerRoomExitHandler(exitStudentRoom)

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', handleWaitingPageHide)
    window.addEventListener('offline', handleWaitingPageHide)
    window.addEventListener('online', handleWaitingWakeOrOnline)
    document.addEventListener('visibilitychange', handleWaitingWakeOrOnline)
  }
  try {
    const raw = sessionStorage.getItem(TAB_SESSION_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved && saved.role === 'student' && saved.roomCode && saved.name) {
        enterStudentSession({
          roomCode: saved.roomCode,
          name: saved.name,
          id: saved.studentId
        })
      }
    }
  } catch (_) {}
})

onUnmounted(() => {
  if (unregisterExitHandler) {
    unregisterExitHandler()
    unregisterExitHandler = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('pagehide', handleWaitingPageHide)
    window.removeEventListener('offline', handleWaitingPageHide)
    window.removeEventListener('online', handleWaitingWakeOrOnline)
    document.removeEventListener('visibilitychange', handleWaitingWakeOrOnline)
  }
  cleanupWaitingRealtime()
})
</script>
