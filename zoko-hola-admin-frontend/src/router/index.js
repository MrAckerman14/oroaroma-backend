import { defineRouter } from '#q-app/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'
import routes from './routes.js'
import { Cookies } from 'quasar'
import { normalizeRole, useAuthStore } from 'stores/auth'
import { api } from 'boot/axios'

let sessionSyncPromise = null
let sessionSyncToken = null

async function syncSessionOnce(auth) {
  const token = Cookies.get('token')
  if (sessionSyncPromise && sessionSyncToken === token) return sessionSyncPromise

  sessionSyncToken = token
  sessionSyncPromise = api
    .get('/auth/me')
    .then((response) => {
      const user = response.data?.user || response.data?.data?.user || response.data?.data
      if (user && auth?.setSessionFromUser) {
        auth.setSessionFromUser(user)
      }
      sessionSyncToken = Cookies.get('token')
      return user
    })
    .catch((error) => {
      auth.clearSession()
      sessionSyncPromise = null
      sessionSyncToken = null
      throw error
    })

  return sessionSyncPromise
}

function defaultPathForRole(role) {
  const normalizedRole = normalizeRole(role)

  if (normalizedRole === 'Admin') return '/'
  if (normalizedRole === 'Supervisor') return '/'
  if (normalizedRole === 'Vendedor') return '/'
  if (normalizedRole === 'Colaborador') return '/'
  if (normalizedRole === 'Mensajero') return '/mensajero'

  return '/login'
}

function redirectToAllowedPath(to, auth, next) {
  const fallbackPath = defaultPathForRole(auth.role)

  if (to.path === fallbackPath) {
    next('/login')
    return
  }

  next(fallbackPath)
}

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function (/* { store, ssrContext } */) {
  const env = typeof process !== 'undefined' && process.env ? process.env : {}
  const createHistory = env.SERVER
    ? createMemoryHistory
    : (env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(env.VUE_ROUTER_BASE)
  });

//     // 🔐 GUARD GLOBAL
  Router.beforeEach(async (to, from, next) => {
    const token = Cookies.get('token')
    const auth = useAuthStore()

    // No autenticado → solo login
    if (!token && to.path !== '/login') {
      next('/login')
      return
    }

    // Autenticado → no volver a login
    if (token && to.path === '/login') {
      try {
        await syncSessionOnce(auth)
        next(defaultPathForRole(auth.role))
      } catch {
        next()
      }
      return
    }

    if (token) {
      try {
        await syncSessionOnce(auth)
      } catch {
        next('/login')
        return
      }
    }

    const role = normalizeRole(auth.role)
    // console.log(auth.isAdmin)
  if (to.meta.adminOnly && !auth.isAdmin) {
    redirectToAllowedPath(to, auth, next)
    return;
  }

  if (to.meta.roles && !to.meta.roles.includes(role)) {
    redirectToAllowedPath(to, auth, next)
    return;
  }

    next()
  })

  return Router
})
