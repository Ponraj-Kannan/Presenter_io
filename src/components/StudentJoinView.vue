<template>
  <div class="student-join-view w-full max-w-sm mx-auto px-4 py-6 md:py-8 flex-1 flex flex-col justify-center select-none">
    <div class="bg-card rounded-2xl p-6 sm:p-7 border border-border shadow-card">

      <!-- STEP 1: Enter Room Code -->
      <div v-if="step === 1">
        <!-- Icon -->
        <div class="w-11 h-11 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-4">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>

        <h1 class="text-xl font-bold text-primary tracking-tight">
          Join a Room
        </h1>
        <p class="text-xs text-secondary mt-0.5 mb-5">
          Enter the 6-digit code provided by your Admin
        </p>

        <form @submit.prevent="handleCodeSubmit">
          <label for="student-room-code" class="block text-xs font-semibold text-secondary mb-1.5">
            Room Code
          </label>
          <input
            id="student-room-code"
            type="text"
            v-model="inputCode"
            maxlength="6"
            placeholder="000000"
            autofocus
            class="w-full text-center text-3xl font-extrabold tracking-[0.25em] py-3 px-4 rounded-xl border border-border-strong bg-raised/50 focus:border-accent focus:bg-accent-soft/30 focus:outline-none text-primary placeholder:text-muted font-mono transition"
          />

          <p v-if="codeError" class="text-xs text-danger mt-2 font-medium flex items-center gap-1">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ codeError }}
          </p>

          <button
            type="submit"
            :disabled="inputCode.trim().length !== 6"
            class="btn-tonal-accent w-full mt-4 font-semibold py-3 rounded-xl transition text-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Continue</span>
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

      <!-- STEP 2: Enter Student Display Name -->
      <div v-else-if="step === 2">
        <!-- Icon -->
        <div class="w-11 h-11 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-4">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>

        <h1 class="text-xl font-bold text-primary tracking-tight">
          Your Name
        </h1>
        <p class="text-xs text-secondary mt-0.5 mb-5">
          This name will be shown to the Mentor
        </p>

        <form @submit.prevent="handleNameSubmit">
          <label for="student-display-name" class="block text-xs font-semibold text-secondary mb-1.5">
            Display Name
          </label>
          <input
            id="student-display-name"
            type="text"
            v-model="displayName"
            placeholder="e.g. Alex Smith"
            autofocus
            class="w-full py-2.5 px-3.5 rounded-xl border bg-raised/50 focus:outline-none text-primary placeholder:text-muted text-sm transition"
            :class="nameError ? 'border-danger focus:border-danger' : 'border-border-strong focus:border-accent focus:bg-accent-soft/30'"
          />

          <p v-if="nameError" class="text-xs text-danger mt-2 font-medium flex items-center gap-1">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Please enter your name.
          </p>

          <button
            type="submit"
            class="btn-tonal-accent w-full mt-4 font-semibold py-3 rounded-xl transition text-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
          >
            <span>Join Room</span>
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            type="button"
            @click="step = 1"
            class="btn-secondary w-full mt-2.5 font-medium px-4 py-2.5 rounded-xl text-sm transition cursor-pointer active:scale-98 min-h-[42px]"
          >
            Back
          </button>
        </form>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  initialName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['join-room', 'back-home'])

const step = ref(1)
const inputCode = ref('')
const codeError = ref('')
const displayName = ref(props.initialName || '')
const nameError = ref(false)

watch(() => props.initialName, (val) => {
  if (val && !displayName.value) {
    displayName.value = val
  }
})

function handleCodeSubmit() {
  const code = inputCode.value.replace(/\D/g, '').trim()
  if (code.length !== 6) {
    codeError.value = 'Please enter a valid 6-digit room code.'
    return
  }
  let isRemoved = false
  try {
    isRemoved = Boolean(localStorage.getItem(`presenter_removed_${code}`))
  } catch (_) {}
  if (isRemoved) {
    emit('join-room', {
      roomCode: code,
      name: ''
    })
    return
  }
  codeError.value = ''
  step.value = 2
}

function handleNameSubmit() {
  const name = displayName.value.trim()
  if (!name) {
    nameError.value = true
    return
  }
  nameError.value = false
  emit('join-room', {
    roomCode: inputCode.value.trim(),
    name
  })
}
</script>
