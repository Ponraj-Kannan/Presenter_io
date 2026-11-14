import { createRouter, createWebHistory } from 'vue-router'
import RoleLoginView from '../views/RoleLoginView.vue'
import AuthCallbackView from '../views/AuthCallbackView.vue'
import AdminView from '../views/AdminView.vue'
import MentorView from '../views/MentorView.vue'
import StudentView from '../views/StudentView.vue'
import {
  user,
  profile,
  isAuthInitialized,
  roleMismatch,
  authError,
  initAuth
} from '../services/auth.js'

const routes = [
  {
    path: '/',
    name: 'role-login',
    component: RoleLoginView
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: AuthCallbackView
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminView,
    meta: { requiredRole: 'admin' }
  },
  {
    path: '/mentor',
    name: 'mentor',
    component: MentorView,
    meta: { requiredRole: 'mentor' }
  },
  {
    path: '/student',
    name: 'student',
    component: StudentView,
    meta: { requiredRole: 'student' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Route Guards
router.beforeEach(async (to, from, next) => {
  // 1. Initialize auth on first load or reload (makes single get_my_profile() call)
  if (!isAuthInitialized.value) {
    await initAuth()
  }

  // 2. Auth callback route always allowed to run
  if (to.path === '/auth/callback') {
    return next()
  }

  const currentUser = user.value
  const currentProfile = profile.value

  // 3. Signed out visitor -> always redirect to role screen '/'
  if (!currentUser || !currentProfile) {
    if (to.path === '/') {
      return next()
    }
    return next('/')
  }

  // 4. Signed in user
  const userRole = (currentProfile.role || '').toLowerCase()
  const rolePath = `/${userRole}`

  // If user navigates to root '/'
  if (to.path === '/') {
    // If viewing role mismatch or error alert, allow staying on '/'
    if (roleMismatch.value || authError.value) {
      return next()
    }
    // Otherwise redirect to their role screen
    return next(rolePath)
  }

  // Role checks: Admin screens only for Admin, Mentor screens only for Mentor, Student screens only for Student
  if (to.meta.requiredRole && to.meta.requiredRole !== userRole) {
    return next(rolePath)
  }

  next()
})

export default router
