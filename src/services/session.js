import { ref } from 'vue'

export const activeRoomCode = ref(null)
export const isClassEnded = ref(false)

export function setActiveRoomCode(code) {
  activeRoomCode.value = code ? String(code) : null
}

export function setIsClassEnded(ended) {
  isClassEnded.value = Boolean(ended)
}

// Active room exit handlers registered by view/classroom components
const roomExitHandlers = new Set()

export function registerRoomExitHandler(fn) {
  roomExitHandlers.add(fn)
  return () => {
    roomExitHandlers.delete(fn)
  }
}

/**
 * Universal leaveRoom function used by Leave, by Sign out, and any exit from a class:
 * 1. Closes the person's class connection right away (unsubscribe and leave presence)
 * 2. Stops all class timers and unmounts the class view
 * 3. Clears saved room state (room code, current step, sessionStorage/memory for room), not theme or auth
 * 4. Navigates to the dashboard using history replace
 */
export function leaveRoom(router, role) {
  const currentCode = activeRoomCode.value

  // 1 & 2. Execute registered exit handlers to immediately close connections, stop timers, and unmount
  for (const handler of Array.from(roomExitHandlers)) {
    try {
      handler()
    } catch (err) {
      console.warn('[leaveRoom] Handler error:', err)
    }
  }

  // 3. Clear saved room state in memory and sessionStorage
  activeRoomCode.value = null
  isClassEnded.value = false

  try {
    sessionStorage.removeItem('presenter_tab_session_v1')
    if (currentCode) {
      sessionStorage.removeItem(`presenter_practice_unlocked_${currentCode}`)
      sessionStorage.removeItem(`presenter_student_id_${currentCode}`)
      // Ensure student is NOT marked as removed so they can rejoin with the same code
      localStorage.removeItem(`presenter_removed_${currentCode}`)
    }
    // Remove any presenter_hand_* or presenter_practice_* keys
    const keysToRemove = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && (k.startsWith('presenter_hand_') || k.startsWith('presenter_practice_'))) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k))
  } catch (_) {}

  // 4. Navigate to dashboard using history replace (Back button won't reopen class)
  if (router && role) {
    const dashboardPath = `/${role.toLowerCase()}`
    router.replace(dashboardPath).catch(() => {})
  }
}
