<template>
  <div class="mentor-login-view w-full max-w-sm mx-auto px-4 py-6 md:py-8 flex-1 flex flex-col justify-center select-none">
    <div class="bg-card rounded-2xl p-6 sm:p-7 border border-border shadow-card">

      <!-- Icon -->
      <div class="w-11 h-11 rounded-full bg-success-soft text-success flex items-center justify-center mb-4 border border-success/20">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>

      <h1 class="text-xl font-bold text-primary tracking-tight">
        Mentor Login
      </h1>
      <p class="text-xs text-secondary mt-0.5 mb-5">
        Enter the room code to access your controls
      </p>

      <form @submit.prevent="handleSubmit">
        <label for="mentor-room-code" class="block text-xs font-semibold text-secondary mb-1.5">
          Room Code
        </label>
        <input
          id="mentor-room-code"
          type="text"
          v-model="inputCode"
          maxlength="6"
          placeholder="000000"
          autofocus
          class="w-full text-center text-3xl font-extrabold tracking-[0.25em] py-3 px-4 rounded-xl border border-border-strong bg-raised/50 focus:border-accent focus:bg-accent-soft/30 focus:outline-none text-primary placeholder:text-muted font-mono transition"
        />

        <p v-if="errorMsg" class="text-xs text-danger mt-2 font-medium flex items-center gap-1">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ errorMsg }}
        </p>

        <button
          type="submit"
          :disabled="inputCode.trim().length !== 6"
          class="btn-tonal-accent w-full mt-4 font-semibold py-3 rounded-xl transition text-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>Enter Room</span>
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          type="button"
          @click="$emit('back-home')"
          class="btn-secondary w-full mt-2.5 font-medium px-4 py-2.5 rounded-xl text-sm transition cursor-pointer active:scale-98 min-h-[42px]"
        >
          Back
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['enter-room', 'back-home'])

const inputCode = ref('')
const errorMsg = ref('')

function handleSubmit() {
  const code = inputCode.value.replace(/\D/g, '').trim()
  if (code.length !== 6) {
    errorMsg.value = 'Please enter a valid 6-digit room code.'
    return
  }
  errorMsg.value = ''
  emit('enter-room', code)
}
</script>
