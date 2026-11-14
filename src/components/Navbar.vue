<template>
  <header class="bg-panel border-b border-border sticky top-0 z-30 shrink-0 min-h-[2.75rem] w-full px-4 sm:px-6 py-1 sm:py-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 select-none">
    <!-- Brand / Logo -->
    <button
      type="button"
      @click="$emit('go-home')"
      class="text-lg font-bold text-primary hover:opacity-80 tracking-tight transition-opacity cursor-pointer flex items-center gap-2 shrink-0"
    >
      <img :src="logoUrl" alt="Presenter" class="w-auto max-w-[9.5rem] object-contain shrink-0" />
    </button>

    <!-- Right Controls -->
    <div class="flex flex-wrap items-center justify-end gap-2 text-xs min-w-0">
      <!-- 1. Person's Name Badge (neutral pill style) -->
      <span
        v-if="userName"
        :title="userName"
        :aria-label="role ? `Signed in as ${userName}, ${role}` : `Signed in as ${userName}`"
        class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-raised text-secondary font-medium text-xs border border-border cursor-default select-none max-w-[12rem] shrink min-w-0"
      >
        <span class="truncate">{{ userName }}</span>
      </span>

      <!-- 3. Theme Toggle Button -->
      <button
        type="button"
        @click="toggleTheme"
        :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        :title="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        class="btn-secondary h-7 w-7 rounded-lg cursor-pointer flex items-center justify-center transition shrink-0"
      >
        <!-- Moon in light theme -->
        <svg
          v-if="theme === 'light'"
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
        <!-- Sun in dark theme -->
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      </button>

      <!-- 4. Leave Button (while inside a room) with Confirmation Popover -->
      <div v-if="roomCode" class="relative inline-flex items-center shrink-0">
        <!-- Transparent Backdrop when confirmation is open to dismiss on outside click -->
        <div
          v-if="showLeaveConfirm"
          class="fixed inset-0 z-40"
          @click="cancelLeaveConfirm"
        />

        <button
          type="button"
          @click="handleLeaveClick"
          :aria-expanded="showLeaveConfirm"
          aria-haspopup="dialog"
          class="header-btn-leave h-7 px-4 rounded-lg font-semibold text-xs cursor-pointer transition flex items-center justify-center shrink-0 relative z-50"
        >
          Leave
        </button>

        <!-- Small Confirmation Card near Leave Button -->
        <div
          v-if="showLeaveConfirm"
          class="absolute right-0 top-full mt-1.5 w-64 sm:w-72 bg-card rounded-xl border border-border shadow-card p-3 z-50 text-left select-none"
          role="dialog"
          aria-modal="true"
        >
          <p class="text-xs font-semibold text-primary mb-3 leading-snug">
            {{ leaveConfirmMessage }}
          </p>

          <div class="flex items-center justify-end gap-2">
            <button
              type="button"
              @click="cancelLeaveConfirm"
              class="btn-secondary px-3 py-1 rounded-lg font-semibold text-xs transition cursor-pointer active:scale-98"
            >
              Stay
            </button>
            <button
              type="button"
              @click="confirmLeave"
              class="btn-tonal-danger px-3 py-1 rounded-lg font-semibold text-xs transition cursor-pointer active:scale-98"
            >
              Leave
            </button>
          </div>
        </div>
      </div>

      <!-- 5. Sign Out Button -->
      <button
        v-if="role || userName"
        type="button"
        @click="$emit('sign-out')"
        class="header-btn-signout h-7 px-4 rounded-lg font-semibold text-xs cursor-pointer transition flex items-center justify-center shrink-0"
      >
        Sign out
      </button>
    </div>
  </header>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTheme } from '../utils/theme'
import { isClassEnded } from '../services/session.js'
import logoUrl from '../assets/logo.png'

const props = defineProps({
  role: {
    type: String,
    default: null
  },
  userName: {
    type: String,
    default: ''
  },
  displayId: {
    type: String,
    default: ''
  },
  roomCode: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['go-home', 'leave', 'sign-out'])

const { theme, toggleTheme } = useTheme()

const showLeaveConfirm = ref(false)

const needsConfirmation = computed(() => {
  const r = (props.role || '').toLowerCase()
  // Admin has no confirmation
  if (r === 'admin') return false
  // Class-ended screens have no confirmation
  if (isClassEnded.value) return false
  return true
})

const leaveConfirmMessage = computed(() => {
  const r = (props.role || '').toLowerCase()
  if (r === 'mentor') {
    return 'Leave without ending the class? Students stay in the room.'
  }
  return 'Leave this class?'
})

function handleLeaveClick() {
  if (needsConfirmation.value) {
    showLeaveConfirm.value = true
  } else {
    emit('leave')
  }
}

function cancelLeaveConfirm() {
  showLeaveConfirm.value = false
}

function confirmLeave() {
  showLeaveConfirm.value = false
  emit('leave')
}
</script>
