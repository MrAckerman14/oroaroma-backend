import { Cookies } from 'quasar'

export function isAuthenticated () {
  const token = Cookies.get('token')
  return !!token
}