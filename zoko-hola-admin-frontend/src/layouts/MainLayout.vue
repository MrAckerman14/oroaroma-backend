<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-black text-white">
      <q-toolbar>
        <q-btn dense flat round icon="menu" @click="left = !left" />
        <q-toolbar-title class="flex items-center">
          <span class="text-bold">
            {{ appTheme.name }}
            <span class="role-title">{{ roleTitle }}</span>
          </span>
        </q-toolbar-title>

        <q-btn flat round icon="logout" color="white" @click="logout" />
      </q-toolbar>
    </q-header>

    <q-drawer v-model="left" side="left" overlay bordered>
      <Menu />
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import { useAuthStore } from "src/stores/auth";
import { useRouter } from "vue-router";
import { api } from "src/boot/axios";
import { appTheme } from "src/config/appTheme";
import Menu from "../components/Menu.vue";

export default {
  components: {
    Menu,
  },
  data() {
    return {
      left: false,
      auth: null,
      router: null,
      appTheme,
    };
  },
  
  created() {
    this.auth = useAuthStore();
    this.router = useRouter();
    this.syncSession();
  },

  computed: {
    roleTitle() {
      return this.auth?.role || "";
    },
  },
  
  methods: {
    async syncSession() {
      try {
        const response = await api.get("/auth/me");
        const user = response.data?.user || response.data?.data?.user || response.data?.data;

        if (user) {
          this.auth.setSessionFromUser(user);
        }
      } catch (error) {
        console.error("No se pudo refrescar la sesion:", error);
      }
    },

    logout() {
      this.auth.clearSession();
      this.router.replace("/login");
    },
  },
};
</script>

<style scoped>
.role-title { color: var(--app-primary-strong); }
</style>
