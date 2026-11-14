<template>
  <div class="mentor-view flex-1 w-full min-h-0 flex flex-col overflow-y-auto md:overflow-hidden relative">
    <!-- Live Classroom when Mentor entered room -->
    <ClassRoom
      v-if="inClassroom && roomCode"
      ref="classroomRef"
      :is-mentor="true"
      :room-code="roomCode"
      @leave="handleLeave"
    />

    <!-- Mentor Login: Enter Room Code -->
    <MentorLoginView
      v-else
      @enter-room="handleEnterRoom"
      @back-home="handleLeave"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import MentorLoginView from '../components/MentorLoginView.vue'
import ClassRoom from '../components/ClassRoom.vue'
import {
  setActiveRoomCode,
  registerRoomExitHandler,
  leaveRoom
} from '../services/session.js'

const router = useRouter()

const TAB_SESSION_KEY = 'presenter_tab_session_v1'

const roomCode = ref('')
const inClassroom = ref(false)
const classroomRef = ref(null)

let unregisterExitHandler = null

function handleEnterRoom(code) {
  roomCode.value = code
  inClassroom.value = true
  setActiveRoomCode(code)
  try {
    sessionStorage.setItem(
      TAB_SESSION_KEY,
      JSON.stringify({
        role: 'mentor',
        roomCode: code
      })
    )
  } catch (_) {}
}

// Exit handler called by universal leaveRoom()
function exitMentorRoom() {
  if (classroomRef.value && typeof classroomRef.value.leaveClass === 'function') {
    try {
      classroomRef.value.leaveClass()
    } catch (_) {}
  }
  inClassroom.value = false
  roomCode.value = ''
}

function handleLeave() {
  leaveRoom(router, 'mentor')
}

onMounted(() => {
  unregisterExitHandler = registerRoomExitHandler(exitMentorRoom)

  try {
    const raw = sessionStorage.getItem(TAB_SESSION_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved && saved.role === 'mentor' && saved.roomCode) {
        handleEnterRoom(saved.roomCode)
      }
    }
  } catch (_) {}
})

onUnmounted(() => {
  if (unregisterExitHandler) {
    unregisterExitHandler()
    unregisterExitHandler = null
  }
})
</script>
