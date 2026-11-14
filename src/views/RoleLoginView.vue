<template>
  <div class="role-login-view w-full max-w-4xl mx-auto px-4 py-6 md:py-10 text-center flex-1 flex flex-col justify-center select-none">
    <!-- State 1: Role Mismatch Screen -->
    <div
      v-if="roleMismatch"
      class="w-full max-w-sm mx-auto bg-card rounded-2xl p-7 sm:p-8 border border-border text-center shadow-card"
    >
      <!-- Warning Icon -->
      <div class="w-14 h-14 rounded-full bg-warning-soft text-warning flex items-center justify-center mx-auto mb-5 border border-warning/25">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <h2 class="text-lg font-bold text-primary tracking-tight mb-2">
        Role Mismatch
      </h2>

      <p class="text-xs sm:text-sm text-secondary leading-relaxed mb-1.5">
        This Google account is registered as a
      </p>

      <!-- Registered role badge -->
      <div class="flex items-center justify-center gap-2 mb-5">
        <span
          class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border capitalize"
          :class="roleBadgeClasses(roleMismatch.registeredRole)"
        >
          {{ capitalize(roleMismatch.registeredRole) }}
        </span>
        <span class="text-xs text-muted">not</span>
        <span class="inline-flex items-center px-3 py-1 rounded-full bg-raised text-secondary border border-border text-xs font-medium capitalize">
          {{ capitalize(roleMismatch.clickedRole) }}
        </span>
      </div>

      <!-- Continue as registered role (tonal-accent — matches screenshot style) -->
      <button
        type="button"
        @click="handleContinueAsRegisteredRole"
        class="btn-tonal-accent w-full font-semibold py-2.5 px-4 rounded-xl transition text-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2 min-h-[42px]"
      >
        <span>Continue as {{ capitalize(roleMismatch.registeredRole) }}</span>
        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <button
        type="button"
        @click="handleMismatchBack"
        class="btn-secondary w-full mt-2.5 font-medium px-4 py-2.5 rounded-xl text-sm transition cursor-pointer active:scale-98 min-h-[42px]"
      >
        Back
      </button>
    </div>

    <!-- State 2: Unregistered / Inactive Account Error Screen -->
    <div
      v-else-if="authError"
      class="w-full max-w-md mx-auto bg-card rounded-2xl p-6 sm:p-8 border border-border text-center shadow-card"
    >
      <div class="w-12 h-12 rounded-full bg-danger-soft text-danger flex items-center justify-center mx-auto mb-4 border border-danger/20">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h2 class="text-base sm:text-lg font-bold text-primary tracking-tight mb-2">
        Access Denied
      </h2>

      <p class="text-xs sm:text-sm text-secondary leading-relaxed mb-6">
        {{ authError }}
      </p>

      <button
        type="button"
        @click="handleErrorBack"
        class="btn-secondary w-full font-medium px-4 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer active:scale-98"
      >
        Back
      </button>    </div>

    <!-- State 3: Chosen Role - Sign in with Google Screen -->
    <div
      v-else-if="selectedRole"
      class="w-full max-w-sm mx-auto bg-card rounded-2xl p-6 sm:p-8 border border-border text-center shadow-card"
    >
      <!-- Role Icon Header -->
      <div
        class="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3.5 transition-transform"
        :class="roleBadgeClasses(selectedRole)"
      >
        <svg
          v-if="selectedRole === 'student'"
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 14v7" />
        </svg>
        <svg
          v-else
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>

      <h1 class="text-xl font-bold text-primary tracking-tight capitalize mb-1">
        {{ selectedRole }} Sign In
      </h1>
      <p class="text-xs text-secondary mb-6">
        Sign in with your verified Google account
      </p>

      <!-- Sign In with Google Button -->
      <button
        type="button"
        @click="handleGoogleSignIn"
        :disabled="isSigningIn"
        class="btn-tonal-accent w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer active:scale-98 transition disabled:opacity-50"
      >
        <svg class="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
        </svg>
        <span>{{ isSigningIn ? 'Redirecting...' : 'Sign in with Google' }}</span>
      </button>

      <!-- Back Button -->
      <button
        type="button"
        @click="selectedRole = null"
        :disabled="isSigningIn"
        class="btn-secondary w-full mt-3 font-medium px-4 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer active:scale-98"
      >
        Back
      </button>
    </div>

    <!-- State 4: First Screen - Three Role Cards -->
    <div v-else>
      <h1 class="text-2xl md:text-3xl font-extrabold text-primary tracking-tight">
        Welcome to Presenter
      </h1>
      <p class="text-xs md:text-sm text-secondary mt-1 mb-6 md:mb-8">
        Select your role to get started
      </p>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto items-stretch w-full">
        <!-- Admin Card -->
        <button
          type="button"
          @click="selectRole('admin')"
          class="bg-card rounded-2xl p-5 md:p-6 border border-border hover:border-admin transition-all duration-200 flex flex-col items-center text-center cursor-pointer group"
        >
          <div class="w-12 h-12 rounded-full bg-admin-soft text-admin flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform border border-admin/20">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 class="text-base font-bold text-primary mb-1">
            Admin
          </h2>
          <p class="text-xs text-secondary leading-relaxed">
            Create a room and generate a class code for participants
          </p>
        </button>

        <!-- Mentor Card -->
        <button
          type="button"
          @click="selectRole('mentor')"
          class="bg-card rounded-2xl p-5 md:p-6 border border-border hover:border-accent transition-all duration-200 flex flex-col items-center text-center cursor-pointer group"
        >
          <div class="w-12 h-12 rounded-full bg-success-soft text-success flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform border border-success/20">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 class="text-base font-bold text-primary mb-1">
            Mentor
          </h2>
          <p class="text-xs text-secondary leading-relaxed">
            Lead the session and control what students see in real time
          </p>
        </button>

        <!-- Student Card -->
        <button
          type="button"
          @click="selectRole('student')"
          class="bg-card rounded-2xl p-5 md:p-6 border border-border hover:border-accent transition-all duration-200 flex flex-col items-center text-center cursor-pointer group"
        >
          <div class="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform border border-accent/20">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 14v7" />
            </svg>
          </div>
          <h2 class="text-base font-bold text-primary mb-1">
            Student
          </h2>
          <p class="text-xs text-secondary leading-relaxed">
            Join a room using the 6-digit code provided by your admin
          </p>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  authError,
  roleMismatch,
  clearAuthError,
  clearRoleMismatch,
  signInWithGoogle,
  signOut
} from '../services/auth'

const router = useRouter()
const selectedRole = ref(null)
const isSigningIn = ref(false)

function selectRole(role) {
  clearAuthError()
  clearRoleMismatch()
  selectedRole.value = role
}

function roleBadgeClasses(role) {
  if (role === 'admin')  return 'bg-admin-soft text-admin border border-admin/20'
  if (role === 'mentor') return 'bg-success-soft text-success border border-success/20'
  return 'bg-accent-soft text-accent border border-accent/20'
}

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

async function handleGoogleSignIn() {
  if (!selectedRole.value || isSigningIn.value) return
  isSigningIn.value = true
  await signInWithGoogle(selectedRole.value)
  isSigningIn.value = false
}

function handleErrorBack() {
  clearAuthError()
  selectedRole.value = null
}

async function handleMismatchBack() {
  await signOut()
  clearRoleMismatch()
  selectedRole.value = null
}

function handleContinueAsRegisteredRole() {
  if (!roleMismatch.value?.registeredRole) return
  const destRole = roleMismatch.value.registeredRole.toLowerCase()
  clearRoleMismatch()
  router.replace(`/${destRole}`)
}
</script>
