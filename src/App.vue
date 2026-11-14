<template>
  <div class="h-screen w-screen bg-page flex flex-col text-primary overflow-hidden select-none">
    <!-- Thin Top Navbar -->
    <Navbar
      :role="currentUserRole"
      :user-name="currentUserName"
      :display-id="currentUserDisplayId"
      :room-code="activeRoomCode"
      @go-home="handleNavbarHome"
      @leave="handleNavbarLeave"
      @sign-out="handleSignOut"
    />

    <!-- Main Content Area -->
    <main class="flex-1 w-full min-h-0 flex flex-col overflow-y-auto md:overflow-hidden relative">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import Navbar from './components/Navbar.vue'
import {
  currentUserRole,
  currentUserName,
  currentUserDisplayId,
  signOut
} from './services/auth.js'
import { activeRoomCode, leaveRoom } from './services/session.js'

const router = useRouter()

function handleNavbarHome() {
  if (currentUserRole.value) {
    if (activeRoomCode.value) {
      leaveRoom(router, currentUserRole.value)
    } else {
      router.push(`/${currentUserRole.value}`)
    }
  } else {
    router.push('/')
  }
}

function handleNavbarLeave() {
  leaveRoom(router, currentUserRole.value)
}

async function handleSignOut() {
  // Always leave room first if in a room, closing connection and clearing room state
  leaveRoom(router, currentUserRole.value)
  await signOut()
  router.replace('/')
}
</script>
