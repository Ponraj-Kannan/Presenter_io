import { ref, computed } from 'vue'
import { supabase, ALLOWED_EMAIL_DOMAINS } from './supabase.js'

export const user = ref(null)
export const profile = ref(null)
export const isLoading = ref(true)
export const isAuthInitialized = ref(false)
export const authError = ref('')
export const roleMismatch = ref(null) // { registeredRole: string, clickedRole: string } | null

export const currentUserRole = computed(() => profile.value?.role || null)
export const currentUserName = computed(() => profile.value?.name || '')
export const currentUserDisplayId = computed(() => profile.value?.displayId || '')

/**
 * Format Display ID from role and role_no
 * e.g. admin + 1 -> ADM-0001
 *      mentor + 7 -> MEN-0007
 *      student + 42 -> STU-0042
 */
export function formatDisplayId(role, roleNo) {
  if (!role || roleNo == null) return ''
  const prefixMap = {
    admin: 'ADM',
    mentor: 'MEN',
    student: 'STU'
  }
  const prefix = prefixMap[role.toLowerCase()] || role.toUpperCase().slice(0, 3)
  const paddedNo = String(roleNo).padStart(4, '0')
  return `${prefix}-${paddedNo}`
}

/**
 * Verify Google email domain and verification status
 */
export function isGoogleEmailValid(authUser) {
  if (!authUser?.email) return false
  const email = authUser.email.toLowerCase().trim()
  const domain = email.split('@')[1]
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    return false
  }
  const isVerified = Boolean(
    authUser.user_metadata?.email_verified ??
    authUser.user_metadata?.verified_email ??
    authUser.email_confirmed_at
  )
  return isVerified
}

/**
 * Fetch profile via get_my_profile() RPC
 * Returns { id, role, role_no, name, displayId } or null
 */
export async function fetchMyProfile() {
  try {
    const { data, error } = await supabase.rpc('get_my_profile')
    if (error) {
      console.warn('[Auth] get_my_profile RPC error:', error.message)
      return null
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row || !row.id || !row.role) {
      return null
    }

    const displayId = formatDisplayId(row.role, row.role_no)
    return {
      id: row.id,
      role: row.role,
      role_no: row.role_no,
      name: row.name,
      displayId
    }
  } catch (err) {
    console.error('[Auth] Failed to call get_my_profile:', err)
    return null
  }
}

/**
 * Initialize Auth State on application load or reload.
 * Reads stored session locally and makes one get_my_profile() call.
 */
export async function initAuth() {
  isLoading.value = true
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session?.user) {
      user.value = null
      profile.value = null
      return null
    }

    // Check valid Google verified email
    if (!isGoogleEmailValid(session.user)) {
      await supabase.auth.signOut()
      authError.value = 'This Google account is not registered. Please contact your Admin.'
      user.value = null
      profile.value = null
      return null
    }

    // Make exactly one get_my_profile call on reload
    const userProfile = await fetchMyProfile()
    if (!userProfile) {
      await supabase.auth.signOut()
      authError.value = 'This Google account is not registered. Please contact your Admin.'
      user.value = null
      profile.value = null
      return null
    }

    user.value = session.user
    profile.value = userProfile
    return userProfile
  } catch (err) {
    console.error('[Auth] initAuth error:', err)
    user.value = null
    profile.value = null
    return null
  } finally {
    isAuthInitialized.value = true
    isLoading.value = false
  }
}

/**
 * Initiate Google Sign In with OAuth
 * Keeps the clicked role in sessionStorage (inside try/catch)
 * Sets redirectTo to /auth/callback with no extra parameters
 */
export async function signInWithGoogle(hintRole) {
  authError.value = ''
  roleMismatch.value = null

  if (hintRole) {
    try {
      sessionStorage.setItem('presenter_hint_role', hintRole)
    } catch (err) {
      console.warn('[Auth] sessionStorage write error:', err)
    }
  }

  const redirectUrl = `${window.location.origin}/auth/callback`
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl
    }
  })

  if (error) {
    authError.value = error.message || 'Failed to initialize Google Sign In.'
  }
}

/**
 * Sign out of Supabase Auth and reset state
 */
export async function signOut() {
  try {
    await supabase.auth.signOut()
  } catch (err) {
    console.warn('[Auth] signOut error:', err)
  }
  user.value = null
  profile.value = null
  authError.value = ''
  roleMismatch.value = null
  try {
    sessionStorage.removeItem('presenter_hint_role')
  } catch (_) {}
}

export function setAuthError(msg) {
  authError.value = msg || ''
}

export function clearAuthError() {
  authError.value = ''
}

export function setRoleMismatch(mismatch) {
  roleMismatch.value = mismatch
}

export function clearRoleMismatch() {
  roleMismatch.value = null
}
