import { defineBoot } from '#q-app/wrappers'
import axios from 'axios'
import { Cookies, Notify } from 'quasar'

const env = typeof process !== 'undefined' && process.env ? process.env : {}
const productionApiBaseUrl = 'https://backend-oro-aroma-lh1x.onrender.com'

function defaultApiBaseUrl () {
  if (typeof window === 'undefined') return 'http://localhost:3000'

  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000'

  return productionApiBaseUrl
}

const api = axios.create({
  baseURL: env.API_BASE_URL || defaultApiBaseUrl(),
  timeout: Number(env.API_TIMEOUT_MS || 45000)
})

let refreshPromise = null

function decodeJwtPayload (token) {
  try {
    const payload = String(token || '').split('.')[1]
    if (!payload) return null

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function tokenExpiresSoon (token, thresholdSeconds = 60) {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return false

  const expiresAt = Number(payload.exp) * 1000
  return expiresAt - Date.now() <= thresholdSeconds * 1000
}

function isAuthRequest (config) {
  const url = String(config?.url || '')
  return url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout')
}

function clearSessionCookies () {
  Cookies.remove('token')
  Cookies.remove('refresh_token')
  Cookies.remove('name')
  Cookies.remove('rol')
  Cookies.remove('role_key')
  Cookies.remove('user_id')
}

function storeSessionCookies (session) {
  const accessToken = session?.accessToken || session?.token
  const refreshToken = session?.refreshToken

  if (accessToken) {
    Cookies.set('token', accessToken, { expires: 7 })
  }

  if (refreshToken) {
    Cookies.set('refresh_token', refreshToken, { expires: 30 })
  }
}

async function refreshSession () {
  const refreshToken = Cookies.get('refresh_token')
  if (!refreshToken) return null

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken })
      .then((response) => {
        const session = response.data?.data || response.data
        storeSessionCookies(session)
        return session?.accessToken || session?.token || null
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

async function accessTokenForRequest (config) {
  const token = Cookies.get('token')
  if (!token || isAuthRequest(config)) return token

  if (!tokenExpiresSoon(token)) return token

  return await refreshSession().catch(() => null) || token
}

api.interceptors.request.use(async (config) => {
   const token = await accessTokenForRequest(config)

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config

    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      const nextAccessToken = await refreshSession().catch(() => null)

      if (nextAccessToken) {
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`
        return api(originalRequest)
      }
    }

    if (error?.response?.status === 401) {
      clearSessionCookies()

      if (window.location.hash !== '#/login') {
        Notify.create({
          type: 'negative',
          message: 'Tu sesion vencio. Inicia sesion nuevamente.'
        })
        window.location.replace(`${window.location.origin}/#/login`)
      }
    }

    return Promise.reject(error)
  }
)


export default defineBoot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  app.config.globalProperties.$api = api
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
})

export { api }
