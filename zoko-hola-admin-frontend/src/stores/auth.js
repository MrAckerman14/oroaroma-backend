import { defineStore } from 'pinia'
import { Cookies } from 'quasar'

const ROLE_ALIASES = {
  admin: 'Admin',
  administrador: 'Admin',
  employee: 'Vendedor',
  empleado: 'Vendedor',
  vendedor: 'Vendedor',
  supervisor: 'Supervisor',
  collaborator: 'Colaborador',
  seller: 'Colaborador',
  colaborador: 'Colaborador',
  messenger: 'Mensajero',
  mensajero: 'Mensajero'
}

function canonicalRoleKey(roleKey) {
  const key = String(roleKey || '').trim().toLowerCase()
  return key === 'seller' ? 'collaborator' : key
}

export function normalizeRole(role) {
  if (!role) return null
  return ROLE_ALIASES[String(role).trim().toLowerCase()] || role
}

export function roleFromUser(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : []
  const assignments = Array.isArray(user?.roleAssignments) ? user.roleAssignments : []
  const roleKey =
    user?.roleKey ||
    roles[0]?.roleKey ||
    roles[0]?.key ||
    assignments[0]?.role?.key
  const roleName =
    user?.roleName ||
    user?.role ||
    roles[0]?.name ||
    assignments[0]?.role?.name ||
    ''

  return normalizeRole(canonicalRoleKey(roleKey) || roleName)
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    userId: Cookies.get('user_id') || null,
    name: Cookies.get('name') || null,
    role: normalizeRole(Cookies.get('rol') || Cookies.get('role_key'))
  }),

  getters: {
    isLogged: (state) => !!state.name,
    isAdmin: (state) => normalizeRole(state.role) === 'Admin',
    isSeller: (state) => normalizeRole(state.role) === 'Colaborador',
    isEmployee: (state) => ['Vendedor', 'Supervisor'].includes(normalizeRole(state.role)),
    isSupervisor: (state) => normalizeRole(state.role) === 'Supervisor',
    isMessenger: (state) => normalizeRole(state.role) === 'Mensajero'
  },

  actions: {
    setSession(name, role, userId = null, roleKey = null) {
      this.userId = userId
      this.name = name
      this.role = normalizeRole(role || roleKey)
      if (userId) Cookies.set('user_id', userId)
      Cookies.set('name', name)
      Cookies.set('rol', this.role)
      if (roleKey) Cookies.set('role_key', canonicalRoleKey(roleKey))
    },

    setSessionFromUser(user) {
      const roles = Array.isArray(user?.roles) ? user.roles : []
      const assignments = Array.isArray(user?.roleAssignments) ? user.roleAssignments : []
      const roleKey =
        user?.roleKey ||
        roles[0]?.roleKey ||
        roles[0]?.key ||
        assignments[0]?.role?.key ||
        null

      this.setSession(user?.name, roleFromUser(user), user?.id, roleKey)
    },

   clearSession () {
        Cookies.remove('name')
        Cookies.remove('rol')
        Cookies.remove('role_key')
        Cookies.remove('user_id')
        Cookies.remove('token')
        Cookies.remove('refresh_token')
        this.userId = null
        this.name = null
        this.role = null
    }
  }
})
