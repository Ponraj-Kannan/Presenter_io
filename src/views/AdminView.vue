<template>
  <div class="admin-view flex-1 w-full min-h-0 flex flex-col overflow-y-auto md:overflow-hidden relative">
    <!-- Live Classroom as Mentor if Admin opened Mentor view -->
    <ClassRoom
      v-if="inClassroom && roomCode"
      ref="classroomRef"
      :is-mentor="true"
      :room-code="roomCode"
      @leave="handleLeaveClassroom"
    />

    <!-- Admin Room Created View (Home Screen) -->
    <AdminRoomView
      v-else
      :room-code="roomCode"
      @back-home="handleAdminReset"
      @join-as-mentor="handleOpenMentorView"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminRoomView from '../components/AdminRoomView.vue'
import ClassRoom from '../components/ClassRoom.vue'
import {
  setActiveRoomCode,
  registerRoomExitHandler,
  leaveRoom
} from '../services/session.js'

const router = useRouter()

const roomCode = ref('')
const inClassroom = ref(false)
const classroomRef = ref(null)

let unregisterExitHandler = null

function generate6DigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function handleOpenMentorView(code) {
  inClassroom.value = true
  setActiveRoomCode(code)
}

function exitAdminRoom() {
  if (classroomRef.value && typeof classroomRef.value.leaveClass === 'function') {
    try {
      classroomRef.value.leaveClass()
    } catch (_) {}
  }
  inClassroom.value = false
}

function handleLeaveClassroom() {
  leaveRoom(router, 'admin')
}

function handleAdminReset() {
  inClassroom.value = false
  roomCode.value = generate6DigitCode()
  setActiveRoomCode(roomCode.value)
}

onMounted(() => {
  unregisterExitHandler = registerRoomExitHandler(exitAdminRoom)

  if (!roomCode.value) {
    roomCode.value = generate6DigitCode()
  }
  setActiveRoomCode(roomCode.value)
})

onUnmounted(() => {
  if (unregisterExitHandler) {
    unregisterExitHandler()
    unregisterExitHandler = null
  }
})
</script>
