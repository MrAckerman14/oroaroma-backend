<template>
  <aside class="app-menu column no-wrap full-height">
    <div class="menu-brand">
      <div class="row items-center no-wrap">
        <q-avatar size="46px" class="menu-brand__logo">
          <img :src="appTheme.logo" :alt="appTheme.name" />
        </q-avatar>

        <div class="q-ml-md">
          <div class="text-subtitle1 text-weight-bold">{{ appTheme.name }}</div>
          <div class="text-caption text-grey-5">Panel de administración</div>
        </div>
      </div>

      <div class="row items-center q-mt-md">
        <q-icon name="account_circle" size="18px" class="q-mr-xs menu-brand__user-icon" />
        <span class="text-caption menu-brand__user-name">{{ auth?.name || "Usuario" }}</span>
        <q-badge class="q-ml-sm menu-brand__role" :label="roleName" />
      </div>
    </div>

    <div class="menu-navigation col">
      <div class="menu-navigation__label">NAVEGACIÓN</div>

      <q-list padding class="q-px-sm">
        <q-item
          v-for="item in filteredItems"
          :key="item.link"
          clickable
          v-ripple
          :to="item.path"
          exact
          :active="isActive(item)"
          active-class="menu-item--active"
          class="menu-item q-my-xs"
        >
          <q-item-section avatar class="menu-item__icon">
            <q-icon :name="item.icon" size="22px" />
          </q-item-section>

          <q-item-section class="text-weight-medium">
            {{ item.name }}
          </q-item-section>

          <q-item-section v-if="isActive(item)" side>
            <q-icon name="chevron_right" size="20px" />
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <div class="menu-footer q-pa-md">
      <div class="row items-center no-wrap">
        <q-avatar class="menu-footer__avatar" icon="person" />
        <div class="q-ml-sm ellipsis">
          <div class="text-body2 text-weight-medium ellipsis">
            {{ auth?.name || "Usuario" }}
          </div>
          <div class="text-caption text-grey-6">Sesión activa</div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script>
import { useAuthStore } from "src/stores/auth";
import { appTheme } from "src/config/appTheme";

const roleAliases = {
  admin: "Admin",
  administrador: "Admin",
  employee: "Vendedor",
  empleado: "Vendedor",
  vendedor: "Vendedor",
  supervisor: "Supervisor",
  collaborator: "Colaborador",
  seller: "Colaborador",
  colaborador: "Colaborador",
  messenger: "Mensajero",
  mensajero: "Mensajero",
};

function normalizeRole(role) {
  if (!role) return null;
  return roleAliases[String(role).trim().toLowerCase()] || role;
}

export default {
  name: "AppMenu",

  data() {
    return {
      auth: null,
      appTheme,
      itemsList: [
        { link: "ventas", path: "/", name: "Ventas", icon: "point_of_sale", roles: ["Admin", "Vendedor", "Supervisor", "Colaborador"] },
        { link: "vendedores", path: "/vendedores", name: "Vendedores", icon: "groups", roles: ["Admin", "Supervisor"] },
        { link: "colaboradores", path: "/colaboradores", name: "Colaboradores", icon: "handshake", roles: ["Admin"] },
        { link: "mensajero", path: "/mensajero", name: "Mensajeros", icon: "local_shipping", roles: ["Admin", "Vendedor", "Supervisor", "Mensajero"] },
        { link: "almacen", path: "/almacen", name: "Almacén", icon: "inventory_2", roles: ["Admin", "Vendedor", "Supervisor", "Colaborador"] },
        { link: "cierre_caja", path: "/cierre_caja", name: "Cierres de caja", icon: "account_balance_wallet", roles: ["Admin"] },
        { link: "reporte_inventario", path: "/reporte_inventario", name: "Reportes de inventario", icon: "assessment", roles: ["Admin"] },
      ],
    };
  },

  created() {
    this.auth = useAuthStore();
  },

  computed: {
    filteredItems() {
      const role = normalizeRole(this.auth?.role);
      return this.itemsList.filter((item) => !item.roles || item.roles.includes(role));
    },

    roleName() {
      return normalizeRole(this.auth?.role) || "Usuario";
    },
  },

  methods: {
    isActive(item) {
      return this.$route.path === item.path;
    },
  },
};
</script>

<style scoped>
.app-menu {
  color: var(--app-ink-soft);
  background: var(--app-surface);
}

.menu-brand {
  padding: 20px 18px 16px;
  color: var(--app-surface);
  background: var(--app-ink-soft);
}

.menu-brand__logo {
  border: 2px solid var(--app-primary);
  background: var(--app-surface);
}

.menu-brand__user-icon {
  color: var(--app-menu-user-icon);
}

.menu-brand__user-name {
  color: var(--app-surface);
  font-weight: 600;
}

.menu-brand__role {
  color: var(--app-surface);
  background: var(--app-menu-role);
  border: 1px solid var(--app-menu-role-border);
}

.menu-navigation {
  padding-top: 14px;
  overflow-y: auto;
}

.menu-navigation__label {
  padding: 0 24px 8px;
  color: #8a8a8a;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.9px;
}

.menu-item {
  min-height: 48px;
  border-radius: 10px;
  color: #535353;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.menu-item__icon {
  min-width: 38px;
  color: #727272;
}

.menu-item--active {
  color: #000;
  background: var(--app-primary-soft-strong);
}

.menu-item--active .menu-item__icon {
  color: var(--app-primary-strong);
}

.menu-footer {
  border-top: 1px solid #ececec;
  background: #fafafa;
}

.menu-footer__avatar {
  color: var(--app-primary);
  background: var(--app-primary-soft-strong);
}
</style>
