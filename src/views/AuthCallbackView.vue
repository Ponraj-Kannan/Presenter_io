<template>
  <div class="auth-callback-view w-full max-w-sm mx-auto px-4 py-8 flex-1 flex flex-col justify-center items-center text-center select-none">
    <div class="bg-card rounded-2xl p-6 sm:p-8 border border-border w-full flex flex-col items-center shadow-card">
      <!-- Google-styled Spinner -->
      <div class="w-10 h-10 border-3 border-accent-soft border-t-accent rounded-full animate-spin mb-4"></div>
      <h2 class="text-base font-bold text-primary tracking-tight">
        Verifying Account
      </h2>
      <p class="text-xs text-secondary mt-1">
        Checking credentials and permissions...
      </p>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase'
import {
  user,
  profile,
  isAuthInitialized,
  isLoading,
  isGoogleEmailValid,
  fetchMyProfile,
  setAuthError,
  setRoleMismatch,
  signOut
} from '../services/auth'

const router = useRouter()

async function getOrWaitSession() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (!error && data?.session?.user) {
      return data.session
    }
  } catch (_) {}

  // Wait for auth state change event if token exchange is asynchronous
  return new Promise((resolve) => {
    let resolved = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (currentSession?.user && !resolved) {
        resolved = true
        subscription.unsubscribe()
        resolve(currentSession)
      }
    })

    setTimeout(() => {
      if (!resolved) {
        resolved = true
        subscription.unsubscribe()
        resolve(null)
      }
    }, 4000)
  })
}

onMounted(async () => {
  isLoading.value = true
  try {
    const session = await getOrWaitSession()

    if (!session?.user) {
      await signOut()
      setAuthError('This Google account is not registered. Please contact your Admin.')
      router.replace('/')
      return
    }

    // 1. Verify Google Email and Allowed Domain
    if (!isGoogleEmailValid(session.user)) {
      await signOut()
      setAuthError('This Google account is not registered. Please contact your Admin.')
      router.replace('/')
      return
    }

    // 2. Fetch Profile via get_my_profile() (links auth_id on first sign in)
    const myProfile = await fetchMyProfile()
    if (!myProfile) {
      await signOut()
      setAuthError('This Google account is not registered. Please contact your Admin.')
      router.replace('/')
      return
    }

    // Store in global auth state
    user.value = session.user
    profile.value = myProfile
    isAuthInitialized.value = true

    // 3. Read clicked role hint from sessionStorage
    let hintRole = null
    try {
      hintRole = sessionStorage.getItem('presenter_hint_role')
      sessionStorage.removeItem('presenter_hint_role')
    } catch (_) {}

    // 4. Role Check
    if (hintRole && hintRole.toLowerCase() !== myProfile.role.toLowerCase()) {
      // Role Mismatch: User clicked one role, but database profile has another
      setRoleMismatch({
        registeredRole: myProfile.role,
        clickedRole: hintRole
      })
      router.replace('/')
      return
    }

    // Role matches: Redirect with history replace to existing screen for that role
    router.replace(`/${myProfile.role}`)
  } catch (err) {
    console.error('[AuthCallback] Error during callback handling:', err)
    await signOut()
    setAuthError('This Google account is not registered. Please contact your Admin.')
    router.replace('/')
  } finally {
    isLoading.value = false
  }
})
</script>
